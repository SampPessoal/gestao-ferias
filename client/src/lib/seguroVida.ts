/**
 * Seguro de vida: o valor por empresa é o valor integral; a empresa paga 50% e o colaborador o restante.
 * A metade da empresa é arredondada para baixo no centavo (ex.: R$ 8,27 → empresa R$ 4,13, colaborador R$ 4,14).
 */
export function divisaoSeguro(valor: number | null | undefined): { valor: number; empresa: number; colaborador: number } | null {
  if (valor === null || valor === undefined || !isFinite(valor)) return null;
  const centavos = Math.round(valor * 100);
  const empresa = Math.floor(centavos / 2);
  return { valor: centavos / 100, empresa: empresa / 100, colaborador: (centavos - empresa) / 100 };
}
