/**
 * Pesquisa que ignora acentos, maiúsculas e espaços repetidos:
 * "joao conceicao" encontra "JOÃO CONCEIÇÃO".
 */
export const textoBusca = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O texto contém o que foi digitado? (sem diferenciar acentos nem maiúsculas) */
export function contemTexto(texto: string | null | undefined, busca: string | null | undefined): boolean {
  const b = textoBusca(busca);
  if (!b) return true;
  return textoBusca(texto).includes(b);
}
