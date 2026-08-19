import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Verificar qual Sudoeste Live pertence a qual empresa
const [setores] = await conn.query(
  "SELECT s.id, s.nome, s.empresaId, e.nome as empresaNome FROM setores s LEFT JOIN empresas e ON s.empresaId = e.id WHERE s.nome LIKE '%Sudoeste Live%'"
);
console.log('Setores Sudoeste Live:', JSON.stringify(setores, null, 2));

// Ver colaboradores que já estão em Sudoeste Live para confirmar qual setor usar
const [existentes] = await conn.query(
  "SELECT c.id, c.nome, c.setorId, s.nome as setorNome, s.empresaId FROM colaboradores c JOIN setores s ON c.setorId = s.id WHERE s.nome LIKE '%Sudoeste Live%' LIMIT 5"
);
console.log('Colaboradores já em Sudoeste Live:', JSON.stringify(existentes, null, 2));

await conn.end();
