import { drizzle } from 'drizzle-orm/mysql2';
import { like, eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema.ts';
import dotenv from 'dotenv';
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

// Buscar Beatriz Rabelo
const colabs = await db.select({ id: schema.colaboradores.id, nome: schema.colaboradores.nome, setorId: schema.colaboradores.setorId, valorFixoQ1: schema.colaboradores.valorFixoQ1, valorFixoQ2: schema.colaboradores.valorFixoQ2 })
  .from(schema.colaboradores)
  .where(like(schema.colaboradores.nome, '%BEATRIZ%RABELO%'));

console.log('Encontrado:', JSON.stringify(colabs, null, 2));

if (colabs.length === 0) {
  // Tentar busca mais ampla
  const colabs2 = await db.select({ id: schema.colaboradores.id, nome: schema.colaboradores.nome, setorId: schema.colaboradores.setorId })
    .from(schema.colaboradores)
    .where(like(schema.colaboradores.nome, '%BEATRIZ%'));
  console.log('Busca ampla BEATRIZ:', JSON.stringify(colabs2, null, 2));
} else {
  // Atualizar valorFixoQ1 = 223.20 e garantir valorFixoQ2 = null (não recebe na Q2)
  await db.update(schema.colaboradores)
    .set({ valorFixoQ1: '223.20', valorFixoQ2: null, valorFixoQuinzenal: null })
    .where(eq(schema.colaboradores.id, colabs[0].id));
  
  const confirmacao = await db.select({ id: schema.colaboradores.id, nome: schema.colaboradores.nome, valorFixoQ1: schema.colaboradores.valorFixoQ1, valorFixoQ2: schema.colaboradores.valorFixoQ2, valorFixoQuinzenal: schema.colaboradores.valorFixoQuinzenal })
    .from(schema.colaboradores)
    .where(eq(schema.colaboradores.id, colabs[0].id));
  console.log('Após atualização:', JSON.stringify(confirmacao, null, 2));
}
