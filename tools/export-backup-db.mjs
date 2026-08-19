import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

const outputDir = process.argv[2];

if (!outputDir) {
  throw new Error('Informe a pasta de saída: node tools/export-backup-db.mjs <pasta>');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não está disponível no ambiente.');
}

function normalizeValue(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return { type: 'buffer-base64', value: value.toString('base64') };
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]));
}

await fs.mkdir(outputDir, { recursive: true });

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  const [tables] = await connection.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const tableKey = Object.keys(tables[0] ?? {}).find((key) => !key.toLowerCase().includes('table_type'));

  if (!tableKey) {
    throw new Error('Não foi possível identificar as tabelas do banco.');
  }

  const exportedTables = {};
  const schemaParts = [
    '-- GestãoFérias: estrutura do banco de dados',
    '-- Este arquivo não contém credenciais. Configure DATABASE_URL antes de restaurar.',
    '',
  ];

  for (const tableInfo of tables) {
    const table = tableInfo[tableKey];
    const escapedTable = `\`${String(table).replaceAll('`', '``')}\``;
    const [createRows] = await connection.query(`SHOW CREATE TABLE ${escapedTable}`);
    const createStatement = Object.values(createRows[0]).find((value) => typeof value === 'string' && value.startsWith('CREATE TABLE'));
    const [rows] = await connection.query(`SELECT * FROM ${escapedTable}`);

    schemaParts.push(`-- Tabela: ${table}`);
    schemaParts.push(`${createStatement};`);
    schemaParts.push('');

    exportedTables[table] = rows.map(normalizeRow);
  }

  const manifest = {
    application: 'GestãoFérias',
    exportedAtUtc: new Date().toISOString(),
    databaseEngine: 'MySQL/TiDB-compatible',
    tableCount: Object.keys(exportedTables).length,
    rowCounts: Object.fromEntries(Object.entries(exportedTables).map(([table, rows]) => [table, rows.length])),
    securityNotice: 'O backup contém dados pessoais, financeiros e hashes de senha. Mantenha-o protegido e não publique o arquivo.',
    restoreOrder: ['Execute database/schema.sql', 'Importe database/data.json por tabela respeitando dependências', 'Configure DATABASE_URL e demais variáveis de ambiente fora do backup'],
  };

  await fs.writeFile(path.join(outputDir, 'schema.sql'), `${schemaParts.join('\n')}\n`, 'utf8');
  await fs.writeFile(path.join(outputDir, 'data.json'), `${JSON.stringify({ manifest, tables: exportedTables }, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ tableCount: manifest.tableCount, rowCounts: manifest.rowCounts }, null, 2));
} finally {
  await connection.end();
}
