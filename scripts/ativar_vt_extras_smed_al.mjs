import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema.ts';
import dotenv from 'dotenv';
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

// Buscar colaboradores da Fábrica Smed Alagoas (setorId = 30005)
const colabs = await db.select({ id: schema.colaboradores.id, nome: schema.colaboradores.nome, setorId: schema.colaboradores.setorId, vtDiasExtrasQ2: schema.colaboradores.vtDiasExtrasQ2 })
  .from(schema.colaboradores)
  .where(eq(schema.colaboradores.setorId, 30005));

console.log('Colaboradores Fábrica Smed AL:', JSON.stringify(colabs, null, 2));

// Atualizar vtDiasExtrasQ2 = 1 para todos do setor
await db.update(schema.colaboradores)
  .set({ vtDiasExtrasQ2: 1 })
  .where(eq(schema.colaboradores.setorId, 30005));

// Confirmar
const confirmacao = await db.select({ id: schema.colaboradores.id, nome: schema.colaboradores.nome, vtDiasExtrasQ2: schema.colaboradores.vtDiasExtrasQ2 })
  .from(schema.colaboradores)
  .where(eq(schema.colaboradores.setorId, 30005));

console.log('Após atualização:', JSON.stringify(confirmacao, null, 2));
