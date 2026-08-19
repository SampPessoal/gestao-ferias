import { drizzle } from 'drizzle-orm/mysql2';
import { like, eq } from 'drizzle-orm';
import * as schema from '../drizzle/schema.ts';
import dotenv from 'dotenv';
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

// Buscar colaborador com ARTHUR no nome
const colabs = await db.select({ id: schema.colaboradores.id, nome: schema.colaboradores.nome, setorId: schema.colaboradores.setorId })
  .from(schema.colaboradores)
  .where(like(schema.colaboradores.nome, '%ARTHUR%'));

// Buscar setores com SALVADOR no nome
const setsResult = await db.select({ id: schema.setores.id, nome: schema.setores.nome })
  .from(schema.setores)
  .where(like(schema.setores.nome, '%SALVADOR%'));

console.log('COLABORADORES:', JSON.stringify(colabs, null, 2));
console.log('SETORES SALVADOR:', JSON.stringify(setsResult, null, 2));
