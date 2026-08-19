import { getDb } from '../server/db.ts';
import { colaboradores, setores } from '../drizzle/schema.ts';
import { like, eq } from 'drizzle-orm';

const db = getDb();
const colabs = await db.select({ id: colaboradores.id, nome: colaboradores.nome, setorId: colaboradores.setorId })
  .from(colaboradores)
  .where(like(colaboradores.nome, '%ARTHUR%'));

const setsResult = await db.select({ id: setores.id, nome: setores.nome })
  .from(setores)
  .where(like(setores.nome, '%SALVADOR%'));

console.log('COLABORADORES:', JSON.stringify(colabs, null, 2));
console.log('SETORES:', JSON.stringify(setsResult, null, 2));
