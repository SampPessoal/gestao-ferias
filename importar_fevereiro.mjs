// Importação das movimentações de fevereiro/2026
// SUDOESTE apenas (JOANES, SOLAR e FREIRE estavam vazias)
//
// Auxílio Notebook:
//   - MARIA EDUARDA SANTOS FAUSTINO (ID=48) — incluir 05/02/2026
//   - FRANCISCO CARLOS BARRETO CARDOSO (ID=131) — incluir 12/02/2026 (obs: INCLUIR DOIS MESES)
//   - LARISSA ALVES MENEZES (ID=135) — incluir 19/02/2026
//   - HUGO CHAGAS DOS SANTOS MIGUEL (ID=134) — incluir 19/02/2026
//
// Plano de Saúde:
//   - TIAGO CAMBRAINHA ARAUJO (ID=133) — incluir ENF PRATA 22 anos R$111,06
//   - ANTHONY BIAGGI (filho de SAMELE BIAGGI, ID=160) — excluir dependente ENF PRATA 4 anos
//   - HUGO CHAGAS DOS SANTOS MIGUEL (ID=134) — incluir ENF PRATA 22 anos R$111,06
//
// Vale Transporte:
//   - LARISSA ALVES MENEZES (ID=135) — incluir
//   - HUGO CHAGAS DOS SANTOS MIGUEL (ID=134) — incluir
//   - GABRIEL LUIGI — incluir (colaborador já saiu, registro apenas para histórico)

import { createConnection } from '/home/ubuntu/ferias-manager/node_modules/.pnpm/mysql2@3.15.1/node_modules/mysql2/promise.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não definida'); process.exit(1); }

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log('Conectado ao banco de dados');

  const competenciaMes = 2;
  const competenciaAno = 2026;
  const createdByUserId = null;
  const createdByNome = 'Importação Fevereiro/2026';

  try {
    // ===== AUXÍLIO NOTEBOOK =====
    console.log('\n--- Auxílio Notebook ---');

    // 1. MARIA EDUARDA SANTOS FAUSTINO
    console.log('[1/10] Auxílio Notebook - MARIA EDUARDA SANTOS FAUSTINO...');
    const [r1] = await conn.execute(`
      INSERT INTO movimentacaoAuxilioNotebook
        (colaboradorId, nomeColaborador, empresa, tipo, dataInicio, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [48, 'MARIA EDUARDA SANTOS FAUSTINO', 'SUDOESTE', 'incluir', '2026-02-05', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r1.insertId}`);

    // 2. FRANCISCO CARLOS BARRETO CARDOSO (obs: INCLUIR DOIS MESES)
    console.log('[2/10] Auxílio Notebook - FRANCISCO CARLOS BARRETO CARDOSO...');
    const [r2] = await conn.execute(`
      INSERT INTO movimentacaoAuxilioNotebook
        (colaboradorId, nomeColaborador, empresa, tipo, dataInicio, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [131, 'FRANCISCO CARLOS BARRETO CARDOSO', 'SUDOESTE', 'incluir', '2026-02-12', 'INCLUIR DOIS MESES', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r2.insertId}`);

    // 3. LARISSA ALVES MENEZES
    console.log('[3/10] Auxílio Notebook - LARISSA ALVES MENEZES...');
    const [r3] = await conn.execute(`
      INSERT INTO movimentacaoAuxilioNotebook
        (colaboradorId, nomeColaborador, empresa, tipo, dataInicio, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [135, 'LARISSA ALVES MENEZES', 'SUDOESTE', 'incluir', '2026-02-19', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r3.insertId}`);

    // 4. HUGO CHAGAS DOS SANTOS MIGUEL
    console.log('[4/10] Auxílio Notebook - HUGO CHAGAS DOS SANTOS MIGUEL...');
    const [r4] = await conn.execute(`
      INSERT INTO movimentacaoAuxilioNotebook
        (colaboradorId, nomeColaborador, empresa, tipo, dataInicio, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [134, 'HUGO CHAGAS DOS SANTOS MIGUEL', 'SUDOESTE', 'incluir', '2026-02-19', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r4.insertId}`);

    // ===== PLANO DE SAÚDE =====
    console.log('\n--- Plano de Saúde ---');

    // 5. TIAGO CAMBRAINHA ARAUJO — incluir titular
    console.log('[5/10] Plano de Saúde - TIAGO CAMBRAINHA ARAUJO (incluir)...');
    const [r5] = await conn.execute(`
      INSERT INTO movimentacaoPlanoSaude
        (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [133, 'TIAGO CAMBRAINHA ARAUJO', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 111.06, '22 anos', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r5.insertId}`);

    // 6. ANTHONY BIAGGI (filho de SAMELE BIAGGI) — excluir dependente
    console.log('[6/10] Plano de Saúde - ANTHONY BIAGGI / SAMELE BIAGGI (excluir dependente)...');
    const [r6] = await conn.execute(`
      INSERT INTO movimentacaoPlanoSaude
        (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [160, 'SAMELE BIAGGI PARENTE', 'SUDOESTE', 'excluir', 'ENF PRATA', 'dependente', 'Dependente: ANTHONY BIAGGI (4 anos)', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r6.insertId}`);

    // 7. HUGO CHAGAS DOS SANTOS MIGUEL — incluir titular
    console.log('[7/10] Plano de Saúde - HUGO CHAGAS DOS SANTOS MIGUEL (incluir)...');
    const [r7] = await conn.execute(`
      INSERT INTO movimentacaoPlanoSaude
        (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [134, 'HUGO CHAGAS DOS SANTOS MIGUEL', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 111.06, '22 anos', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r7.insertId}`);

    // ===== VALE TRANSPORTE =====
    console.log('\n--- Vale Transporte ---');

    // 8. LARISSA ALVES MENEZES
    console.log('[8/10] VT - LARISSA ALVES MENEZES...');
    const [r8] = await conn.execute(`
      INSERT INTO movimentacaoValeTransporte
        (colaboradorId, nomeColaborador, empresa, tipo, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [135, 'LARISSA ALVES MENEZES', 'SUDOESTE', 'incluir', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r8.insertId}`);

    // 9. HUGO CHAGAS DOS SANTOS MIGUEL
    console.log('[9/10] VT - HUGO CHAGAS DOS SANTOS MIGUEL...');
    const [r9] = await conn.execute(`
      INSERT INTO movimentacaoValeTransporte
        (colaboradorId, nomeColaborador, empresa, tipo, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [134, 'HUGO CHAGAS DOS SANTOS MIGUEL', 'SUDOESTE', 'incluir', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r9.insertId}`);

    // 10. GABRIEL LUIGI — colaborador já saiu, registro apenas para histórico (colaboradorId nulo)
    console.log('[10/10] VT - GABRIEL LUIGI (ex-colaborador, sem vínculo)...');
    const [r10] = await conn.execute(`
      INSERT INTO movimentacaoValeTransporte
        (colaboradorId, nomeColaborador, empresa, tipo, observacao, competenciaMes, competenciaAno, createdByUserId, createdByNome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [null, 'GABRIEL LUIGI', 'SUDOESTE', 'incluir', 'Colaborador já desligado - registro histórico', competenciaMes, competenciaAno, createdByUserId, createdByNome]);
    console.log(`  OK - insertId: ${r10.insertId}`);

    console.log('\n✅ Importação de fevereiro/2026 concluída! 10 registros inseridos.');
  } catch (err) {
    console.error('Erro:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
