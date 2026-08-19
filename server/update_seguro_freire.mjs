import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

// Dados extraídos do PDF da Freire - 23 segurados, valor R$ 10,48
const segurados = [
  { nome: "ALEXANDRE OLIVEIRA FREITAS",          cpf: "019.134.995-02", dataNascimento: "1985-05-22" },
  { nome: "ANA CAROLINA ASSIS DE ALMEIDA",        cpf: "821.234.895-49", dataNascimento: "1981-12-21" },
  { nome: "CIRO SOUZA DA SILVA",                  cpf: "813.253.125-68", dataNascimento: "1983-05-25" },
  { nome: "DANIEL BEZERRA DE SOUZA",              cpf: "018.819.825-30", dataNascimento: "1988-07-17" },
  { nome: "DJALMA GUIMARAES PASSOS SALES",        cpf: "131.872.285-34", dataNascimento: "1957-12-05" },
  { nome: "DIOGO SANTOS GUIMARAES",               cpf: "027.485.915-77", dataNascimento: "1988-09-03" },
  { nome: "DOUGLAS SANTOS GUIMARAES",             cpf: "032.441.035-29", dataNascimento: "1987-02-11" },
  { nome: "FELLIPE NARDE OLIVEIRA DA HORA",       cpf: "074.575.595-07", dataNascimento: "1996-11-03" },
  { nome: "GIOVANNI FRAGASSI LAGO",               cpf: "005.958.725-30", dataNascimento: "1981-11-20" },
  { nome: "IOLANDA SOUZA REIS",                   cpf: "060.490.005-81", dataNascimento: "1994-08-18" },
  { nome: "JOALAS ANDRADE FONTES",                cpf: "043.444.885-04", dataNascimento: "1993-11-19" },
  { nome: "JOSE ALVES DE JESUS",                  cpf: "482.586.365-53", dataNascimento: "1967-01-03" },
  { nome: "JOSE EDUARDO BARBOSA DE CARVALHO",     cpf: "014.838.645-88", dataNascimento: "1988-12-02" },
  { nome: "JUACI CARLOS S SAMPAIO FILHO",         cpf: "005.422.635-05", dataNascimento: "1982-05-16" },
  { nome: "LEIDIANE DOS SANTOS",                  cpf: "030.902.075-16", dataNascimento: "1986-12-05" },
  { nome: "MARCOS SANTOS DA MOTA",                cpf: "025.003.835-80", dataNascimento: "1986-11-23" },
  { nome: "MARIA DO CARMO DE J S COUTO",          cpf: "013.914.265-76", dataNascimento: "1973-04-03" },
  { nome: "MARIANA DE ALMEIDA MOURA",             cpf: "055.182.975-30", dataNascimento: "2003-12-18" },
  { nome: "MONIARA DA CRUZ SILVA PEREIRA",        cpf: "008.384.395-78", dataNascimento: "1983-06-26" },
  { nome: "SILVIA UCHOA LINS",                    cpf: "664.133.545-34", dataNascimento: "1973-12-02" },
  { nome: "TIAGO SANTOS DA CONCEICAO",            cpf: "072.613.475-90", dataNascimento: "1995-08-05" },
  { nome: "UALLAS CARLOS ANDRADE FONTES",         cpf: "043.444.925-36", dataNascimento: "1991-06-17" },
  { nome: "YURI SOUZA LEAO",                      cpf: "041.564.115-24", dataNascimento: "1991-10-08" },
];

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log(`Conectado. Total de segurados Freire: ${segurados.length}`);

  const freireId = 1;
  let atualizados = 0;
  let naoEncontrados = [];

  for (const s of segurados) {
    const cpfLimpo = s.cpf.replace(/[.\-]/g, "");

    // Tentar por CPF primeiro
    const [porCpf] = await conn.execute(
      "SELECT id, nome FROM colaboradores WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? AND empresaId = ?",
      [cpfLimpo, freireId]
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
          [freireId, `%${partes[0]}%${partes[1]}%`]
        );
        if (porNome.length > 0) {
          colabId = porNome[0].id;
          colabNome = porNome[0].nome;
        }
      }
    }

    if (colabId) {
      await conn.execute(
        `UPDATE colaboradores SET cpf = ?, dataNascimento = ?, temSeguroVida = 1, valorSeguroVida = '10.48' WHERE id = ?`,
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
