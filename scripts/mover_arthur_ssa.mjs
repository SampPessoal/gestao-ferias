import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema.ts';
import dotenv from 'dotenv';
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

// Atualizar setor do Luís Arthur (ID 180003) para Fábrica SSA (ID 30003)
await db.update(schema.colaboradores)
  .set({ setorId: 30003 })
  .where(eq(schema.colaboradores.id, 180003));

// Confirmar a atualização
const result = await db.select({ id: schema.colaboradores.id, nome: schema.colaboradores.nome, setorId: schema.colaboradores.setorId })
  .from(schema.colaboradores)
  .where(eq(schema.colaboradores.id, 180003));

console.log('Atualizado:', JSON.stringify(result, null, 2));
