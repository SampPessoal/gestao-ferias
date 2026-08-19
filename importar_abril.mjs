import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log('Conectado. Importando movimentações de abril/2026...\n');

// IDs encontrados:
// TIAGO SANTOS DA CONCEICAO = 22 (FREIRE)
// ROSANA MARIA SANTOS SANTANA = 86 (SUDOESTE)
// TIAGO DE BARROS MEIRELES = 88 (SUDOESTE)
// MARINEIDE DE JESUS SILVA = 117 (SUDOESTE)

// ============================================================
// 1. FREIRE - SEGURO DE VIDA
// TIAGO SANTOS DA CONCEIÇÃO - INCLUIR (R$ 11,90)
// ============================================================
console.log('1. FREIRE - Seguro de Vida: TIAGO SANTOS DA CONCEIÇÃO - INCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoSeguroVida 
    (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (22, 'TIAGO SANTOS DA CONCEICAO', 'FREIRE', 'incluir', '2026-04-01',
          'Inclusão referente a abril/2026. Valor: R$ 11,90', 'Importação planilha', 4, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 2. FREIRE - PLANO DE SAÚDE
// TIAGO SANTOS DA CONCEIÇÃO - INCLUIR (ENF PRATA, 30 anos, R$ 162,51)
// ============================================================
console.log('2. FREIRE - Plano de Saúde: TIAGO SANTOS DA CONCEIÇÃO - INCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (22, 'TIAGO SANTOS DA CONCEICAO', 'FREIRE', 'incluir', 'ENF PRATA', 'titular', 162.51,
          'Inclusão titular (30 anos)', 'Importação planilha', 4, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 3. SUDOESTE - SEGURO DE VIDA
// MARINEIDE SILVA - INCLUIR
// ============================================================
console.log('3. SUDOESTE - Seguro de Vida: MARINEIDE DE JESUS SILVA - INCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoSeguroVida 
    (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (117, 'MARINEIDE DE JESUS SILVA', 'SUDOESTE', 'incluir', '2026-04-01',
          'Inclusão referente a abril/2026', 'Importação planilha', 4, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 4. SUDOESTE - PLANO DE SAÚDE
// ROSANA MARIA SANTANA - INCLUIR (ENF PRATA, 42 anos, R$ 187,70)
// ============================================================
console.log('4. SUDOESTE - Plano de Saúde: ROSANA MARIA SANTOS SANTANA - INCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (86, 'ROSANA MARIA SANTOS SANTANA', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 187.70,
          'Inclusão titular (42 anos)', 'Importação planilha', 4, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 5. SUDOESTE - VALE TRANSPORTE
// TIAGO MEIRELES - EXCLUIR com obs "DESCONTAR 160,00"
// ============================================================
console.log('5. SUDOESTE - Vale Transporte: TIAGO DE BARROS MEIRELES - EXCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoValeTransporte 
    (colaboradorId, nomeColaborador, empresa, tipo, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (88, 'TIAGO DE BARROS MEIRELES', 'SUDOESTE', 'excluir',
          'DESCONTAR 160,00', 'Importação planilha', 4, 2026)
`);
console.log('   ✓ Inserido');

await conn.end();
console.log('\n✅ Importação de abril/2026 concluída com sucesso! 5 registros inseridos.');
