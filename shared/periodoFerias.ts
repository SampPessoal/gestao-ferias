/**
 * Período aquisitivo de quem ainda não tem período, a partir da admissão:
 * - admissão há menos de 1 ano (ou no futuro): o 1º período começa na admissão;
 * - admissão mais antiga: o período atual começa no último aniversário da admissão.
 */
export function periodoInicialPelaAdmissao(admissaoIso: string, hojeIso = new Date().toISOString().slice(0, 10)): string {
  const [a, m, d] = admissaoIso.slice(0, 10).split('-').map(Number);
  const aniversario = (ano: number) => {
    // 29/02 em ano não bissexto vira 28/02
    const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate();
    return `${ano}-${String(m).padStart(2, '0')}-${String(Math.min(d, ultimoDia)).padStart(2, '0')}`;
  };
  const anoHoje = Number(hojeIso.slice(0, 4));
  if (aniversario(a + 1) > hojeIso) return admissaoIso.slice(0, 10);
  const doAno = aniversario(anoHoje);
  return doAno <= hojeIso ? doAno : aniversario(anoHoje - 1);
}
