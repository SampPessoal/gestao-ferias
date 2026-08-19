import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const data = JSON.parse(readFileSync('/tmp/vtvr_data.json', 'utf-8'));

// Mapa: nome na planilha → id no banco (encontrados manualmente)
// IDs confirmados pela busca acima
const manualMatches = [
  // planilhaNome, bancoId
  ['ROSANA MARIA S. SANTANA',       86],    // ROSANA MARIA SANTOS SANT ANA
  ['PEDRO VINICIUS TAVARES SANTO',  30001], // PEDRO VINICIUS TAVARES SANTOS FERREIRA
  ['CAIO NOVAIS DO SANTOS',         77],    // CAIO NOVAIS DOS SANTOS
  ['EMILLY KAROLINE FERREIRA',      70],    // EMILLY KAROLINA DA SILVA FERREIRA
  ['PAMELA TAYANE REGO',            31],    // PAMELA TAIANE AMORIM REGO
  ['ALAELSON DE JESUS SILVA JR.',   145],   // ALAELSON DE JESUS SANTOS JUNIOR
  ['PETERSON SOUZA ALBURQUERQUE',   148],   // PETERSON SOUZA ALBUQUERQUE
  ['JUAN LUIZ SOUSA BARBOSA',       30003], // JUAN LUIS SOUZA BARBOSA
];

// Buscar dados da planilha para cada match manual
function norm(n) {
  return n.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g,' ').trim();
}

let updated = 0;
for (const [planilhaNome, bancoId] of manualMatches) {
  const row = data.find(r => norm(r.nome) === norm(planilhaNome));
  if (!row) {
    console.log(`NÃO ACHADO NA PLANILHA: ${planilhaNome}`);
    continue;
  }
  const vrStr  = row.valorVR        != null ? row.valorVR.toFixed(2)        : null;
  const vtStr  = row.valorVT        != null ? row.valorVT.toFixed(2)        : null;
  const auxStr = row.auxilioVeiculo != null ? row.auxilioVeiculo.toFixed(2) : null;
  await conn.execute(
    `UPDATE colaboradores SET valorVR=?, valorVT=?, auxilioVeiculo=?, setorBeneficio=? WHERE id=?`,
    [vrStr, vtStr, auxStr, row.setor || null, bancoId]
  );
  console.log(`OK: "${planilhaNome}" → id=${bancoId} VR=${vrStr} VT=${vtStr} AUX=${auxStr}`);
  updated++;
}

console.log(`\nAtualizados manualmente: ${updated}`);

// Listar os que definitivamente não estão no banco
const notInDB = [
  'CLÁUDIO OLIVEIRA (FREIRE)',
  'THIAGO LIMA CEDRAZ (FREIRE)',
  'STEFANY THAIANY D. NOVAES (SUDOESTE)',
  'WELLINGTON GUATAMA JUNIOR (SUDOESTE)',
  'GABRIELL B. S. DOS SANTOS (SUDOESTE)',
  'LUIZ ARTHUR TAVARES BAROS (SUDOESTE)',
  'KAYLA DA HORA FALCÃO (SUDOESTE)',
  'LUCAS KELVIM (SUDOESTE)',
  'WEDSON FREIRE (SUDOESTE)',
  'BEATRIZ ADICIONAR: 198,40 (SUDOESTE)',
  'LÁZARO RAMON DA H.FONTES (SOLAR)',
  'MARCLEY ANDRADE (SOLAR)',
];
console.log('\nNão encontrados no banco (não cadastrados):');
notInDB.forEach(n => console.log(' -', n));

await conn.end();
