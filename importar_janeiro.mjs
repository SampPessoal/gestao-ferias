// Importação das movimentações de janeiro/2026
//
// JOANES:
//   Seguro de Vida: TAMARA SOARES CARVALHO (ID=173) incluir R$11,90 13/01/2026
//
// FREIRE:
//   Seguro de Vida: DOUGLAS SANTOS GUIMARAES (ID=3) incluir R$11,90 13/01/2026
//   Seguro de Vida: LEIDIANE DOS SANTOS (ID=23) incluir R$11,90 13/01/2026
//
// SUDOESTE:
//   Seguro de Vida: FRANCISCO CARLOS BARRETO CARDOSO (ID=131) incluir
//   Seguro de Vida: ISABELLE MARTA BULHOES BRITO DE JESUS (ID=30005) excluir
//   Seguro de Vida: TIAGO CAMBRAINHA ARAUJO (ID=133) incluir
//   Auxílio Notebook: RHUAN DE OLIVEIRA COSTA (ID=132) incluir 28/01/2026
//   Auxílio Notebook: TIAGO CAMBRAINHA ARAUJO (ID=133) incluir 28/01/2026
//   Plano de Saúde: LUIZ WINNTOU GUIMARAES CAMERA (ID=52) incluir dependente ENF PRATA 16 anos R$316,16 obs: FILHA VICTORIA LUIZA VIEIRA CAMERA
//   Plano de Saúde: YURI MOURA SANTOS (já saiu) incluir ENF PRATA 32 anos R$162,51
//   Plano de Saúde: CAUA VIVAS MARTINS DA CRUZ (já saiu) incluir ENF PRATA 22 anos R$111,06
//   Plano de Saúde: RHUAN DE OLIVEIRA COSTA (ID=132) incluir AMIL PRATA AP 22 anos R$410,72
//   Plano de Saúde: TIAGO CAMBRAINHA ARAUJO (ID=133) incluir ENF PRATA 22 anos R$111,06
//   Vale Transporte: ALISSON TARGINO DA SILVA (já saiu) excluir
//   Vale Transporte: RHUAN DE OLIVEIRA COSTA (ID=132) incluir
//   Vale Transporte: TIAGO CAMBRAINHA ARAUJO (ID=133) incluir

import { createConnection } from '/home/ubuntu/ferias-manager/node_modules/.pnpm/mysql2@3.15.1/node_modules/mysql2/promise.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não definida'); process.exit(1); }

