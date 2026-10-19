/**
 * Máscaras de digitação usadas em todo o sistema.
 * Cada função recebe o texto digitado e devolve o texto já formatado.
 */

export const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** 000.000.000-00 */
export function mascaraCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** 00.000.000-00 (RG da Bahia e da maioria dos estados) */
export function mascaraRg(v: string): string {
  const d = soDigitos(v).slice(0, 10);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
}

/** (00) 0000-0000 */
export function mascaraTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 10);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/** (00) 0 0000-0000 */
export function mascaraCelular(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 0000 0000 0000 */
export function mascaraTituloEleitor(v: string): string {
  return soDigitos(v).slice(0, 12).replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Série da CTPS: 0000-UF (números, depois a UF em letras) */
export function mascaraSerieCtps(v: string): string {
  const limpo = v.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const num = limpo.replace(/[A-Z]/g, "").slice(0, 5);
  const uf = limpo.replace(/[0-9]/g, "").slice(0, 2);
  return uf ? `${num}-${uf}` : num;
}

/** Agência com dígito: 1234-5 */
export function mascaraAgencia(v: string): string {
  const d = soDigitos(v).slice(0, 5);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

/** Conta com dígito: 12345-6 (o último número é o dígito) */
export function mascaraConta(v: string): string {
  const d = soDigitos(v).slice(0, 13);
  return d.length > 1 ? `${d.slice(0, -1)}-${d.slice(-1)}` : d;
}

/** Chave PIX conforme o tipo: CPF e telefone com máscara; e-mail e chave aleatória livres */
export function mascaraChavePix(tipo: string | null | undefined, v: string): string {
  if (tipo === "cpf") return mascaraCpf(v);
  if (tipo === "telefone") return mascaraCelular(v);
  return v;
}

/** Só números, com limite de tamanho */
export function mascaraInteiro(v: string, maxDigitos = 4): string {
  return soDigitos(v).slice(0, maxDigitos);
}

/** dd/mm/aaaa */
export function mascaraData(v: string): string {
  const d = soDigitos(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Período: dd/mm/aaaa a dd/mm/aaaa */
export function mascaraPeriodo(v: string): string {
  const d = soDigitos(v).slice(0, 16);
  const ini = mascaraData(d.slice(0, 8));
  return d.length > 8 ? `${ini} a ${mascaraData(d.slice(8))}` : ini;
}

/**
 * Valor em reais vindo do sistema ("39.52", "39,52", 39.52, "1.234,56") → número.
 * Vazio ou inválido → null.
 */
export function lerReais(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = v.replace(/\s|R\$/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Número → "1.234,56" (sem o "R$"). */
export function formatarReais(n: number | null): string {
  if (n === null) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
