import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// IDs das empresas: FREIRE=1, SUDOESTE=2, SOLAR=4
const colaboradores = [
  { nome: 'LÁZARO RAMON DA HORA SANTOS',  empresaId: 4 }, // Solar
  { nome: 'MARCLEY LUIS ANDRADE VIANA',   empresaId: 4 }, // Solar
  { nome: 'CLÁUDIO LUIZ OLIVEIRA',        empresaId: 1 }, // Freire
  { nome: 'THIAGO LIMA CEDRAZ',           empresaId: 1 }, // Freire
  { nome: 'WEDSON ANDRADE FREIRE',        empresaId: 2 }, // Sudoeste
];

// Buscar dados de benefícios da planilha para esses colaboradores
import { readFileSync as rf } from 'fs';
const vtvr = JSON.parse(readFileSync('/tmp/vtvr_data.json', 'utf-8'));

function norm(n) {
  return n.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g,' ').trim();
}

// Mapa de nome planilha → dados
const planilhaMap = {
  'LAZARO RAMON DA H.FONTES': vtvr.find(r => norm(r.nome) === norm('LÁZARO RAMON DA H.FONTES')),
  'MARCLEY ANDRADE':          vtvr.find(r => norm(r.nome) === norm('MARCLEY ANDRADE')),
  'WEDSON FREIRE':            vtvr.find(r => norm(r.nome) === norm('WEDSON FREIRE')),
};

// Buscar por tokens para Lázaro e Marcley
const lazaro  = vtvr.find(r => norm(r.nome).includes('LAZARO') && norm(r.nome).includes('FONTES'));
const marcley = vtvr.find(r => norm(r.nome).includes('MARCLEY'));
const wedson  = vtvr.find(r => norm(r.nome).includes('WEDSON'));
const claudio = vtvr.find(r => norm(r.nome).includes('CLAUDIO') && norm(r.nome).includes('OLIVEIRA'));
const thiago  = vtvr.find(r => norm(r.nome).includes('THIAGO') && norm(r.nome).includes('CEDRAZ'));

const beneficiosMap = {
  'LÁZARO RAMON DA HORA SANTOS': lazaro,
  'MARCLEY LUIS ANDRADE VIANA':  marcley,
  'CLÁUDIO LUIZ OLIVEIRA':       claudio,
  'THIAGO LIMA CEDRAZ':          thiago,
  'WEDSON ANDRADE FREIRE':       wedson,
};

console.log('Benefícios encontrados na planilha:');
for (const [nome, b] of Object.entries(beneficiosMap)) {
  console.log(`  ${nome}: ${b ? JSON.stringify(b) : 'não encontrado'}`);
}

let inserted = 0;
for (const c of colaboradores) {
  // Verificar se já existe
  const [existing] = await conn.execute(
    'SELECT id FROM colaboradores WHERE UPPER(nome) = ? AND empresaId = ?',
    [norm(c.nome), c.empresaId]
  );
  if (existing.length > 0) {
    console.log(`JÁ EXISTE: ${c.nome} (id=${existing[0].id})`);
    continue;
  }

  const b = beneficiosMap[c.nome];
  const vrStr  = b?.valorVR        != null ? b.valorVR.toFixed(2)        : null;
  const vtStr  = b?.valorVT        != null ? b.valorVT.toFixed(2)        : null;
  const auxStr = b?.auxilioVeiculo != null ? b.auxilioVeiculo.toFixed(2) : null;
  const setor  = b?.setor || null;

  const [result] = await conn.execute(
    `INSERT INTO colaboradores
      (nome, empresaId, status, diasDireito, saldo, valorVR, valorVT, auxilioVeiculo, setorBeneficio, createdAt, updatedAt)
     VALUES (?, ?, 'ativo', 30, 30, ?, ?, ?, ?, NOW(), NOW())`,
    [c.nome, c.empresaId, vrStr, vtStr, auxStr, setor]
  );
  console.log(`CADASTRADO: ${c.nome} → id=${result.insertId} VR=${vrStr} VT=${vtStr} AUX=${auxStr}`);
  inserted++;
}

console.log(`\nTotal cadastrado: ${inserted}`);
await conn.end();
