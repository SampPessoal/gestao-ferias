import { useState } from "react";

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  col: K | null;
  dir: SortDir;
}

/**
 * Converte qualquer valor de data para string ISO "YYYY-MM-DD" para comparação correta.
 * Suporta: Date object, string ISO "YYYY-MM-DDT...", string ISO "YYYY-MM-DD",
 *          string BR "DD/MM/YYYY", número (timestamp ms).
 * Retorna null se não for reconhecível como data.
 */
function toIsoDateStr(val: unknown): string | null {
  if (val == null) return null;

  // Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Número (timestamp ms)
  if (typeof val === "number") {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return null;
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(val);

  // ISO com T: "YYYY-MM-DDTHH:mm:ss..."
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.slice(0, 10);
  }

  // ISO simples: "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Formato BR: "DD/MM/YYYY"
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  return null;
}

export function useTableSort<K extends string>(defaultCol: K | null = null, defaultDir: SortDir = "asc") {
  const [sort, setSort] = useState<SortState<K>>({ col: defaultCol, dir: defaultDir });

  function toggle(col: K) {
    setSort(prev => {
      if (prev.col === col) {
        return { col, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { col, dir: "asc" };
    });
  }

  function sortData<T extends Record<string, any>>(data: T[]): T[] {
    if (!sort.col) return data;
    const col = sort.col as string;
    return [...data].sort((a, b) => {
      const va = a[col];
      const vb = b[col];

      // Nulos sempre vão para o final, independente da direção
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      // Tenta converter para data ISO
      const da = toIsoDateStr(va);
      const db = toIsoDateStr(vb);
      if (da !== null && db !== null) {
        // Comparação lexicográfica de "YYYY-MM-DD" é equivalente à cronológica
        const cmp = da.localeCompare(db);
        return sort.dir === "asc" ? cmp : -cmp;
      }
      // Se apenas um é data, o que não é vai para o final
      if (da !== null && db === null) return sort.dir === "asc" ? -1 : 1;
      if (da === null && db !== null) return sort.dir === "asc" ? 1 : -1;

      // Números
      if (typeof va === "number" && typeof vb === "number") {
        return sort.dir === "asc" ? va - vb : vb - va;
      }

      // Strings numéricas (ex: "30", "5")
      const na = parseFloat(String(va));
      const nb = parseFloat(String(vb));
      if (!isNaN(na) && !isNaN(nb) && String(na) === String(va).trim() && String(nb) === String(vb).trim()) {
        return sort.dir === "asc" ? na - nb : nb - na;
      }

      // Texto — usa locale pt-BR para acentos corretos (A→Z / Z→A)
      const cmp = String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }

  return { sort, toggle, sortData };
}

/** Retorna o ícone correto para o cabeçalho de coluna */
export function sortIcon(sort: SortState<any>, col: string): "asc" | "desc" | "none" {
  if (sort.col !== col) return "none";
  return sort.dir;
}
