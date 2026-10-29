/**
 * Planejamento de férias digitado como texto ("01/12/2026 a 15/12/2026").
 * Aceita "a", "à", "até", "-" ou "–" entre as datas.
 */
export type PlanejamentoLido = { inicio: string; fim: string; dias: number };

const DATA = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;

function iso(d: number, m: number, a: number): string | null {
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Lê o texto do planejamento. Devolve null se não houver duas datas válidas em ordem. */
export function lerPlanejamento(texto: string | null | undefined): PlanejamentoLido | null {
  if (!texto) return null;
  const datas = Array.from(texto.matchAll(DATA)).map(m => iso(Number(m[1]), Number(m[2]), Number(m[3])));
  if (datas.length !== 2 || !datas[0] || !datas[1]) return null;
  const [inicio, fim] = datas as [string, string];
  if (fim < inicio) return null;
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1;
  if (dias < 1 || dias > 60) return null;
  return { inicio, fim, dias };
}
