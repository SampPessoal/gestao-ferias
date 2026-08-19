import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não definida'); process.exit(1); }

const data = JSON.parse(readFileSync('/tmp/vtvr_data.json', 'utf-8'));
console.log(`Total de registros na planilha: ${data.length}`);

const empresaMap = { 'SUDOESTE': 'SUDOESTE', 'JOANES': 'JOANES', 'FREIRE': 'FREIRE', 'SOLAR': 'SOLAR' };

function norm(n) {
  return n.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

// Remove abreviações (tokens de 1 letra ou com ponto) e retorna só os tokens reais
function palavrasReais(n) {
  return norm(n)
    .replace(/\./g, ' ')
    .split(' ')
    .map(t => t.trim())
    .filter(t => t.length >= 2); // ignora iniciais únicas
}

// Verifica se todos os tokens reais da planilha estão contidos no nome do banco
function contemTodos(planilhaNome, bancoNome) {
  const tPlanilha = palavrasReais(planilhaNome);
  const tBanco = palavrasReais(bancoNome);
  return tPlanilha.every(tp => tBanco.includes(tp));
}

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);

  const [colaboradores] = await conn.execute(`
    SELECT c.id, c.nome, c.empresaId, e.nome as empresaNome
    FROM colaboradores c
    LEFT JOIN empresas e ON c.empresaId = e.id
    WHERE c.status = 'ativo'
  `);
  console.log(`Colaboradores ativos no banco: ${colaboradores.length}`);

  // Agrupar por empresa (nome normalizado)
  const colabPorEmpresa = {};
  for (const c of colaboradores) {
    const emp = norm(c.empresaNome || '');
    if (!colabPorEmpresa[emp]) colabPorEmpresa[emp] = [];
    colabPorEmpresa[emp].push(c);
  }

  let matched = 0;
  let notFound = [];

  for (const row of data) {
    const empKey = norm(empresaMap[norm(row.empresa)] || row.empresa || '');
    const candidatos = colabPorEmpresa[empKey] || [];

    // 1) Match exato
    const nomeNorm = norm(row.nome).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    let colab = candidatos.find(c => norm(c.nome) === nomeNorm);

    // 2) "Contém todos os tokens reais" — ignora abreviações
    if (!colab) {
      const matches = candidatos.filter(c => contemTodos(row.nome, c.nome));
      if (matches.length === 1) {
        colab = matches[0];
        console.log(`FUZZY OK: "${row.nome}" → "${colab.nome}"`);
      } else if (matches.length > 1) {
        console.log(`AMBÍGUO: "${row.nome}" → ${matches.map(m => '"' + m.nome + '"').join(', ')}`);
        notFound.push(row.nome + ' (' + row.empresa + ') [ambíguo]');
        continue;
      }
    }

    if (!colab) {
      notFound.push(row.nome + ' (' + row.empresa + ')');
      continue;
    }

    const vrStr  = row.valorVR        != null ? row.valorVR.toFixed(2)        : null;
    const vtStr  = row.valorVT        != null ? row.valorVT.toFixed(2)        : null;
    const auxStr = row.auxilioVeiculo != null ? row.auxilioVeiculo.toFixed(2) : null;

    await conn.execute(
      `UPDATE colaboradores SET valorVR=?, valorVT=?, auxilioVeiculo=?, setorBeneficio=? WHERE id=?`,
      [vrStr, vtStr, auxStr, row.setor || null, colab.id]
    );
    matched++;
  }

  console.log(`\n=== Resultado ===`);
  console.log(`  Atualizados : ${matched}`);
  console.log(`  Não achados : ${notFound.length}`);
  if (notFound.length) {
    console.log('\nNão encontrados:');
    notFound.forEach(n => console.log('  -', n));
  }

  await conn.end();
}

run().catch(e => { console.error('Erro:', e.message); process.exit(1); });
