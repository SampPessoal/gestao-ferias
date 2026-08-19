import { getDb } from '../server/db';
import { colaboradores, setores, empresas } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'fs';

const db = await getDb();
const rows = await db.select({
    id: colaboradores.id,
    nome: colaboradores.nome,
    setorNome: setores.nome,
    empresaNome: empresas.nome,
    valorVR: colaboradores.valorVR,
    valorVT: colaboradores.valorVT,
    valorFixoQuinzenal: colaboradores.valorFixoQuinzenal,
    setorBeneficio: colaboradores.setorBeneficio,
    status: colaboradores.status,
})
.from(colaboradores)
.leftJoin(setores, eq(colaboradores.setorId, setores.id))
.leftJoin(empresas, eq(setores.empresaId, empresas.id))
.orderBy(empresas.nome, setores.nome, colaboradores.nome);

writeFileSync('/home/ubuntu/scripts/banco_colaboradores.json', JSON.stringify(rows, null, 2));
console.log(`Salvo ${rows.length} registros`);
process.exit(0);
