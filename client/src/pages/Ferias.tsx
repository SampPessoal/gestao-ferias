import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronRight, ChevronLeft, CalendarDays, AlertTriangle, Clock, CheckCircle2, X, Palmtree, TrendingUp } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";
import { Link } from "wouter";
import { calcularStatus, statusColor, statusLabel, formatDate, diasRestantes, toDateStr } from "@/lib/ferias";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os status" },
  { value: "vencida", label: "Urgente — passou da data limite" },
  { value: "vence30", label: "Crítico — ≤ 30 dias" },
  { value: "vence60", label: "Alerta — ≤ 60 dias" },
  { value: "vence90", label: "Atenção — ≤ 90 dias" },
  { value: "em_dia", label: "Em dia" },
];

export default function Ferias() {
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [empresaId, setEmpresaId] = useState<number | undefined>(undefined);
  const [setorId, setSetorId] = useState<number | undefined>(undefined);
  const [statusFerias, setStatusFerias] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const { sort: sortFerias, toggle: toggleSortFerias, sortData: sortFeriasData } = useTableSort<"nome" | "empresaNome" | "admissao" | "periodoAquisitivo" | "vencimento" | "dataLimite" | "saldo">("dataLimite", "asc");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery(empresaId ? { empresaId } : undefined);
  const { data: dashStats } = trpc.dashboard.stats.useQuery();

  const { data, isLoading } = trpc.colaboradores.list.useQuery({
    busca: buscaDebounced || undefined,
    empresaId,
    setorId,
    status: "ativo",
    statusFerias: statusFerias !== "todos" ? (statusFerias as any) : undefined,
    page,
    pageSize: 50,
  });

  const totalPages = data ? Math.ceil(data.total / 50) : 1;
  const sortedData = useMemo(() => sortFeriasData(data?.data ?? []), [data?.data, sortFerias]);
  const hasFilters = busca || empresaId || setorId || statusFerias !== "todos";

  const stats = useMemo(() => {
    if (!dashStats) return { vencidas: 0, criticas: 0, atencao: 0, emDia: 0 };
    const emDia = Math.max(0, dashStats.ativos - dashStats.vencidas - dashStats.vence90);
    return {
      vencidas: dashStats.vencidas,
      criticas: dashStats.vence30,
      atencao: dashStats.vence60 - dashStats.vence30,
      emDia,
    };
  }, [dashStats]);

  const statCards = [
    {
      label: "Urgente",
      sublabel: "Passou da data limite",
      value: stats.vencidas,
      icon: AlertTriangle,
      filter: "vencida",
      accent: "#ef4444",
      accentLight: "rgba(239,68,68,0.08)",
      accentBorder: "rgba(239,68,68,0.18)",
    },
    {
      label: "Crítico",
      sublabel: "≤ 30 dias para vencer",
      value: stats.criticas,
      icon: Clock,
      filter: "vence30",
      accent: "#f97316",
      accentLight: "rgba(249,115,22,0.07)",
      accentBorder: "rgba(249,115,22,0.16)",
    },
    {
      label: "Alerta",
      sublabel: "≤ 60 dias para vencer",
      value: stats.atencao,
      icon: CalendarDays,
      filter: "vence60",
      accent: "#eab308",
      accentLight: "rgba(234,179,8,0.07)",
      accentBorder: "rgba(234,179,8,0.16)",
    },
    {
      label: "Em dia",
      sublabel: "Sem urgência",
      value: stats.emDia,
      icon: CheckCircle2,
      filter: "em_dia",
      accent: "#22c55e",
      accentLight: "rgba(34,197,94,0.07)",
      accentBorder: "rgba(34,197,94,0.16)",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)"
      }}>
        <div className="px-7 py-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
              <Palmtree className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Controle de Férias
              </h1>
              <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>
                Períodos aquisitivos, vencimentos e datas limite de todos os colaboradores
              </p>
            </div>
          </div>
          {data && (
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: "oklch(0.20 0.015 240)", border: "1px solid oklch(0.28 0.012 240)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "oklch(0.48 0.20 252)" }} />
              <span className="text-sm font-semibold text-white">{data.total}</span>
              <span className="text-xs" style={{ color: "oklch(0.60 0.008 240)" }}>colaboradores</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Cards de status ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(card => {
          const isActive = statusFerias === card.filter;
          return (
            <button
              key={card.filter}
              onClick={() => setStatusFerias(isActive ? "todos" : card.filter)}
              className="text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 group"
              style={{
                background: isActive ? card.accentLight : "white",
                border: `1px solid ${isActive ? card.accentBorder : "oklch(0.885 0.006 240)"}`,
                boxShadow: isActive
                  ? `0 4px 16px ${card.accentBorder}, 0 0 0 2px ${card.accentBorder}`
                  : "0 1px 4px oklch(0.12 0.015 240 / 0.06)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: isActive ? card.accent : "oklch(0.52 0.012 240)" }}>
                    {card.label}
                  </p>
                  <p className="text-3xl font-black leading-none tracking-tight"
                    style={{ fontFamily: "var(--font-display)", color: isActive ? card.accent : "oklch(0.13 0.07 254)" }}>
                    {card.value}
                  </p>
                  <p className="text-xs mt-1.5 font-medium"
                    style={{ color: isActive ? card.accent : "oklch(0.60 0.010 240)", opacity: isActive ? 0.75 : 1 }}>
                    {card.sublabel}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                  style={{ background: `${card.accent}18` }}>
                  <card.icon className="w-4.5 h-4.5" style={{ color: card.accent, width: 18, height: 18 }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Barra de filtros ─────────────────────────────────────────── */}
      <div className="rounded-xl p-4 flex flex-wrap gap-3 items-center"
        style={{
          background: "white",
          border: "1px solid oklch(0.885 0.006 240)",
          boxShadow: "0 1px 4px oklch(0.12 0.015 240 / 0.05)"
        }}>

        {/* Busca */}
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setPage(1); }}
            className="pl-9 h-9 bg-muted/30 border-border/60 focus:bg-white"
          />
        </div>

        <div className="w-px h-6 bg-border/60 shrink-0 hidden sm:block" />

        {/* Empresa */}
        <Select
          value={empresaId ? String(empresaId) : "todos"}
          onValueChange={v => { setEmpresaId(v === "todos" ? undefined : Number(v)); setSetorId(undefined); setPage(1); }}
        >
          <SelectTrigger className="w-52 h-9 bg-muted/30 border-border/60">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as empresas</SelectItem>
            {empresas?.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Setor */}
        <Select
          value={setorId ? String(setorId) : "todos"}
          onValueChange={v => { setSetorId(v === "todos" ? undefined : Number(v)); setPage(1); }}
        >
          <SelectTrigger className="w-52 h-9 bg-muted/30 border-border/60">
            <SelectValue placeholder="Todos os setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {setores?.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={statusFerias}
          onValueChange={v => { setStatusFerias(v); setPage(1); }}
        >
          <SelectTrigger className="w-52 h-9 bg-muted/30 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => { setBusca(""); setBuscaDebounced(""); setEmpresaId(undefined); setSetorId(undefined); setStatusFerias("todos"); setPage(1); }}>
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* ── Tabela ─────────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden"
        style={{
          background: "white",
          border: "1px solid oklch(0.885 0.006 240)",
          boxShadow: "0 1px 4px oklch(0.12 0.015 240 / 0.06)"
        }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.960 0.004 240)", borderBottom: "1px solid oklch(0.885 0.006 240)" }}>
                <SortableHeader col="nome" label="Colaborador" sort={sortFerias} onToggle={toggleSortFerias} className="px-5 py-3.5" />
                <SortableHeader col="empresaNome" label="Empresa" sort={sortFerias} onToggle={toggleSortFerias} />
                <SortableHeader col="admissao" label="Admissão" sort={sortFerias} onToggle={toggleSortFerias} />
                <SortableHeader col="periodoAquisitivo" label="Período Aquisitivo" sort={sortFerias} onToggle={toggleSortFerias} />
                <SortableHeader col="vencimento" label="Vencimento" sort={sortFerias} onToggle={toggleSortFerias} />
                <SortableHeader col="dataLimite" label="Data Limite" sort={sortFerias} onToggle={toggleSortFerias} />
                <SortableHeader col="saldo" label="Saldo" sort={sortFerias} onToggle={toggleSortFerias} align="center" />
                <th className="text-center px-4 py-3.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid oklch(0.940 0.004 240)" }}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
                : sortedData.map((c, idx) => {
                  const dl = toDateStr(c.dataLimite as any);
                  const st = calcularStatus(dl);
                  const dias = diasRestantes(dl);

                  const rowStyle: React.CSSProperties = {
                    borderBottom: "1px solid oklch(0.940 0.004 240)",
                    background: st === "urgente"
                      ? "rgba(239,68,68,0.04)"
                      : st === "critico"
                      ? "rgba(249,115,22,0.03)"
                      : st === "alerta"
                      ? "rgba(234,179,8,0.03)"
                      : idx % 2 === 1 ? "oklch(0.980 0.002 240 / 0.5)" : "white",
                  };

                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors group cursor-pointer" style={rowStyle}>
                      {/* Nome */}
                      <td className="px-5 py-3.5">
                        <NomeColaborador nome={c.nome} className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors" maxChars={28} />
                        {c.setorNome && <p className="text-xs text-muted-foreground mt-0.5">{c.setorNome}</p>}
                      </td>
                      {/* Empresa */}
                      <td className="px-4 py-3.5">
                        {c.empresaNome ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                            style={{ background: "oklch(0.945 0.006 240)", color: "oklch(0.30 0.015 240)", border: "1px solid oklch(0.885 0.006 240)" }}>
                            {c.empresaNome}
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      {/* Admissão */}
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDate(c.admissao as any)}
                      </td>
                      {/* Período Aquisitivo */}
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDate(c.periodoAquisitivo as any)}
                      </td>
                      {/* Vencimento */}
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDate(c.vencimento as any)}
                      </td>
                      {/* Data Limite */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-xs font-semibold ${
                          st === "urgente" || st === "critico" ? "text-red-600" :
                          st === "alerta" ? "text-orange-600" :
                          st === "atencao" ? "text-blue-600" : "text-foreground"
                        }`}>
                          {formatDate(dl)}
                        </span>
                        {dias !== null && (
                          <span className="text-[11px] text-muted-foreground ml-1.5">
                            {dias < 0 ? `(${Math.abs(dias)}d atrás)` : `(${dias}d)`}
                          </span>
                        )}
                      </td>
                      {/* Saldo */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-semibold text-foreground">{c.saldo ?? "—"}</span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusColor(st)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                          {statusLabel(st)}
                        </span>
                      </td>
                      {/* Ação */}
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/ferias/${c.id}`}>
                          <Button variant="ghost" size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!isLoading && sortedData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "oklch(0.955 0.005 240)", border: "1px solid oklch(0.885 0.006 240)" }}>
              <CalendarDays className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">Nenhum registro encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters ? "Tente ajustar os filtros de busca" : "Nenhum colaborador ativo com dados de férias"}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-4 gap-1.5"
                onClick={() => { setBusca(""); setBuscaDebounced(""); setEmpresaId(undefined); setSetorId(undefined); setStatusFerias("todos"); setPage(1); }}>
                <X className="w-3.5 h-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderTop: "1px solid oklch(0.885 0.006 240)", background: "oklch(0.975 0.003 240)" }}>
            <p className="text-sm text-muted-foreground">
              Página <span className="font-semibold text-foreground">{page}</span> de <span className="font-semibold text-foreground">{totalPages}</span>
              {data && <span className="ml-2 text-muted-foreground/70">· {data.total} colaboradores</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
