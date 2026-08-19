import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('Conectado ao banco. Iniciando importação de junho/2026...\n');

// ============================================================
// SUDOESTE - SEGURO DE VIDA
// ERE BARBOSA DE FREITAS MATOS (id=169) - INCLUIR
// ============================================================
console.log('1. SUDOESTE - Seguro de Vida: ERE BARBOSA - INCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoSeguroVida 
    (colaboradorId, nomeColaborador, empresa, tipo, data, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (169, 'ERE BARBOSA DE FREITAS MATOS', 'SUDOESTE', 'incluir', '2026-06-01', 
          'Inclusão referente a junho/2026', 'Importação planilha', 6, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// SUDOESTE - PLANO DE SAÚDE
// ERE BARBOSA DE FREITAS MATOS (id=169) - INCLUIR - ENF PRATA - 33 anos - R$ 170,64
// ============================================================
console.log('2. SUDOESTE - Plano de Saúde: ERE BARBOSA - INCLUIR (ENF PRATA, R$ 170,64)');
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, valor, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (169, 'ERE BARBOSA DE FREITAS MATOS', 'SUDOESTE', 'incluir', 'ENF PRATA', 'titular', 170.64,
          'Inclusão referente a junho/2026. Idade: 33 anos.', 'Importação planilha', 6, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// SUDOESTE - PLANO DE SAÚDE
// NADJA ALINE SOARES LARANJEIRA (id=129) - EXCLUIR filho BRAYN SOARES
// Data de exclusão foi 29/04 - registrar em junho com obs
// ============================================================
console.log('3. SUDOESTE - Plano de Saúde: NADJA ALINE (filho BRAYN SOARES) - EXCLUIR');
await conn.execute(`
  INSERT INTO movimentacaoPlanoSaude 
    (colaboradorId, nomeColaborador, empresa, tipo, tipoPlano, categoria, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (129, 'NADJA ALINE SOARES LARANJEIRA', 'SUDOESTE', 'excluir', 'ENF PRATA', 'dependente',
          'Exclusão do filho BRAYN SOARES. Data real da exclusão: 29/04/2026', 'Importação planilha', 6, 2026)
`);
console.log('   ✓ Inserido');

// ============================================================
// FREIRE - BÔNUS POR INDICAÇÃO
// YURI SOUZA LEAO (id=11) indicou TIAGO SANTOS DA CONCEICAO (id=22)
// Admissão: 16/03/2026 - Valor: R$ 1.000,00
// ============================================================
console.log('4. FREIRE - Bônus: YURI LEÃO indicou TIAGO DA CONCEIÇÃO - R$ 1.000,00');
await conn.execute(`
  INSERT INTO movimentacaoBonusIndicacao 
    (indicadorId, nomeIndicador, indicadoId, nomeIndicado, empresa, dataAdmissaoIndicado, dataPagamentoPrevisto, valorBonus, status, observacao, createdByNome, competenciaMes, competenciaAno)
  VALUES (11, 'YURI SOUZA LEAO', 22, 'TIAGO SANTOS DA CONCEICAO', 'FREIRE', '2026-03-16', '2026-06-16', 1000.00,
          'pendente', 'Admissão do indicado em 16/03/2026. Pagamento previsto 3 meses após admissão.', 'Importação planilha', 6, 2026)
`);
console.log('   ✓ Inserido');

await conn.end();
console.log('\n✅ Importação concluída com sucesso!');
