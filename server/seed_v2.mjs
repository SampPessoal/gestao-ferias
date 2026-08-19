import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log("=== SEED V2: Reimportando colaboradores ===\n");

// ─── 1. Limpar tabelas ────────────────────────────────────────────────────────
console.log("1. Limpando banco...");
await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
await db.execute(sql`TRUNCATE TABLE colaboradores`);
await db.execute(sql`TRUNCATE TABLE setores`);
await db.execute(sql`TRUNCATE TABLE empresas`);
await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
console.log("   ✓ Banco limpo");

// ─── 2. Inserir empresas ──────────────────────────────────────────────────────
console.log("\n2. Inserindo empresas...");
const empresasData = ["FREIRE", "SUDOESTE", "JOANES", "SOLAR"];
const empresaMap = {};

for (const nome of empresasData) {
  const [result] = await connection.execute(
    "INSERT INTO empresas (nome) VALUES (?)",
    [nome]
  );
  empresaMap[nome] = result.insertId;
  console.log(`   ✓ ${nome} → id ${result.insertId}`);
}

// ─── 3. Carregar colaboradores do JSON ────────────────────────────────────────
console.log("\n3. Carregando dados...");
const colaboradores = JSON.parse(
  readFileSync("/home/ubuntu/colaboradores_v2.json", "utf-8")
);
console.log(`   ${colaboradores.length} colaboradores encontrados`);

// ─── 4. Criar setores únicos por empresa ──────────────────────────────────────
console.log("\n4. Inserindo setores...");
const setorMap = {}; // "EMPRESA|SETOR" → id

const setoresUnicos = new Map();
for (const c of colaboradores) {
  const key = `${c.empresa}|${c.setor}`;
  if (!setoresUnicos.has(key)) {
    setoresUnicos.set(key, { empresa: c.empresa, setor: c.setor });
  }
}

for (const [key, { empresa, setor }] of setoresUnicos) {
  const empresaId = empresaMap[empresa];
  const [result] = await connection.execute(
    "INSERT INTO setores (nome, empresaId) VALUES (?, ?)",
    [setor, empresaId]
  );
  setorMap[key] = result.insertId;
  console.log(`   ✓ [${empresa}] ${setor} → id ${result.insertId}`);
}

// ─── 5. Inserir colaboradores ─────────────────────────────────────────────────
console.log("\n5. Inserindo colaboradores...");
let inserted = 0;
let errors = 0;

for (const c of colaboradores) {
  const empresaId = empresaMap[c.empresa] || null;
  const setorKey = `${c.empresa}|${c.setor}`;
  const setorId = setorMap[setorKey] || null;

  const admissao = c.admissao || null;
  const periodoAquisitivo = c.periodo_aquisitivo || null;
  const vencimento = c.vencimento || null;
  const dataLimite = c.data_limite || null;
  const diasDireito = c.dias_direito || 30;
  const saldo = c.saldo || diasDireito;

  try {
    await connection.execute(
      `INSERT INTO colaboradores 
       (codigo, nome, empresaId, setorId, status, admissao, periodoAquisitivo, vencimento, dataLimite, diasDireito, saldo)
       VALUES (?, ?, ?, ?, 'ativo', ?, ?, ?, ?, ?, ?)`,
      [
        c.codigo || null,
        c.nome,
        empresaId,
        setorId,
        admissao,
        periodoAquisitivo,
        vencimento,
        dataLimite,
        diasDireito,
        saldo,
      ]
    );
    inserted++;
  } catch (err) {
    console.error(`   ✗ Erro em ${c.nome}: ${err.message}`);
    errors++;
  }
}

console.log(`   ✓ ${inserted} inseridos | ✗ ${errors} erros`);

// ─── 6. Verificar resultado ───────────────────────────────────────────────────
console.log("\n6. Verificando...");
const [countResult] = await connection.execute("SELECT COUNT(*) as total FROM colaboradores");
const [setorCount] = await connection.execute("SELECT COUNT(*) as total FROM setores");
const [empCount] = await connection.execute("SELECT COUNT(*) as total FROM empresas");

console.log(`   Empresas: ${empCount[0].total}`);
console.log(`   Setores: ${setorCount[0].total}`);
console.log(`   Colaboradores: ${countResult[0].total}`);

// Por empresa
const [byEmpresa] = await connection.execute(`
  SELECT e.nome as empresa, COUNT(c.id) as total 
  FROM colaboradores c 
  JOIN empresas e ON c.empresaId = e.id 
  GROUP BY e.nome 
  ORDER BY e.nome
`);
console.log("\n   Por empresa:");
for (const row of byEmpresa) {
  console.log(`     ${row.empresa}: ${row.total}`);
}

await connection.end();
console.log("\n=== SEED V2 CONCLUÍDO ===");
