import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

// Dados extraídos do PDF da Joanes - 6 segurados, valor R$ 10,00
const segurados = [
  { nome: "ANTONIETA QUEIROZ DE SOUZA",          cpf: "004.378.265-54", dataNascimento: "1981-12-01" },
  { nome: "CLEILSON SANTANA GOMES",               cpf: "003.753.725-39", dataNascimento: "1982-04-20" },
  { nome: "IELDER OLIVEIRA CARNEIRO DOS SANTOS",  cpf: "832.807.405-25", dataNascimento: "1984-06-01" },
  { nome: "JOSIMEIRE ALVES DE ALMEIDA MOURA",     cpf: "863.941.425-49", dataNascimento: "1975-06-30" },
  { nome: "REINALDO LIMA SOARES",                 cpf: "006.494.475-14", dataNascimento: "1982-04-06" },
  { nome: "TAMARA SOARES CARVALHO",               cpf: "015.461.255-31", dataNascimento: "1986-01-13" },
];

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log(`Conectado. Total de segurados Joanes: ${segurados.length}`);

  const joaneId = 3;
  let atualizados = 0;
  let naoEncontrados = [];

  for (const s of segurados) {
    const cpfLimpo = s.cpf.replace(/[.\-]/g, "");

    // Tentar por CPF primeiro
    const [porCpf] = await conn.execute(
      "SELECT id, nome FROM colaboradores WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? AND empresaId = ?",
      [cpfLimpo, joaneId]
    );

    let colabId = null;
    let colabNome = null;

    if (porCpf.length > 0) {
      colabId = porCpf[0].id;
      colabNome = porCpf[0].nome;
    } else {
      // Tentar por nome (primeiras 2 palavras significativas)
      const partes = s.nome.replace(/[^a-zA-Z\s]/g, "").trim().toUpperCase().split(" ").filter(p => p.length > 2);
      if (partes.length >= 2) {
        const [porNome] = await conn.execute(
          `SELECT id, nome FROM colaboradores WHERE empresaId = ? AND UPPER(nome) LIKE ? LIMIT 1`,
          [joaneId, `%${partes[0]}%${partes[1]}%`]
        );
        if (porNome.length > 0) {
          colabId = porNome[0].id;
          colabNome = porNome[0].nome;
        }
      }
    }

    if (colabId) {
      await conn.execute(
        `UPDATE colaboradores SET cpf = ?, dataNascimento = ?, temSeguroVida = 1, valorSeguroVida = '10.00' WHERE id = ?`,
        [s.cpf, s.dataNascimento, colabId]
      );
      console.log(`✓ Atualizado: ${colabNome} (ID=${colabId}) ← ${s.nome}`);
      atualizados++;
    } else {
      naoEncontrados.push(s.nome);
      console.log(`✗ Não encontrado: ${s.nome} (CPF: ${s.cpf})`);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`Atualizados: ${atualizados}/${segurados.length}`);
  if (naoEncontrados.length > 0) {
    console.log(`\nNão encontrados (${naoEncontrados.length}):`);
    naoEncontrados.forEach(n => console.log(`  - ${n}`));
  }

  await conn.end();
}

main().catch(err => { console.error("Erro:", err); process.exit(1); });
