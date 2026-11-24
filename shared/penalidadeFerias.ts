// Regra da antecedência (mesma da tela de férias): a saída pode ocorrer até 1 mês antes do
// vencimento do período aquisitivo, com perda de dias — 1 dia com venda de 10 ou férias
// fracionadas, 2 dias com 30 dias corridos. Datas em YYYY-MM-DD.

/** Mesma data um mês antes (ajusta o dia para o último do mês, se preciso). */
export function umMesAntesIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ultimoDiaMesAnterior = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const ref = new Date(Date.UTC(y, m - 2, Math.min(d, ultimoDiaMesAnterior)));
  return ref.toISOString().slice(0, 10);
}

/** Dias perdidos por um lançamento cuja saída cai no mês anterior ao vencimento (0 se não cair). */
export function diasPerdidosAntecipacao(opts: {
  dataSaida: string; vencimento: string; venda10: boolean; diasGozados: number; diasDireito?: number;
}): number {
  const { dataSaida, vencimento } = opts;
  if (!dataSaida || !vencimento) return 0;
  if (dataSaida >= vencimento) return 0; // a partir do vencimento: normal
  if (dataSaida < umMesAntesIso(vencimento)) return 0; // antes da janela: a tela bloqueia; sem desconto aqui
  if (opts.venda10) return 1;
  if (opts.diasGozados < (opts.diasDireito ?? 30)) return 1;
  return 2;
}
