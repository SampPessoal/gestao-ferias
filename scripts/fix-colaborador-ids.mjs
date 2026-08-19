import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL || '');
  
  console.log('=== Corrigindo colaboradorId nulo em movimentacaoAuxilioNotebook ===');
  
  // Buscar todos os registros com colaboradorId nulo no Notebook
  const [nbRows] = await conn.execute(
    'SELECT id, nomeColaborador FROM movimentacaoAuxilioNotebook WHERE colaboradorId IS NULL'
  );
  console.log(`Registros com colaboradorId nulo no Notebook: ${nbRows.length}`);
  
  let nbFixed = 0, nbNotFound = 0;
  for (const row of nbRows) {
    // Buscar colaborador pelo nome (case insensitive, match parcial dos primeiros 2 tokens)
    const [colabs] = await conn.execute(
      'SELECT id, nome FROM colaboradores WHERE UPPER(nome) = UPPER(?)',
      [row.nomeColaborador.trim()]
    );
    if (colabs.length === 1) {
      await conn.execute(
        'UPDATE movimentacaoAuxilioNotebook SET colaboradorId = ? WHERE id = ?',
        [colabs[0].id, row.id]
      );
      nbFixed++;
    } else if (colabs.length === 0) {
      // Tentar match parcial com primeiros 3 tokens
      const tokens = row.nomeColaborador.trim().split(/\s+/).slice(0, 3).join(' ');
      const [colabs2] = await conn.execute(
        'SELECT id, nome FROM colaboradores WHERE UPPER(nome) LIKE UPPER(?)',
        [`%${tokens}%`]
      );
      if (colabs2.length === 1) {
        await conn.execute(
          'UPDATE movimentacaoAuxilioNotebook SET colaboradorId = ? WHERE id = ?',
          [colabs2[0].id, row.id]
        );
        nbFixed++;
        console.log(`  Notebook parcial: "${row.nomeColaborador}" -> "${colabs2[0].nome}" (id=${colabs2[0].id})`);
      } else {
        nbNotFound++;
        console.log(`  NÃO ENCONTRADO Notebook: "${row.nomeColaborador}" (${colabs2.length} matches)`);
      }
    } else {
      nbNotFound++;
      console.log(`  MÚLTIPLOS Notebook: "${row.nomeColaborador}" (${colabs.length} matches)`);
    }
  }
  console.log(`Notebook: ${nbFixed} corrigidos, ${nbNotFound} não encontrados`);
  
  console.log('\n=== Corrigindo colaboradorId nulo em movimentacaoAuxilioCreche ===');
  
  const [crRows] = await conn.execute(
    'SELECT id, nomeColaborador FROM movimentacaoAuxilioCreche WHERE colaboradorId IS NULL'
  );
  console.log(`Registros com colaboradorId nulo no Creche: ${crRows.length}`);
  
  let crFixed = 0, crNotFound = 0;
  for (const row of crRows) {
    const [colabs] = await conn.execute(
      'SELECT id, nome FROM colaboradores WHERE UPPER(nome) = UPPER(?)',
      [row.nomeColaborador.trim()]
    );
    if (colabs.length === 1) {
      await conn.execute(
        'UPDATE movimentacaoAuxilioCreche SET colaboradorId = ? WHERE id = ?',
        [colabs[0].id, row.id]
      );
      crFixed++;
    } else {
      const tokens = row.nomeColaborador.trim().split(/\s+/).slice(0, 3).join(' ');
      const [colabs2] = await conn.execute(
        'SELECT id, nome FROM colaboradores WHERE UPPER(nome) LIKE UPPER(?)',
        [`%${tokens}%`]
      );
      if (colabs2.length === 1) {
        await conn.execute(
          'UPDATE movimentacaoAuxilioCreche SET colaboradorId = ? WHERE id = ?',
          [colabs2[0].id, row.id]
        );
        crFixed++;
        console.log(`  Creche parcial: "${row.nomeColaborador}" -> "${colabs2[0].nome}" (id=${colabs2[0].id})`);
      } else {
        crNotFound++;
        console.log(`  NÃO ENCONTRADO Creche: "${row.nomeColaborador}" (${colabs2.length} matches)`);
      }
    }
  }
  console.log(`Creche: ${crFixed} corrigidos, ${crNotFound} não encontrados`);
  
  await conn.end();
  console.log('\nConcluído!');
}

main().catch(console.error);