async function main() {
  const conn = await createConnection(DATABASE_URL);
  console.log('Conectado ao banco de dados');

  const mes = 1;
  const ano = 2026;
  const createdByNome = 'Importação Janeiro/2026';

  try {
    // ===== SEGURO DE VIDA =====
    console.log('\n--- Seguro de Vida ---');

    // 1. JOANES - TAMARA SOARES CARVALHO
    console.log('[1/14] SV - TAMARA SOARES CARVALHO (JOANES)...');
    const [r1] = await conn.execute(
      'INSERT INTO movimentacaoSeguroVida (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?)',
      [173, 'TAMARA SOARES CARVALHO', 'JOANES', 'incluir', '2026-01-13', 'Valor: R$ 11,90', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r1.insertId}`);

    // 2. FREIRE - DOUGLAS SANTOS GUIMARAES
    console.log('[2/14] SV - DOUGLAS SANTOS GUIMARAES (FREIRE)...');
    const [r2] = await conn.execute(
      'INSERT INTO movimentacaoSeguroVida (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?)',
      [3, 'DOUGLAS SANTOS GUIMARAES', 'FREIRE', 'incluir', '2026-01-13', 'Valor: R$ 11,90', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r2.insertId}`);

    // 3. FREIRE - LEIDIANE DOS SANTOS
    console.log('[3/14] SV - LEIDIANE DOS SANTOS (FREIRE)...');
    const [r3] = await conn.execute(
      'INSERT INTO movimentacaoSeguroVida (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?)',
      [23, 'LEIDIANE DOS SANTOS', 'FREIRE', 'incluir', '2026-01-13', 'Valor: R$ 11,90', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r3.insertId}`);

    // 4. SUDOESTE - FRANCISCO CARLOS BARRETO CARDOSO
    console.log('[4/14] SV - FRANCISCO CARLOS BARRETO CARDOSO (SUDOESTE)...');
    const [r4] = await conn.execute(
      'INSERT INTO movimentacaoSeguroVida (colaboradorId, nomeColaborador, empresa, tipo, data, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?)',
      [131, 'FRANCISCO CARLOS BARRETO CARDOSO', 'SUDOESTE', 'incluir', '2026-01-01', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r4.insertId}`);

    // 5. SUDOESTE - ISABELLE MARTA BULHOES BRITO DE JESUS (excluir)
    console.log('[5/14] SV - ISABELLE MARTA BULHOES BRITO DE JESUS (SUDOESTE) excluir...');
    const [r5] = await conn.execute(
      'INSERT INTO movimentacaoSeguroVida (colaboradorId, nomeColaborador, empresa, tipo, data, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?)',
      [30005, 'ISABELLE MARTA BULHOES BRITO DE JESUS', 'SUDOESTE', 'excluir', '2026-01-01', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r5.insertId}`);

    // 6. SUDOESTE - TIAGO CAMBRAINHA ARAUJO
    console.log('[6/14] SV - TIAGO CAMBRAINHA ARAUJO (SUDOESTE)...');
    const [r6] = await conn.execute(
      'INSERT INTO movimentacaoSeguroVida (colaboradorId, nomeColaborador, empresa, tipo, data, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?)',
      [133, 'TIAGO CAMBRAINHA ARAUJO', 'SUDOESTE', 'incluir', '2026-01-01', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r6.insertId}`);

    // ===== AUXÍLIO NOTEBOOK =====
    console.log('\n--- Auxílio Notebook ---');

    // 7. SUDOESTE - RHUAN DE OLIVEIRA COSTA
    console.log('[7/14] NOT - RHUAN DE OLIVEIRA COSTA (SUDOESTE)...');
    const [r7] = await conn.execute(
      'INSERT INTO movimentacaoAuxilioNotebook (colaboradorId, nomeColaborador, empresa, tipo, dataInicio, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?)',
      [132, 'RHUAN DE OLIVEIRA COSTA', 'SUDOESTE', 'incluir', '2026-01-28', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r7.insertId}`);

    // 8. SUDOESTE - TIAGO CAMBRAINHA ARAUJO
    console.log('[8/14] NOT - TIAGO CAMBRAINHA ARAUJO (SUDOESTE)...');
    const [r8] = await conn.execute(
      'INSERT INTO movimentacaoAuxilioNotebook (colaboradorId, nomeColaborador, empresa, tipo, dataInicio, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?)',
      [133, 'TIAGO CAMBRAINHA ARAUJO', 'SUDOESTE', 'incluir', '2026-01-28', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r8.insertId}`);

    // ===== PLANO DE SAÚDE =====
    console.log('\n--- Plano de Saúde ---');

    // 9. SUDOESTE - LUIZ WINNTOU GUIMARAES CAMERA - dependente (ID=52)
    console.log('[9/14] PS - LUIZ WINNTOU GUIMARAES CAMERA dependente (SUDOESTE)...');
    const [r9] = await conn.execute(
      'INSERT INTO movimentacaoPlanoSaude (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [52, 'LUIZ WINNTOU GUIMARAES CAMERA', 'SUDOESTE', 'incluir', 'ENF PRATA', 'dependente', 316.16, '16 anos | Filha: VICTORIA LUIZA VIEIRA CAMERA', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r9.insertId}`);

    // 10. SUDOESTE - YURI MOURA SANTOS (já saiu, sem ID)
    console.log('[10/14] PS - YURI MOURA SANTOS (SUDOESTE, ex-colaborador)...');
    const [r10] = await conn.execute(
      'INSERT INTO movimentacaoPlanoSaude (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [null, 'YURI MOURA SANTOS', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 162.51, '32 anos | Colaborador já desligado', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r10.insertId}`);

    // 11. SUDOESTE - CAUA VIVAS MARTINS DA CRUZ (já saiu, sem ID)
    console.log('[11/14] PS - CAUA VIVAS MARTINS DA CRUZ (SUDOESTE, ex-colaborador)...');
    const [r11] = await conn.execute(
      'INSERT INTO movimentacaoPlanoSaude (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [null, 'CAUA VIVAS MARTINS DA CRUZ', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 111.06, '22 anos | Colaborador já desligado', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r11.insertId}`);

    // 12. SUDOESTE - RHUAN DE OLIVEIRA COSTA - AMIL PRATA AP
    console.log('[12/14] PS - RHUAN DE OLIVEIRA COSTA AMIL PRATA AP (SUDOESTE)...');
    const [r12] = await conn.execute(
      'INSERT INTO movimentacaoPlanoSaude (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [132, 'RHUAN DE OLIVEIRA COSTA', 'SUDOESTE', 'incluir', 'AMIL PRATA AP', 'titular', 410.72, '22 anos', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r12.insertId}`);

    // 13. SUDOESTE - TIAGO CAMBRAINHA ARAUJO
    console.log('[13/14] PS - TIAGO CAMBRAINHA ARAUJO (SUDOESTE)...');
    const [r13] = await conn.execute(
      'INSERT INTO movimentacaoPlanoSaude (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [133, 'TIAGO CAMBRAINHA ARAUJO', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 111.06, '22 anos', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r13.insertId}`);

    // ===== VALE TRANSPORTE =====
    console.log('\n--- Vale Transporte ---');

    // 14a. SUDOESTE - ALISSON TARGINO DA SILVA (já saiu, excluir)
    console.log('[14a/14] VT - ALISSON TARGINO DA SILVA (SUDOESTE, ex-colaborador) excluir...');
    const [r14a] = await conn.execute(
      'INSERT INTO movimentacaoValeTransporte (colaboradorId, nomeColaborador, empresa, tipo, observacao, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?,?)',
      [null, 'ALISSON TARGINO DA SILVA', 'SUDOESTE', 'excluir', 'Colaborador já desligado - registro histórico', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r14a.insertId}`);

    // 14b. SUDOESTE - RHUAN DE OLIVEIRA COSTA
    console.log('[14b/14] VT - RHUAN DE OLIVEIRA COSTA (SUDOESTE)...');
    const [r14b] = await conn.execute(
      'INSERT INTO movimentacaoValeTransporte (colaboradorId, nomeColaborador, empresa, tipo, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?)',
      [132, 'RHUAN DE OLIVEIRA COSTA', 'SUDOESTE', 'incluir', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r14b.insertId}`);

    // 14c. SUDOESTE - TIAGO CAMBRAINHA ARAUJO
    console.log('[14c/14] VT - TIAGO CAMBRAINHA ARAUJO (SUDOESTE)...');
    const [r14c] = await conn.execute(
      'INSERT INTO movimentacaoValeTransporte (colaboradorId, nomeColaborador, empresa, tipo, competenciaMes, competenciaAno, createdByNome) VALUES (?,?,?,?,?,?,?)',
      [133, 'TIAGO CAMBRAINHA ARAUJO', 'SUDOESTE', 'incluir', mes, ano, createdByNome]
    );
    console.log(`  OK - insertId: ${r14c.insertId}`);

    console.log('\n✅ Importação de janeiro/2026 concluída! 16 registros inseridos.');
  } catch (err) {
    console.error('Erro:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
