import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log('Conectado. Importando movimentações de maio/2026...\n');

// IDs encontrados:
// LAIANE MENEZES ARAUJO = 51 (SUDOESTE)
// MURILLO BATISTA FERNANDES = 101 (SUDOESTE)
// VITOR BERLINK SANTOS = 166 (SUDOESTE)

// ============================================================
// 1. SUDOESTE - SEGURO DE VIDA
// LAIANE MENEZES - INCLUIR
// ============================================================
console.log('1. SUDOESTE - Seguro de Vida: LAIANE MENEZES - INCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoSeguroVida 
    (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (51, 'LAIANE MENEZES ARAUJO', 'SUDOESTE', 'incluir', '2026-05-01',
          'Inclusão referente a maio/2026', 'Importação planilha', 5, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 2. SUDOESTE - PLANO DE SAÚDE
// MURILLO FERNANDES + filho FRANCISCO FERNANDES - INCLUIR dependente (0 meses, R$ 348,92)
// ============================================================
console.log('2. SUDOESTE - Plano de Saúde: MURILLO + filho FRANCISCO - INCLUIR dependente');
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (101, 'MURILLO BATISTA FERNANDES', 'SUDOESTE', 'incluir', 'ENF PRATA', 'dependente', 348.92,
          'Inclusão filho FRANCISCO FERNANDES (0 meses de idade)', 'Importação planilha', 5, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 3. SUDOESTE - PLANO DE SAÚDE
// LAIANE MENEZES + filho ARTHUR - INCLUIR titular (32 anos, R$ 179,30) + dependente (10 meses, R$ 348,92)
// ============================================================
console.log('3. SUDOESTE - Plano de Saúde: LAIANE + filho ARTHUR - INCLUIR titular e dependente');
// Titular
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (51, 'LAIANE MENEZES ARAUJO', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 179.30,
          'Inclusão titular (32 anos). Também incluído filho ARTHUR (10 meses, R$ 348,92)', 'Importação planilha', 5, 2026)
`);
// Dependente
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (51, 'LAIANE MENEZES ARAUJO', 'SUDOESTE', 'incluir', 'ENF PRATA', 'dependente', 348.92,
          'Inclusão filho ARTHUR (10 meses de idade)', 'Importação planilha', 5, 2026)
`);
console.log('   ✓ Inseridos (2 registros: titular + dependente)');

// ============================================================
// 4. SUDOESTE - PLANO DE SAÚDE
// MURILLO FERNANDES - EXCLUIR esposa ANNE CAROLYNE
// ============================================================
console.log('4. SUDOESTE - Plano de Saúde: MURILLO - EXCLUIR esposa ANNE CAROLYNE');
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (101, 'MURILLO BATISTA FERNANDES', 'SUDOESTE', 'excluir', 'ENF PRATA', 'dependente',
          'Exclusão esposa ANNE CAROLYNE', 'Importação planilha', 5, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 5. SUDOESTE - VALE TRANSPORTE
// VITOR BERLINK - INCLUIR
// ============================================================
console.log('5. SUDOESTE - Vale Transporte: VITOR BERLINK - INCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoValeTransporte 
    (colaboradorId, nomeColaborador, empresa, tipo, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (166, 'VITOR BERLINK SANTOS', 'SUDOESTE', 'incluir',
          'Inclusão referente a maio/2026', 'Importação planilha', 5, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// 6. SUDOESTE - AUXÍLIO CRECHE
// LAIANE MENEZES - INCLUIR - R$ 505,78
// (VIRLANNE GOMES não incluir conforme instrução)
// ============================================================
console.log('6. SUDOESTE - Auxílio Creche: LAIANE MENEZES - INCLUIR (R$ 505,78)');
await conn.execute(`
  INSERT INTO movimentacaoAuxilioCreche 
    (colaboradorId, nomeColaborador, empresa, tipo, nomeFilho, valor, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (51, 'LAIANE MENEZES ARAUJO', 'SUDOESTE', 'incluir', 'ARTHUR', 505.78,
          'Inclusão auxílio creche referente a maio/2026', 'Importação planilha', 5, 2026)
`);
console.log('   ✓ Inserido');

await conn.end();
console.log('\n✅ Importação de maio/2026 concluída com sucesso! 6 registros inseridos.');
