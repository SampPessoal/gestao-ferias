// Regras puras de faixa etária do plano de saúde (sem acesso a banco), usadas pelo servidor e pelos testes.

export type FaixaPrecoBase = {
  id: number;
  empresa: string;
  codigoPlano: string;
  faixaInicio: number;
  faixaFim: number;
  valorTitular: number | string;
  valorDependente: number | string;
};

/** Idade completa em `hoje` (aniversário conta a partir do próprio dia). Data no formato YYYY-MM-DD. */
export function idadeNaData(dataNascimento: string, hoje: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataNascimento || "");
  if (!m) return null;
  const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  if (!ano || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  let idade = hoje.getFullYear() - ano;
  const mesHoje = hoje.getMonth() + 1, diaHoje = hoje.getDate();
  if (mesHoje < mes || (mesHoje === mes && diaHoje < dia)) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

/** Faixa da tabela de preços do plano (empresa + código do plano) que contém a idade. */
export function faixaDoPlano(precos: FaixaPrecoBase[], empresa: string, plano: string, idade: number): FaixaPrecoBase | null {
  return precos.find(
    (p) => p.empresa === empresa && (plano === p.codigoPlano || plano.includes(p.codigoPlano)) &&
      p.faixaInicio <= idade && p.faixaFim >= idade,
  ) ?? null;
}

export type DecisaoFaixa =
  | { acao: "nada" }
  | { acao: "idade"; idade: number }
  | { acao: "faixa"; idade: number; mensalidade: number }
  | { acao: "divergente"; idade: number };

/**
 * Decide o que atualizar para um beneficiário:
 * - "faixa": a idade nova caiu em outra faixa da tabela → troca a idade e a mensalidade pelo valor da tabela;
 * - "idade": só a idade mudou (mesma faixa) → troca só a idade, sem mexer no valor;
 * - "divergente": a idade calculada pela data de nascimento diminuiu ou pulou mais de 1 ano em relação
 *   à idade gravada → algum dado está errado (data ou idade da fatura); não mexe em nada, só avisa;
 * - "nada": nada mudou.
 */
export function decidirFaixa(
  precos: FaixaPrecoBase[],
  b: { empresa: string; plano: string; tipo: "T" | "D"; idade: number; mensalidade: number | string },
  idadeAtual: number,
): DecisaoFaixa {
  if (idadeAtual === b.idade) return { acao: "nada" };
  if (idadeAtual < b.idade || idadeAtual - b.idade > 1) return { acao: "divergente", idade: idadeAtual };
  const nova = faixaDoPlano(precos, b.empresa, b.plano, idadeAtual);
  if (!nova) return { acao: "idade", idade: idadeAtual };
  const antiga = faixaDoPlano(precos, b.empresa, b.plano, b.idade);
  const valor = Number(b.tipo === "T" ? nova.valorTitular : nova.valorDependente);
  if (antiga && antiga.id === nova.id) return { acao: "idade", idade: idadeAtual };
  if (!(valor > 0)) return { acao: "idade", idade: idadeAtual };
  return { acao: "faixa", idade: idadeAtual, mensalidade: Math.round(valor * 100) / 100 };
}
