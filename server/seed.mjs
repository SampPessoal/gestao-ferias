import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = "/home/ubuntu/colaboradores.json";

// Normalizar nome do setor para exibição amigável
function normalizeSetorName(raw) {
  const map = {
    "CAMAÇARILIVE": "Camaçari Live",
    "DEVCONTABILIDADE.": "Dev Contabilidade",
    "DEVFOLHA.": "Dev Folha",
    "DEVMATERIAS.": "Dev Matérias",
    "DEVTRIBUTOS.": "Dev Tributos",
    "FABRICAFREIRE": "Fábrica Freire",
    "FABRICAJOANES": "Fábrica Joanes",
    "FABRICASEDUR": "Fábrica Sedur",
    "FABRICASOLAR": "Fábrica Solar",
    "FABRICASSA": "Fábrica SSA",
    "FREIRE": "Freire",
    "FÁBRICAFSA": "Fábrica FSA",
    "FÁBRICAPA": "Fábrica PA",
    "FÁBRICASAÚDE": "Fábrica Saúde",
    "FÁBRICATRANSALVADOR2025": "Fábrica TransSalvador",
    "INFRA": "Infraestrutura",
    "JOANES": "Joanes",
    "SEFAS2": "SEFAZ 2",
    "SEFAZ1": "SEFAZ 1",
    "SMEDAL": "SMED AL",
    "SMEDSSA": "SMED SSA",
    "SOLAR": "Solar",
    "SUDOESTELIVE": "Sudoeste Live",
    "SUPCONTABILIDADE": "Sup. Contabilidade",
    "SUPFOLHA": "Sup. Folha",
    "SUPGERAL": "Sup. Geral",
    "SUPMATERIAS": "Sup. Matérias",
    "SUPTRIBUTOS": "Sup. Tributos",
    "TIMECOMERCIAL": "Time Comercial",
    "TIMECOMERCIALFREIRE": "Time Comercial Freire",
    "TIMECOPA": "Time Copa",
    "TIMEDAE": "Time DAE",
    "TIMEFINANCEIRO": "Time Financeiro",
    "TIMERH": "Time RH",
    "TIMESAÚDE": "Time Saúde",
  };
  return map[raw] || raw;
}

function parseDate(val) {
  if (!val || val === "null" || val === "nan") return null;
  try {
    const s = String(val).trim();
    // Aceitar apenas datas no formato YYYY-MM-DD ou DD/MM/YYYY
    let d;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      d = new Date(s + 'T00:00:00Z');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split('/');
      d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    } else {
      return null;
    }
    if (isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    if (year < 1900 || year > 2100) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parseVenda(val) {
  if (!val || val === "null" || val === "nan") return null;
  const v = String(val).toUpperCase().trim();
  if (v === "SIM") return "SIM";
  if (v === "NÃO" || v === "NAO" || v === "NÃO") return "NÃO";
  return null;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  console.log("🔄 Iniciando seed de dados...");

  // Limpar dados existentes
  await connection.execute("DELETE FROM colaboradores");
  await connection.execute("DELETE FROM setores");
  console.log("🗑️  Dados anteriores removidos.");

  // Ler dados do JSON
  const raw = readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(raw);

  // Coletar setores únicos
  const setoresRaw = [...new Set(data.map((r) => r.setor))].sort();

  // Inserir setores
  const setorMap = {};
  for (const s of setoresRaw) {
    const nome = normalizeSetorName(s);
    const [result] = await connection.execute(
      "INSERT INTO setores (nome) VALUES (?)",
      [nome]
    );
    setorMap[s] = result.insertId;
    console.log(`  ✅ Setor: ${nome} (id=${result.insertId})`);
  }

  // Inserir colaboradores
  let count = 0;
  for (const r of data) {
    const setorId = setorMap[r.setor];
    if (!setorId) continue;

    await connection.execute(
      `INSERT INTO colaboradores 
        (nome, setorId, admissao, periodoAquisitivo, vencimento, dataLimite, diasDireito, saldo, venda10, fracionada, planejamento1, planejamento2, planejamento3)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.nome,
        setorId,
        parseDate(r.admissao),
        parseDate(r.periodo_aquisitivo),
        parseDate(r.vencimento),
        parseDate(r.data_limite),
        r.dias_direito ? parseInt(r.dias_direito) : 30,
        r.saldo ? parseInt(r.saldo) : 30,
        parseVenda(r.venda_10),
        r.fracionada && r.fracionada !== "null" ? r.fracionada : null,
        r.planejamento_1 && r.planejamento_1 !== "null" ? r.planejamento_1 : null,
        r.planejamento_2 && r.planejamento_2 !== "null" ? r.planejamento_2 : null,
        r.planejamento_3 && r.planejamento_3 !== "null" ? r.planejamento_3 : null,
      ]
    );
    count++;
  }

  console.log(`\n✅ Seed concluído! ${count} colaboradores importados em ${setoresRaw.length} setores.`);
  await connection.end();
}

main().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
