// Script para atualizar colaboradores da Sudoeste com dados do seguro de vida
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

// Dados extraídos do PDF - Nome, CPF, Data de Nascimento
const segurados = [
  { nome: "ADRIANO BORGES COSTA", cpf: "582.264.510-00", dataNascimento: "1969-11-21" },
  { nome: "ALAELSON DE JESUS SANTOS JUNIOR", cpf: "060.410.985-74", dataNascimento: "1996-09-25" },
  { nome: "ALAN ROBSON DE BARROS JUNIORÃ", cpf: "026.349.455-89", dataNascimento: "1999-01-25" },
  { nome: "ANDERSON DE SOUZA PITA", cpf: "030.075.875-81", dataNascimento: "1987-03-14" },
  { nome: "ANDRE SANTOS NERI", cpf: "822.136.905-53", dataNascimento: "1981-09-01" },
  { nome: "ARNALDO DE LIRO LOPES", cpf: "042.170.015-76", dataNascimento: "2003-12-19" },
  { nome: "CAUA GOES FARIAS", cpf: "026.089.615-36", dataNascimento: "2003-12-23" },
  { nome: "CAUAN SILVA JESUS", cpf: "094.405.175-81", dataNascimento: "2004-06-27" },
  { nome: "DANIELA VILAS BOAS BARBOSA", cpf: "006.708.735-35", dataNascimento: "1983-04-28" },
  { nome: "DANIELLE MARQUES CAZUMBA", cpf: "057.989.345-60", dataNascimento: "1991-09-25" },
  { nome: "DANILO DE SOUZA FARIAS", cpf: "782.280.285-87", dataNascimento: "1979-04-22" },
  { nome: "DIEGO NOVAES DOS ANJOS", cpf: "816.754.285-53", dataNascimento: "1982-12-09" },
  { nome: "ELTON ALMEIDA DE JESUS", cpf: "857.806.415-10", dataNascimento: "1999-12-02" },
  { nome: "EMILLY KAROLINA DA SILVA FERREIRA", cpf: "093.439.745-74", dataNascimento: "2001-08-30" },
  { nome: "EMMANUEL DE OLIVEIRA MONTEIRO", cpf: "978.777.005-04", dataNascimento: "1980-09-01" },
  { nome: "ERIK DE MORAES PINA DE CARVALHO", cpf: "859.172.555-71", dataNascimento: "1996-11-11" },
  { nome: "FABIOLA SILVA DOS SANTOS", cpf: "780.311.415-68", dataNascimento: "1979-12-06" },
  { nome: "FERNANDO LIMA RODRIGUES", cpf: "843.624.725-68", dataNascimento: "1988-03-17" },
  { nome: "FILIPE DE SA FALCAO", cpf: "066.810.655-70", dataNascimento: "1997-10-04" },
  { nome: "GABRIEL AGUADE DO COUTO", cpf: "944.139.165-49", dataNascimento: "1977-12-30" },
  { nome: "GABRIEL BOMFIM DE OLIVEIRA", cpf: "064.002.705-90", dataNascimento: "2006-02-13" },
  { nome: "GABRIEL LUIGI SILVA ROCHA", cpf: "060.322.545-42", dataNascimento: "1999-01-17" },
  { nome: "GEOVANA MICKAELA CAMPOS AMORIM", cpf: "068.646.855-43", dataNascimento: "2003-07-08" },
  { nome: "GERIEL DOS SANTOS CASTRO SOARES", cpf: "014.378.555-98", dataNascimento: "1986-01-31" },
  { nome: "GLEDSON SANTIAGO DOS SANTOS", cpf: "066.230.655-47", dataNascimento: "1994-07-26" },
  { nome: "GRIMALDO TOSTENBERG SILVA", cpf: "175.123.445-20", dataNascimento: "1960-11-05" },
  { nome: "GUILHERME DE SOUZA DORTAS MATOS", cpf: "078.880.005-17", dataNascimento: "2005-03-25" },
  { nome: "HENRIQUE MOURA VIANA", cpf: "089.065.205-47", dataNascimento: "2004-01-31" },
  { nome: "IGOR SANTOS SILVA", cpf: "074.151.635-75", dataNascimento: "1995-11-28" },
  { nome: "ISIS TEIXEIRA E SILVA", cpf: "063.527.185-07", dataNascimento: "1997-12-16" },
  { nome: "ISRAEL DOS SANTOS XAVIER", cpf: "071.630.825-84", dataNascimento: "1996-05-02" },
  { nome: "IVAN DE JESUS NEVES", cpf: "920.535.725-15", dataNascimento: "1976-09-15" },
  { nome: "JACKSON SANTOS NASCIMENTO", cpf: "064.144.235-13", dataNascimento: "1997-03-26" },
  { nome: "JAVIER RODRIGUEZ PEREZ", cpf: "669.085.825-15", dataNascimento: "1974-07-17" },
  { nome: "JERONIMO SOARES CHAVES", cpf: "007.682.765-86", dataNascimento: "1983-01-29" },
  { nome: "JORGE ASSIS DE SANTANA JUNIOR", cpf: "799.919.985-00", dataNascimento: "1978-03-12" },
  { nome: "JOSÉ ALBERTO DA SILVA NASCIMENTO", cpf: "033.516.575-36", dataNascimento: "1988-06-15" },
  { nome: "JOSE EDUARDO DOS SANTOS NUNES", cpf: "042.989.675-14", dataNascimento: "1989-01-24" },
  { nome: "JOSE PERICLES MONTEIRO GOMES JUNIOR", cpf: "831.405.735-53", dataNascimento: "1981-10-24" },
  { nome: "KAILAN DE SOUZA DIAS", cpf: "104.089.725-80", dataNascimento: "2004-03-11" },
  { nome: "LEONARDO CARVALHO DE OLIVEIRA", cpf: "075.318.435-44", dataNascimento: "2000-03-15" },
  { nome: "LOURINALDO SILVA CORDEIRO DE PONTE", cpf: "045.470.645-63", dataNascimento: "1990-02-03" },
  { nome: "LUCIANO SANTOS SANTANA", cpf: "921.911.505-00", dataNascimento: "1977-09-30" },
  { nome: "LUIZ WINNTOU GUIMARAES CAMERA", cpf: "539.897.835-72", dataNascimento: "1969-12-15" },
  { nome: "MARCEL DE OLIVEIRA SOUZA", cpf: "077.067.625-13", dataNascimento: "1997-04-08" },
  { nome: "MARCELO SILVA SANTOS", cpf: "673.532.905-87", dataNascimento: "1980-09-04" },
  { nome: "MARCELO SILVA SOUZA", cpf: "055.470.355-64", dataNascimento: "1996-01-15" },
  { nome: "MARCO ANTONIO BARRETO DOS SANTOS", cpf: "087.084.505-52", dataNascimento: "2001-08-15" },
  { nome: "MARCOS GABRIEL SANTANA DOS SANTOS", cpf: "862.005.655-70", dataNascimento: "2000-01-26" },
  { nome: "MARIA EDUARDA PAMPONET RAMALHO", cpf: "068.568.675-22", dataNascimento: "2004-08-24" },
  { nome: "MARIANA BOMFIM ARAUJO SILVA", cpf: "800.336.955-04", dataNascimento: "1979-09-23" },
  { nome: "MAYANA LIMA DOS SANTOS", cpf: "037.007.375-48", dataNascimento: "1988-05-02" },
  { nome: "MILENA DE ANDRADE", cpf: "942.003.785-15", dataNascimento: "1979-04-25" },
  { nome: "MURILO SILVA SOUZA", cpf: "051.680.755-25", dataNascimento: "1989-10-29" },
  { nome: "NADJA ALINE SOARES LARANJEIRA", cpf: "047.349.115-09", dataNascimento: "1989-06-04" },
  { nome: "NAIARA DIOGENS SANTOS DA SILVA", cpf: "016.808.555-06", dataNascimento: "1987-08-26" },
  { nome: "NEILTON COSTA MAIA", cpf: "686.689.705-00", dataNascimento: "1975-05-28" },
  { nome: "PAMELA TAIANE AMORIM REGO", cpf: "082.715.745-23", dataNascimento: "1999-10-15" },
  { nome: "PHELIPE MACEL RIOS DOS SANTOS", cpf: "064.427.785-84", dataNascimento: "1995-11-06" },
  { nome: "RAFAELA OLIVEIRA DE ARAUJO", cpf: "056.200.395-95", dataNascimento: "1995-12-30" },
  { nome: "RAMON PARAGUASSU RANGEL CARDOSO", cpf: "018.883.285-84", dataNascimento: "1989-02-08" },
  { nome: "RICARDO DE QUEIROZ RIGUEIRA", cpf: "932.204.645-72", dataNascimento: "1976-07-12" },
  { nome: "RICARDO HENRIQUE MONTEIRO DOS SANTOS", cpf: "809.424.585-91", dataNascimento: "1983-03-13" },
  { nome: "RICARDO TRINDADE LUZ", cpf: "668.733.555-34", dataNascimento: "1973-05-04" },
  { nome: "ROBSON ANTONIO OLIVEIRA DE SOUZA", cpf: "507.104.195-20", dataNascimento: "1967-05-30" },
  { nome: "ROMEU DIAS ROCHA", cpf: "705.220.594-73", dataNascimento: "1995-04-14" },
  { nome: "RONALDO SANTOS SACRAMENTO", cpf: "419.699.955-72", dataNascimento: "1969-03-24" },
  { nome: "SHEILA MACEDO DA SILVA", cpf: "072.816.425-63", dataNascimento: "1997-06-04" },
  { nome: "SILENIO VIANA LEITE NETO", cpf: "092.173.285-61", dataNascimento: "2003-11-24" },
  { nome: "SUELISON DOS SANTOS ROSA", cpf: "101.005.265-94", dataNascimento: "2003-02-10" },
  { nome: "TAINA NERI XAVIER DA SILVA SANTOS", cpf: "077.874.405-11", dataNascimento: "1999-04-19" },
  { nome: "TALITA OLIVEIRA GOMES", cpf: "039.746.835-00", dataNascimento: "1990-03-14" },
  { nome: "THIAGO KELLYSSON BDA ROCHA SILVAAAA", cpf: "023.152.725-05", dataNascimento: "1986-12-13" },
  { nome: "THIAGO TELES SILVA", cpf: "060.822.575-45", dataNascimento: "1997-11-11" },
  { nome: "TIAGO DE AMORIM DIAS", cpf: "064.049.025-59", dataNascimento: "1994-10-02" },
  { nome: "TIAGO DE BARROS MEIRELES", cpf: "025.777.015-19", dataNascimento: "1986-09-12" },
  { nome: "VIVIANNE GOMES DE ANDRADE", cpf: "949.600.202-10", dataNascimento: "1987-06-03" },
  { nome: "WASHINGTON LUIZ ALVES", cpf: "004.965.065-36", dataNascimento: "1977-11-28" },
  { nome: "WEDSON ANDRADE FREIRE", cpf: "636.069.925-72", dataNascimento: "1973-07-04" },
  { nome: "WELLINGTON GAUTAMA COSTA BORGES JR", cpf: "072.169.725-97", dataNascimento: "1998-02-10" },
  { nome: "WILLIAN SILVA SOUZA", cpf: "088.062.035-84", dataNascimento: "2000-07-31" },
  { nome: "WILLMS SANTOS SILVA", cpf: "019.544.505-83", dataNascimento: "1986-03-14" },
  { nome: "YANA BARRETO LUIZ SIMINA", cpf: "055.304.525-31", dataNascimento: "2003-04-17" },
];

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log(`Conectado ao banco. Total de segurados: ${segurados.length}`);

  // Buscar ID da empresa Sudoeste
  const [empresasRows] = await conn.execute("SELECT id, nome FROM empresas WHERE LOWER(nome) LIKE '%sudoeste%'");
  const empresas = empresasRows;
  if (!empresas.length) { console.error("Empresa Sudoeste não encontrada!"); process.exit(1); }
  const sudoesteId = empresas[0].id;
  console.log(`Empresa Sudoeste: ID=${sudoesteId}, Nome=${empresas[0].nome}`);

  let atualizados = 0;
  let naoEncontrados = [];

  for (const s of segurados) {
    // Normalizar nome: remover acentos e comparar de forma flexível
    const nomeLimpo = s.nome.replace(/[^a-zA-Z\s]/g, "").trim().toUpperCase();
    const partes = nomeLimpo.split(" ").filter(p => p.length > 2);
    
    // Buscar por CPF primeiro (mais preciso)
    const cpfLimpo = s.cpf.replace(/[.\-]/g, "");
    
    // Tentar por CPF
    const [porCpf] = await conn.execute(
      "SELECT id, nome FROM colaboradores WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? AND empresaId = ?",
      [cpfLimpo, sudoesteId]
    );
    
    let colabId = null;
    let colabNome = null;
    
    if (porCpf.length > 0) {
      colabId = porCpf[0].id;
      colabNome = porCpf[0].nome;
    } else {
      // Tentar por nome (primeiras 2 palavras significativas)
      if (partes.length >= 2) {
        const [porNome] = await conn.execute(
          `SELECT id, nome FROM colaboradores WHERE empresaId = ? AND UPPER(nome) LIKE ? LIMIT 1`,
          [sudoesteId, `%${partes[0]}%${partes[1]}%`]
        );
        if (porNome.length > 0) {
          colabId = porNome[0].id;
          colabNome = porNome[0].nome;
        }
      }
    }

    if (colabId) {
      await conn.execute(
        `UPDATE colaboradores SET 
          cpf = ?, 
          dataNascimento = ?, 
          temSeguroVida = 1, 
          valorSeguroVida = '9.45'
        WHERE id = ?`,
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
