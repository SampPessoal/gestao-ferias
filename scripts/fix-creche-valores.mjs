import mysql from 'mysql2/promise';

const SALARIO_BASE = 1685.93;
const VALOR_0_2 = parseFloat((SALARIO_BASE * 0.30).toFixed(2));   // R$ 505.78
const VALOR_2_5 = parseFloat((SALARIO_BASE * 0.20).toFixed(2));   // R$ 337.19

function calcularIdadeAnos(dataNasc, dataRef) {
  const nasc = new Date(dataNasc);
  const ref = new Date(dataRef);
  let anos = ref.getFullYear() - nasc.getFullYear();
  const mesRef = ref.getMonth();
  const mesNasc = nasc.getMonth();
  if (mesRef < mesNasc || (mesRef === mesNasc && ref.getDate() < nasc.getDate())) {
    anos--;
  }
  return anos;
}

function calcularIdadeDias(dataNasc, dataRef) {
  const nasc = new Date(dataNasc);
  const ref = new Date(dataRef);
  return Math.floor((ref - nasc) / (1000 * 60 * 60 * 24));
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL || '');
  const hoje = '2026-07-15';

  const [rows] = await conn.execute(
    'SELECT id, nomeColaborador, nomeFilho, dataNascimentoFilho, valor FROM movimentacaoAuxilioCreche ORDER BY nomeColaborador'
  );

  console.log(`Regra: 0-2 anos = R$${VALOR_0_2} | 2a1d-5 anos = R$${VALOR_2_5} | >5 anos = não recebe`);
  console.log('');

  for (const row of rows) {
    if (!row.dataNascimentoFilho) {
      console.log(`SEM DATA: ${row.nomeColaborador} / ${row.nomeFilho}`);
      continue;
    }

    const anos = calcularIdadeAnos(row.dataNascimentoFilho, hoje);
    const dias = calcularIdadeDias(row.dataNascimentoFilho, hoje);
    
    let novoValor = null;
    let faixa = '';

    if (dias <= 730) { // 0 a 2 anos (730 dias = 2 anos exatos)
      novoValor = VALOR_0_2;
      faixa = '0-2 anos';
    } else if (anos < 5 || (anos === 5 && new Date(hoje) <= new Date(new Date(row.dataNascimentoFilho).setFullYear(new Date(row.dataNascimentoFilho).getFullYear() + 5)))) {
      novoValor = VALOR_2_5;
      faixa = '2a1d-5 anos';
    } else {
      faixa = '>5 anos (não recebe)';
    }

    const valorAtual = row.valor ? parseFloat(row.valor) : null;
    const status = valorAtual === novoValor ? 'OK' : `ATUALIZAR: ${valorAtual} -> ${novoValor}`;

    console.log(`${row.nomeColaborador} | ${row.nomeFilho} | ${anos} anos (${dias} dias) | ${faixa} | ${status}`);

    if (novoValor !== null && valorAtual !== novoValor) {
      await conn.execute(
        'UPDATE movimentacaoAuxilioCreche SET valor = ? WHERE id = ?',
        [String(novoValor.toFixed(2)), row.id]
      );
      console.log(`  -> Atualizado para R$${novoValor}`);
    }

    if (novoValor === null && valorAtual !== null) {
      // Filho tem mais de 5 anos — zerar valor ou marcar como excluir
      console.log(`  -> ATENÇÃO: filho com mais de 5 anos, verificar se deve ser removido`);
    }
  }

  await conn.end();
  console.log('\nConcluído!');
}

main().catch(console.error);
