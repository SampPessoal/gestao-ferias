import fs from 'node:fs/promises';
import path from 'node:path';

const databaseDir = process.argv[2];

if (!databaseDir) {
  throw new Error('Informe a pasta database do backup.');
}

const [manifestRaw, dataRaw, schema] = await Promise.all([
  fs.readFile(path.join(databaseDir, 'manifest.json'), 'utf8'),
  fs.readFile(path.join(databaseDir, 'data.json'), 'utf8'),
  fs.readFile(path.join(databaseDir, 'schema.sql'), 'utf8'),
]);

const manifest = JSON.parse(manifestRaw);
const data = JSON.parse(dataRaw);
const tableNames = Object.keys(data.tables ?? {});
const mismatches = [];

for (const table of tableNames) {
  const expected = manifest.rowCounts?.[table];
  const actual = data.tables[table].length;
  if (expected !== actual) mismatches.push({ table, expected, actual });
}

if (tableNames.length !== manifest.tableCount) {
  mismatches.push({ table: '__total_tables__', expected: manifest.tableCount, actual: tableNames.length });
}

if (!schema.includes('CREATE TABLE')) {
  throw new Error('schema.sql não contém comandos CREATE TABLE.');
}

if (mismatches.length > 0) {
  throw new Error(`Divergências no dump: ${JSON.stringify(mismatches)}`);
}

console.log(JSON.stringify({
  valid: true,
  tableCount: tableNames.length,
  totalRows: Object.values(data.tables).reduce((total, rows) => total + rows.length, 0),
  schemaBytes: Buffer.byteLength(schema),
}, null, 2));
