import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema.ts';
import dotenv from 'dotenv';
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

// ID 122 = BEATRIZ PAULINA PEREIRA RABELO
// Corrigir: remover valorFixoQ1 (estava substituindo VR), configurar vtFixoQ1=223.20
// VR deve ser calculado normalmente por dias úteis (valorVR = 39.52)
await db.update(schema.colaboradores)
  .set({
    valorFixoQ1: null,   // remover valor fixo de VR Q1 (estava errado)
    valorFixoQ2: null,   // garantir que VR Q2 também está limpo
    valorFixoQuinzenal: null, // garantir que não tem fixo geral
    valorVR: '39.52',    // VR normal por dias úteis
    vtFixoQ1: '223.20',  // VT fixo R$223,20 apenas na 1ª quinzena
    vtFixoQ2: '0.00',    // VT R$0 na 2ª quinzena
  })
  .where(eq(schema.colaboradores.id, 122));

// Confirmar
const confirmacao = await db.select({
  id: schema.colaboradores.id,
  nome: schema.colaboradores.nome,
  valorVR: schema.colaboradores.valorVR,
  valorVT: schema.colaboradores.valorVT,
  valorFixoQ1: schema.colaboradores.valorFixoQ1,
  valorFixoQ2: schema.colaboradores.valorFixoQ2,
  valorFixoQuinzenal: schema.colaboradores.valorFixoQuinzenal,
  vtFixoQ1: schema.colaboradores.vtFixoQ1,
  vtFixoQ2: schema.colaboradores.vtFixoQ2,
})
  .from(schema.colaboradores)
  .where(eq(schema.colaboradores.id, 122));

console.log('Beatriz após correção:', JSON.stringify(confirmacao, null, 2));
