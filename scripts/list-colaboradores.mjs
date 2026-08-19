import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/([^?]+)/);
const [, user, password, host, port, database] = match;

const conn = await createConnection({
  host, port: Number(port), user, password, database,
  ssl: { rejectUnauthorized: true }
});

const [rows] = await conn.execute(`
  SELECT e.nome AS empresa, c.nome AS colaborador
  FROM colaboradores c
  JOIN empresas e ON c.empresaId = e.id
  ORDER BY e.nome, c.nome
`);

await conn.end();

const grupos = {};
for (const row of rows) {
  if (!grupos[row.empresa]) grupos[row.empresa] = [];
  grupos[row.empresa].push(row.colaborador);
}

for (const [empresa, nomes] of Object.entries(grupos)) {
  console.log(`\n=== ${empresa.toUpperCase()} — ${nomes.length} colaboradores ===`);
  nomes.forEach((n, i) => console.log(`  ${String(i + 1).padStart(3, " ")}. ${n}`));
}
