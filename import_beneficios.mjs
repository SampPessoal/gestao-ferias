import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const data = JSON.parse(readFileSync('/tmp/vtvr_data.json', 'utf-8'));
console.log(`Total de registros na planilha: ${data.length}`);

// Mapeamento de empresa da planilha → nome no banco
const empresaMap = {
  'SUDOESTE': 'Sudoeste',
  'JOANES': 'Joanes',
  'FREIRE': 'Freire',
  'SOLAR': 'Solar',
};

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);

  // Buscar todos os colaboradores ativos com empresa
  const [colaboradores] = await conn.execute(`
    SELECT c.id, c.nome, c.empresaId, e.nome as empresaNome
    FROM colaboradores c
    LEFT JOIN empresas e ON c.empresaId = e.id
    WHERE c.status = 'ativo'
  `);

  console.log(`Colaboradores ativos no banco: ${colaboradores.length}`);

  // Normalizar nome para comparação
  function normNome(n) {
    return n.toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Criar mapa: "EMPRESA|NOME_NORMALIZADO" -> colaborador
  const colabMap = new Map();
  for (const c of colaboradores) {
    const empNorm = (c.empresaNome || '').toUpperCase().trim();
    const key = `${empNorm}|${normNome(c.nome)}`;
    colabMap.set(key, c);
  }

  let matched = 0;
  let notFound = [];

  for (const row of data) {
    const empPlanilha = (row.empresa || '').toUpperCase().trim();
    const empBanco = (empresaMap[empPlanilha] || row.empresa || '').toUpperCase().trim();
    const nomeNorm = normNome(row.nome);
    const key = `${empBanco}|${nomeNorm}`;

    const colab = colabMap.get(key);
    if (!colab) {
      // Tentar busca parcial pelo nome sem empresa
      let found = null;
      for (const [k, v] of colabMap.entries()) {
        if (k.endsWith(`|${nomeNorm}`)) {
          found = v;
          break;
        }
      }
      if (!found) {
        notFound.push({ nome: row.nome, empresa: row.empresa });
        continue;
      }
      // Usar encontrado por nome
      const vrStr = row.valorVR != null ? row.valorVR.toFixed(2) : null;
      const vtStr = row.valorVT != null ? row.valorVT.toFixed(2) : null;
      const auxStr = row.auxilioVeiculo != null ? row.auxilioVeiculo.toFixed(2) : null;
      await conn.execute(
        `UPDATE colaboradores SET valorVR=?, valorVT=?, auxilioVeiculo=?, setorBeneficio=? WHERE id=?`,
        [vrStr, vtStr, auxStr, row.setor || null, found.id]
      );
      matched++;
      continue;
    }

    const vrStr = row.valorVR != null ? row.valorVR.toFixed(2) : null;
    const vtStr = row.valorVT != null ? row.valorVT.toFixed(2) : null;
    const auxStr = row.auxilioVeiculo != null ? row.auxilioVeiculo.toFixed(2) : null;

    await conn.execute(
      `UPDATE colaboradores SET valorVR=?, valorVT=?, auxilioVeiculo=?, setorBeneficio=? WHERE id=?`,
      [vrStr, vtStr, auxStr, row.setor || null, colab.id]
    );
    matched++;
  }

  console.log(`\nResultado:`);
  console.log(`  Atualizados: ${matched}`);
  console.log(`  Não encontrados: ${notFound.length}`);
  if (notFound.length > 0) {
    console.log('\nNão encontrados:');
    for (const nf of notFound) {
      console.log(`  - ${nf.nome} (${nf.empresa})`);
    }
  }

  await conn.end();
}

run().catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});
