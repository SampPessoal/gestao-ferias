import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

const colaboradores = [
  { nome: 'DAVI SANTOS BORGENS',           cpf: '033.542.945-90', dataNascimento: '1984-02-28' },
  { nome: 'GUSTAVO BARBOSA DOS SANTOS',    cpf: '852.430.195-34', dataNascimento: '1999-12-27' },
  { nome: 'JEFERSON SUNDERLANDE DE OLIVEIRA', cpf: '820.451.195-72', dataNascimento: '1983-04-24' },
  { nome: 'JOÃO VITOR PRATES CERQUEIRA',   cpf: '098.393.145-30', dataNascimento: '2008-03-11' },
  { nome: 'JOSE DOS ANJOS BATISTA',        cpf: '988.192.165-15', dataNascimento: '1979-10-14' },
];

const valor = '12.50';

// Buscar empresa Solar
const [empresas] = await conn.query("SELECT id, nome FROM empresas WHERE nome LIKE '%SOLAR%' OR nome LIKE '%Solar%' LIMIT 5");
console.log('Empresas Solar encontradas:', JSON.stringify(empresas));

let atualizados = 0;
let naoEncontrados = [];

for (const c of colaboradores) {
  // Busca por nome normalizado (sem acento, case-insensitive)
  const nomeBusca = c.nome.replace(/[ÁÀÂÃ]/g, 'A').replace(/[ÉÈÊ]/g, 'E').replace(/[ÍÌÎ]/g, 'I').replace(/[ÓÒÔÕ]/g, 'O').replace(/[ÚÙÛ]/g, 'U').replace(/Ç/g, 'C');
  
  const [rows] = await conn.query(
    "SELECT id, nome FROM colaboradores WHERE UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(nome, 'Á','A'), 'É','E'), 'Í','I'), 'Ó','O'), 'Ú','U'), 'Ã','A')) LIKE ? LIMIT 3",
    [`%${nomeBusca.split(' ').slice(0, 2).join('%')}%`]
  );
  
  if (rows.length === 0) {
    naoEncontrados.push(c.nome);
    console.log(`❌ Não encontrado: ${c.nome}`);
    continue;
  }
  
  for (const row of rows) {
    await conn.query(
      "UPDATE colaboradores SET cpf = ?, dataNascimento = ?, temSeguroVida = 1, valorSeguroVida = ? WHERE id = ?",
      [c.cpf, c.dataNascimento, valor, row.id]
    );
    console.log(`✅ Atualizado: ${row.nome} (ID ${row.id}) — CPF: ${c.cpf} | Nasc: ${c.dataNascimento} | Seguro: R$ ${valor}`);
    atualizados++;
  }
}

console.log(`\nResumo: ${atualizados} atualizados, ${naoEncontrados.length} não encontrados`);
if (naoEncontrados.length > 0) console.log('Não encontrados:', naoEncontrados);

await conn.end();
