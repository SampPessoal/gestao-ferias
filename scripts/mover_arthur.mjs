import { getDb } from '../server/db.ts';

const db = await getDb();

// Buscar colaborador com ARTHUR no nome
const colabs = await db.query.colaboradores.findMany({
  where: (t, { like }) => like(t.nome, '%ARTHUR%'),
  with: { setor: true }
});

// Buscar setores com SALVADOR no nome
const setsResult = await db.query.setores.findMany({
  where: (t, { like }) => like(t.nome, '%SALVADOR%')
});

console.log('COLABORADORES:', JSON.stringify(colabs.map(c => ({ id: c.id, nome: c.nome, setorId: c.setorId, setor: c.setor?.nome })), null, 2));
console.log('SETORES SALVADOR:', JSON.stringify(setsResult, null, 2));
