import mysql2 from 'mysql2/promise';
const url = process.env.DATABASE_URL;
const conn = await mysql2.createConnection(url);
const [rows] = await conn.query("SELECT id, nome FROM colaboradores ORDER BY nome");
for (const r of rows) {
  console.log(r.id, JSON.stringify(r.nome));
}
await conn.end();
