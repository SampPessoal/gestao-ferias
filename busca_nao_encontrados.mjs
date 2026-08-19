import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const nomes = [
  'CLAUDIO', 'THIAGO LIMA', 'ROSANA', 'PEDRO VINICIUS', 'CAIO NOVAIS',
  'EMILLY', 'STEFANY', 'WELLINGTON GUATAMA', 'GABRIELL', 'LUIZ ARTHUR',
  'PAMELA', 'KAYLA', 'LUCAS KELVIM', 'WEDSON', 'BEATRIZ',
  'JUAN LUIZ', 'ALAELSON', 'PETERSON', 'LAZARO', 'MARCLEY'
];

for (const n of nomes) {
  const [rows] = await conn.execute(
    `SELECT c.id, c.nome, e.nome as emp FROM colaboradores c
     LEFT JOIN empresas e ON c.empresaId=e.id
     WHERE c.status='ativo' AND UPPER(c.nome) LIKE ?`,
    ['%' + n + '%']
  );
  if (rows.length) {
    console.log(`${n}: ${rows.map(r => r.id + '|' + r.nome + '(' + (r.emp||'?') + ')').join(' / ')}`);
  } else {
    console.log(`${n}: NÃO ENCONTRADO`);
  }
}

await conn.end();
