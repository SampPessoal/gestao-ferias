// Importação das movimentações de março/2026
// FREIRE: TIAGO SANTOS DA CONCEIÇÃO (ID=22) - Seguro de Vida + Plano de Saúde
// SUDOESTE: BEATRIZ PAULINA PEREIRA RABELO (ID=122) - Auxílio Notebook
// SUDOESTE: CICERO RICARDO FARIAS DE LIMA JUNIOR (ID=67) - Plano de Saúde

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log('Conectado ao banco de dados');

  const competenciaMes = 3;
  const competenciaAno = 2026;
  const createdByUserId = null;
  const createdByNome = 'Importação Março/2026';

  try {
    // 1. FREIRE - TIAGO SANTOS DA CONCEIÇÃO - Seguro de Vida INCLUIR
    // Tabela: id, colaboradorId, nomeColaborador, empresa, tipo, data(obrigatório), observacao, createdByUserId, createdByNome, competenciaMes, competenciaAno
    console.log('\n[1/4] Inserindo Seguro de Vida - TIAGO SANTOS DA CONCEIÇÃO (FREIRE)...');
    const [r1] = await conn.execute(`
      INSERT INTO movimentacaoSeguroVida
        (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      22,
      'TIAGO SANTOS DA CONCEICAO',
      'FREIRE',
      'incluir',
      '2026-03-01',
      'Valor: R$ 11,90',
      competenciaMes,
      competenciaAno,
      createdByUserId,
      createdByNome
    ]);
    console.log(`  OK - insertId: ${r1.insertId}`);

    // 2. FREIRE - TIAGO SANTOS DA CONCEIÇÃO - Plano de Saúde INCLUIR
    // Tabela: id, colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, dataNascimento, valor, observacao, createdByUserId, createdByNome, competenciaMes, competenciaAno
    console.log('\n[2/4] Inserindo Plano de Saúde - TIAGO SANTOS DA CONCEIÇÃO (FREIRE)...');
    const [r2] = await conn.execute(`
      INSERT INTO movimentacaoPlanoSaude
        (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      22,
      'TIAGO SANTOS DA CONCEICAO',
      'FREIRE',
      'incluir',
      'ENF PRATA',
      'titular',
      162.51,
      '30 anos',
      competenciaMes,
      competenciaAno,
      createdByUserId,
      createdByNome
    ]);
    console.log(`  OK - insertId: ${r2.insertId}`);

    // 3. SUDOESTE - BEATRIZ PAULINA PEREIRA RABELO - Auxílio Notebook INCLUIR
    // Tabela: id, colaboradorId, nomeColaborador, empresa, setor, tipo, dataInicio(obrigatório), valor, observacao, createdByUserId, createdByNome, competenciaMes, competenciaAno
    console.log('\n[3/4] Inserindo Auxílio Notebook - BEATRIZ PAULINA PEREIRA RABELO (SUDOESTE)...');
    const [r3] = await conn.execute(`
      INSERT INTO movimentacaoAuxilioNotebook
        (colaboradorId, nomeColaborador, empresa, tipo, dataInicio, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      122,
      'BEATRIZ PAULINA PEREIRA RABELO',
      'SUDOESTE',
      'incluir',
      '2026-03-10',
      competenciaMes,
      competenciaAno,
      createdByUserId,
      createdByNome
    ]);
    console.log(`  OK - insertId: ${r3.insertId}`);

    // 4. SUDOESTE - CICERO RICARDO FARIAS DE LIMA JUNIOR - Plano de Saúde INCLUIR
    console.log('\n[4/4] Inserindo Plano de Saúde - CICERO RICARDO FARIAS DE LIMA JUNIOR (SUDOESTE)...');
    const [r4] = await conn.execute(`
      INSERT INTO movimentacaoPlanoSaude
        (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      67,
      'CICERO RICARDO FARIAS DE LIMA JUNIOR',
      'SUDOESTE',
      'incluir',
      'ENF PRATA',
      'titular',
      111.06,
      '22 anos',
      competenciaMes,
      competenciaAno,
      createdByUserId,
      createdByNome
    ]);
    console.log(`  OK - insertId: ${r4.insertId}`);

    console.log('\n✅ Importação de março/2026 concluída com sucesso! 4 registros inseridos.');
  } catch (err) {
    console.error('Erro durante importação:', err);
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
