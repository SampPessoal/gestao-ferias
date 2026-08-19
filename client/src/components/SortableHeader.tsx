import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { SortState } from "@/hooks/useTableSort";
import { TableHead } from "@/components/ui/table";

interface SortableHeaderProps<K extends string> {
  col: K;
  label: string;
  sort: SortState<K>;
  onToggle: (col: K) => void;
  className?: string;
  align?: "left" | "center" | "right";
}

function SortButton<K extends string>({
  col, label, sort, onToggle, align = "left",
}: Omit<SortableHeaderProps<K>, "className">) {
  const active = sort.col === col;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const alignClass = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";
  return (
    <button
      type="button"
      onClick={() => onToggle(col)}
      className={`flex items-center gap-1 hover:text-foreground transition-colors group cursor-pointer select-none ${alignClass} w-full`}
      title={active ? (sort.dir === "asc" ? "Ordenado A→Z / ↑ — clique para inverter" : "Ordenado Z→A / ↓ — clique para inverter") : `Ordenar por ${label}`}
    >
      <span>{label}</span>
      <Icon className={`w-3 h-3 shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"}`} />
    </button>
  );
}

/** Para uso em tabelas com <th> nativo */
export function SortableHeader<K extends string>({
  col, label, sort, onToggle, className = "", align = "left",
}: SortableHeaderProps<K>) {
  return (
    <th className={`px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground ${className}`}>
      <SortButton col={col} label={label} sort={sort} onToggle={onToggle} align={align} />
    </th>
  );
}

/** Para uso dentro de <TableHeader> do shadcn/ui */
export function SortableTableHead<K extends string>({
  col, label, sort, onToggle, className = "", align = "left",
}: SortableHeaderProps<K>) {
  return (
    <TableHead className={`text-xs font-bold uppercase tracking-wide text-muted-foreground ${className}`}>
      <SortButton col={col} label={label} sort={sort} onToggle={onToggle} align={align} />
    </TableHead>
  );
}
