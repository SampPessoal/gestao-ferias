import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronRight, Download, AlertTriangle, Clock, Bell, Info, Users, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { calcularStatus, statusColor, statusLabelCurto, formatDate, diasRestantes, toDateStr } from "@/lib/ferias";
import { toast } from "sonner";
import { useMemo } from "react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";

export default function SetorDetalhe({ id }: { id: number }) {
  const { data: setores } = trpc.setores.list.useQuery();
  const { data: colaboradores, isLoading } = trpc.setores.colaboradoresPorSetor.useQuery({ setorId: id });
  const { data: csvData } = trpc.colaboradores.exportCsv.useQuery({ setorId: id });

  const { sort: sortSetor, toggle: toggleSortSetor, sortData: sortSetorData } = useTableSort<
    "nome" | "admissao" | "periodoAquisitivo" | "vencimento" | "dataLimite" | "saldo"
  >("dataLimite", "asc");

  const setor = setores?.find(s => s.id === id);

  const sortedColaboradores = useMemo(
    () => sortSetorData((colaboradores ?? []) as any[]),
    [colaboradores, sortSetor]
  );

  function downloadCsv() {
    if (!csvData) return;
    const blob = new Blob(["\uFEFF" + csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ferias-${setor?.nome ?? "setor"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  }

  // Contadores exclusivos por faixa (não cumulativos)
  const urgentes  = colaboradores?.filter((c: any) => calcularStatus(toDateStr(c.dataLimite)) === "urgente").length ?? 0;
  const criticos  = colaboradores?.filter((c: any) => calcularStatus(toDateStr(c.dataLimite)) === "critico").length ?? 0;
  const alertas   = colaboradores?.filter((c: any) => calcularStatus(toDateStr(c.dataLimite)) === "alerta").length  ?? 0;
  const atencoes  = colaboradores?.filter((c: any) => calcularStatus(toDateStr(c.dataLimite)) === "atencao").length ?? 0;
  const emDia     = colaboradores?.filter((c: any) => {
    const st = calcularStatus(toDateStr(c.dataLimite));
    return st === "em_dia" || st === "sem_data";
  }).length ?? 0;

  const temAlerta = urgentes + criticos + alertas + atencoes > 0;

  return (
    <div className="space-y-6">
      {/* Navegação */}
      <div className="flex items-center gap-4">
        <Link href="/setores">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Setores
          </Button>
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            {setor?.nome ?? "Setor"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isLoading ? "Carregando..." : `${colaboradores?.length ?? 0} colaboradores ativos`}
          </p>

          {/* Faixas de alerta */}
          {!isLoading && (
            <div className="flex flex-wrap gap-2 mt-3">
              {urgentes > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-200 text-red-900 border border-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  {urgentes} urgente{urgentes > 1 ? "s" : ""} — passou da data limite
                </span>
              )}
              {criticos > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                  <Clock className="w-3 h-3" />
                  {criticos} crítico{criticos > 1 ? "s" : ""} — ≤ 30 dias
                </span>
              )}
              {alertas > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                  <Bell className="w-3 h-3" />
                  {alertas} em alerta — ≤ 60 dias
                </span>
              )}
              {atencoes > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                  <Info className="w-3 h-3" />
                  {atencoes} em atenção — ≤ 90 dias
                </span>
              )}
              {!temAlerta && emDia > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Todas as férias em dia
                </span>
              )}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-1 shrink-0">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Tabela de colaboradores */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : !colaboradores || colaboradores.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhum colaborador ativo</p>
              <p className="text-xs text-muted-foreground mt-1">Este setor não possui colaboradores ativos cadastrados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <SortableHeader col="nome" label="Nome" sort={sortSetor} onToggle={toggleSortSetor} />
                    <SortableHeader col="admissao" label="Admissão" sort={sortSetor} onToggle={toggleSortSetor} />
                    <SortableHeader col="periodoAquisitivo" label="Período Aquisitivo" sort={sortSetor} onToggle={toggleSortSetor} />
                    <SortableHeader col="vencimento" label="Vencimento" sort={sortSetor} onToggle={toggleSortSetor} />
                    <SortableHeader col="dataLimite" label="Data Limite" sort={sortSetor} onToggle={toggleSortSetor} />
                    <SortableHeader col="saldo" label="Saldo" sort={sortSetor} onToggle={toggleSortSetor} align="center" />
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Venda 10d</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Planejamentos</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Alerta</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedColaboradores.map((c: any) => {
                    const dl = toDateStr(c.dataLimite);
                    const st = calcularStatus(dl);
                    const dias = diasRestantes(dl);
                    const planos = [c.planejamento1, c.planejamento2, c.planejamento3].filter(Boolean);
                    const rowBg =
                      st === "urgente" ? "bg-red-50/70" :
                      st === "critico" ? "bg-red-50/40" :
                      st === "alerta"  ? "bg-orange-50/30" :
                      st === "atencao" ? "bg-blue-50/20" : "";

                    return (
                      <tr key={c.id} className={`border-b border-border hover:bg-muted/20 transition-colors ${rowBg}`}>
                        <td className="px-4 py-3 font-medium"><NomeColaborador nome={c.nome} maxChars={28} className="font-medium" /></td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(c.admissao as any)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(c.periodoAquisitivo as any)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDate(c.vencimento as any)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={
                            st === "urgente" || st === "critico" ? "font-semibold text-red-600 text-xs" :
                            st === "alerta" ? "font-medium text-orange-600 text-xs" :
                            st === "atencao" ? "font-medium text-blue-600 text-xs" : "text-xs"
                          }>
                            {formatDate(dl)}
                          </span>
                          {dias !== null && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              ({dias < 0 ? `${Math.abs(dias)}d atrás` : `${dias}d`})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-sm">{c.saldo ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {c.venda10 === "SIM" ? (
                            <Badge className="text-xs border bg-blue-100 text-blue-700 border-blue-200">Sim</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Não</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-48">
                          {planos.length > 0 ? (
                            <div className="space-y-0.5">
                              {planos.map((p: string, i: number) => (
                                <p key={i} className="text-xs text-muted-foreground truncate">{p}</p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {st !== "em_dia" && st !== "sem_data" ? (
                            <Badge className={`text-xs border ${statusColor(st)}`}>
                              {statusLabelCurto(st)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/colaboradores/${c.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
