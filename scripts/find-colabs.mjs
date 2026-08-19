import mysql2 from 'mysql2/promise';
const url = process.env.DATABASE_URL;
const conn = await mysql2.createConnection(url);
const [rows] = await conn.query(
  "SELECT id, nome FROM colaboradores WHERE nome LIKE ? OR nome LIKE ? OR nome LIKE ? OR nome LIKE ? OR nome LIKE ? OR nome LIKE ?",
  ['%Jeronimo%', '%Thiago%', '%Washington%', '%Diego%', '%Marco%', '%Nelson%']
);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
