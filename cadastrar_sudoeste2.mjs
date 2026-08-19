import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const vtvr = JSON.parse(readFileSync('/tmp/vtvr_data.json', 'utf-8'));

// SUDOESTE = empresaId 2
const SUDOESTE_ID = 2;

function norm(n) {
  return n.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g,' ').trim();
}

// Buscar benefícios na planilha
const kayla   = vtvr.find(r => norm(r.nome).includes('KAYLA'));
const lucas   = vtvr.find(r => norm(r.nome).includes('LUCAS') && norm(r.nome).includes('KELVIM'));
const luiz    = vtvr.find(r => norm(r.nome).includes('LUIZ') && norm(r.nome).includes('ARTHUR'));

const colaboradores = [
  { nome: 'KAYLA DA HORA FALCÃO',         beneficio: kayla },
  { nome: 'LUCAS KELVIM SILVA CASTRO',    beneficio: lucas },
  { nome: 'LUIZ ARTHUR TAVARES DE BARROS',beneficio: luiz  },
];

console.log('Benefícios encontrados:');
for (const c of colaboradores) {
  console.log(`  ${c.nome}: ${c.beneficio ? JSON.stringify(c.beneficio) : 'não encontrado na planilha'}`);
}

let inserted = 0;
for (const c of colaboradores) {
  // Verificar se já existe
  const [existing] = await conn.execute(
    'SELECT id FROM colaboradores WHERE UPPER(nome) = ? AND empresaId = ?',
    [norm(c.nome), SUDOESTE_ID]
  );
  if (existing.length > 0) {
    console.log(`JÁ EXISTE: ${c.nome} (id=${existing[0].id})`);
    continue;
  }

  const b = c.beneficio;
  const vrStr  = b?.valorVR        != null ? b.valorVR.toFixed(2)        : null;
  const vtStr  = b?.valorVT        != null ? b.valorVT.toFixed(2)        : null;
  const auxStr = b?.auxilioVeiculo != null ? b.auxilioVeiculo.toFixed(2) : null;
  const setor  = b?.setor || null;

  const [result] = await conn.execute(
    `INSERT INTO colaboradores
      (nome, empresaId, status, diasDireito, saldo, valorVR, valorVT, auxilioVeiculo, setorBeneficio, createdAt, updatedAt)
     VALUES (?, ?, 'ativo', 30, 30, ?, ?, ?, ?, NOW(), NOW())`,
    [c.nome, SUDOESTE_ID, vrStr, vtStr, auxStr, setor]
  );
  console.log(`CADASTRADO: ${c.nome} → id=${result.insertId} VR=${vrStr} VT=${vtStr} AUX=${auxStr}`);
  inserted++;
}

console.log(`\nTotal cadastrado: ${inserted}`);
await conn.end();
