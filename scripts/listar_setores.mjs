import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../drizzle/schema.ts';
import dotenv from 'dotenv';
dotenv.config();

const db = drizzle(process.env.DATABASE_URL);
const setsResult = await db.select({ id: schema.setores.id, nome: schema.setores.nome }).from(schema.setores);
console.log(JSON.stringify(setsResult, null, 2));
