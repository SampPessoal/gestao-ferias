import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, AlertTriangle, Clock, CheckCircle2, TrendingUp, ChevronRight,
  CalendarX, Building2, Activity, ArrowUpRight, Palmtree, Calendar,
  ShieldAlert, Timer, Zap
} from "lucide-react";
import { Link } from "wouter";
import { formatDate, calcularStatus, statusColor, diasRestantes, toDateStr } from "@/lib/ferias";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Hook de animação de contagem
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef<number>(0);
  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    if (target === 0) { setCount(0); return; }
    const start = Date.now();
    const from = count;
    const diff = target - from;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(from + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return count;
}

function getDataFormatada() {
  const now = new Date();
  return now.toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Bahia"
  });
}

function getSaudacao() {
  const hora = new Date().toLocaleString("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Bahia" });
  const h = parseInt(hora);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, accentColor, bgFrom, bgTo, borderColor, href, tooltipLines
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  accentColor: string;
  bgFrom: string;
  bgTo: string;
  borderColor: string;
  href?: string;
  tooltipLines?: string[];
}) {
  const numericValue = typeof value === "number" ? value : 0;
  const animatedValue = useCountUp(numericValue);
  const displayValue = typeof value === "number" ? animatedValue : value;
  const content = (
    <div
      className="relative overflow-hidden rounded-2xl p-5 cursor-pointer group transition-all duration-200 hover:-translate-y-1 hover:shadow-lg h-full flex flex-col justify-between"
      style={{
        background: `linear-gradient(135deg, ${bgFrom} 0%, ${bgTo} 100%)`,
        border: `1px solid ${borderColor}`,
        boxShadow: "0 2px 8px oklch(0.145 0.03 245 / 0.07)",
        minHeight: "140px"
      }}
    >
      {/* Círculo decorativo */}
      <div
        className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-[0.12] transition-transform duration-300 group-hover:scale-110"
        style={{ background: accentColor }}
      />
      <div
        className="absolute -right-2 bottom-2 w-16 h-16 rounded-full opacity-[0.07]"
        style={{ background: accentColor }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: accentColor, opacity: 0.8 }}>
            {title}
          </p>
          <p className="text-4xl font-black leading-none tracking-tight" style={{ fontFamily: "var(--font-display)", color: accentColor }}>
            {displayValue}
          </p>
          {subtitle && (
            <p className="text-xs mt-2 font-medium" style={{ color: accentColor, opacity: 0.65 }}>{subtitle}</p>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105"
          style={{ background: `${accentColor}22` }}
        >
          <Icon className="w-6 h-6" style={{ color: accentColor }} />
        </div>
      </div>

      {href && (
        <div className="relative mt-4 flex items-center gap-1 text-xs font-semibold transition-all duration-200 group-hover:gap-2" style={{ color: accentColor, opacity: 0.7 }}>
          <span>Ver detalhes</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );

  const wrapped = tooltipLines && tooltipLines.length > 0 ? (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs space-y-1 p-3">
          {tooltipLines.map((line, i) => <p key={i}>{line}</p>)}
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  ) : content;

  if (href) return <Link href={href} className="h-full block">{wrapped}</Link>;
  return wrapped;
}

// ── Mini Progress Bar ─────────────────────────────────────────────────────────

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// Constante fora do componente para evitar nova referência a cada render
const ALERTAS_QUERY_INPUT = { limit: 20 };

export default function Dashboard() {
  const { data: stats, isLoading: loadingStats } = trpc.dashboard.stats.useQuery();
  const { data: alertas, isLoading: loadingAlertas } = trpc.dashboard.alertas.useQuery(ALERTAS_QUERY_INPUT);
  const { data: statusPorSetor, isLoading: loadingSetor } = trpc.dashboard.statusPorSetor.useQuery();
  const { data: statusPorEmpresa } = trpc.dashboard.statusPorEmpresa.useQuery();

  const topSetores = (statusPorSetor ?? [])
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const maxTotal = topSetores.reduce((m, s) => Math.max(m, s.total), 0);

  const totalColabs = statusPorEmpresa?.reduce((s, e) => s + e.total, 0) ?? 0;

  // Dados para o mini-donut de status
  // vence30, vence60, vence90 são cumulativos no backend (vence90 inclui vence30 e vence60)
  // emDia = ativos sem nenhum alerta (vence > 90d ou sem data limite)
  const pieData = stats ? [
    { name: "Urgente (passou da data)", value: stats.vencidas, color: "#dc2626" },
    { name: "Crítico (≤30 dias)", value: stats.vence30, color: "#f97316" },
    { name: "Alerta (≤60 dias)", value: Math.max(0, stats.vence60 - stats.vence30), color: "#f59e0b" },
    { name: "Atenção (≤90 dias)", value: Math.max(0, stats.vence90 - stats.vence60), color: "#eab308" },
    { name: "Em dia", value: Math.max(0, stats.ativos - stats.vencidas - stats.vence90), color: "#10b981" },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Header ── */}
      <div className="relative rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)"
      }}>
        {/* Padrão pontilhado sutil */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: "radial-gradient(oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }} />
        <div className="relative px-7 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img
                src="/manus-storage/logo-gestao-rh_c85a262f.png"
                alt="Gestão de RH"
                className="w-8 h-8 rounded-xl object-contain"
                style={{ background: "oklch(0.18 0.06 252)", boxShadow: "0 2px 8px oklch(0.45 0.18 250 / 0.35)" }}
              />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "oklch(0.48 0.20 252)" }}>
                Gestão de RH
              </p>
            </div>
            <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {getSaudacao()}!
            </h1>
            <p className="text-sm mt-0.5 capitalize" style={{ color: "oklch(0.55 0.008 240)" }}>{getDataFormatada()}</p>
          </div>

          <div className="flex items-center gap-3">
            {stats && (stats.vencidas > 0 || stats.vence30 > 0) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "oklch(0.53 0.225 27 / 0.15)", border: "1px solid oklch(0.53 0.225 27 / 0.25)" }}>
                <ShieldAlert className="w-4 h-4" style={{ color: "#f87171" }} />
                <span className="text-sm font-bold" style={{ color: "#fca5a5" }}>
                  {stats.vencidas > 0 ? `${stats.vencidas} urgente${stats.vencidas > 1 ? "s" : ""}` : `${stats.vence30} crítico${stats.vence30 > 1 ? "s" : ""}`}
                </span>
              </div>
            )}
            <Link href="/ferias">
              <Button size="sm" className="gap-2 font-semibold" style={{
                background: "oklch(0.48 0.20 252)",
                border: "none",
                color: "oklch(0.13 0.07 254)"
              }}>
                <Calendar className="w-4 h-4" />
                Ver Férias
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              title="Colaboradores Ativos"
              value={stats?.ativos ?? 0}
              subtitle={`${stats?.inativos ?? 0} inativos no sistema`}
              icon={Users}
              accentColor="oklch(0.20 0.08 252)"
              bgFrom="white"
              bgTo="oklch(0.970 0.004 240)"
              borderColor="oklch(0.885 0.006 240)"
              href="/colaboradores"
              tooltipLines={[
                `✅ ${stats?.ativos ?? 0} colaboradores ativos`,
                `⛔ ${stats?.inativos ?? 0} inativos no sistema`,
                "Clique para ver todos os colaboradores"
              ]}
            />
            <StatCard
              title="Urgente"
              value={stats?.vencidas ?? 0}
              subtitle="Passou da data limite CLT"
              icon={CalendarX}
              accentColor="#dc2626"
              bgFrom="#fff5f5"
              bgTo="#fff0f0"
              borderColor="#fecaca"
              href="/ferias"
              tooltipLines={[
                `🚨 ${stats?.vencidas ?? 0} férias já passaram da data limite CLT`,
                stats?.vencidas === 0 ? "✅ Nenhuma férias vencida!" : "⚠️ Ação imediata necessária",
                "Clique para ver a lista de férias"
              ]}
            />
            <StatCard
              title="Crítico (≤30 dias)"
              value={stats?.vence30 ?? 0}
              subtitle="Data limite chegando"
              icon={AlertTriangle}
              accentColor="#ea580c"
              bgFrom="#fff7ed"
              bgTo="#fff3e8"
              borderColor="#fed7aa"
              href="/ferias"
              tooltipLines={[
                `🔥 ${stats?.vence30 ?? 0} colaboradores com férias vencendo em até 30 dias`,
                stats?.vence30 === 0 ? "✅ Nenhum colaborador crítico!" : "📅 Agende as férias com urgência",
                "Clique para ver a lista de férias"
              ]}
            />
            <StatCard
              title="Alerta (≤90 dias)"
              value={stats?.vence90 ?? 0}
              subtitle="Planeje as férias com antecedência"
              icon={Timer}
              accentColor="#d97706"
              bgFrom="#fffbeb"
              bgTo="#fef3c7"
              borderColor="#fde68a"
              href="/ferias"
              tooltipLines={[
                `⏰ ${stats?.vence90 ?? 0} colaboradores com férias vencendo em até 90 dias`,
                stats?.vence90 === 0 ? "✅ Nenhum alerta pendente!" : "📆 Planeje e agende com antecedência",
                "Clique para ver a lista de férias"
              ]}
            />
          </>
        )}
      </div>

      {/* ── Empresas + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Cards por empresa */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card p-4" style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                </div>
                Visão por Empresa
              </h2>
            </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(statusPorEmpresa ?? []).map((emp) => {
              const pctUrgente = emp.total > 0 ? Math.round((emp.vencidas / emp.total) * 100) : 0;
              const pctCritico = emp.total > 0 ? Math.round((emp.vence30 / emp.total) * 100) : 0;
              const emDia = emp.vencidas === 0 && emp.vence30 === 0;
              return (
                <div
                  key={emp.empresaId}
                  className="rounded-xl p-4 border border-border/60 bg-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-sm text-white"
                        style={{ background: "linear-gradient(135deg, oklch(0.20 0.08 252), oklch(0.28 0.012 240))" }}
                      >
                        {emp.empresaNome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground leading-tight">{emp.empresaNome}</p>
                        <p className="text-xs text-muted-foreground">{emp.total} colaboradores</p>
                      </div>
                    </div>
                    {emDia ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Em dia
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 shrink-0">
                        <AlertTriangle className="w-3 h-3" /> Atenção
                      </span>
                    )}
                  </div>

                  {/* Barra de status */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Situação das férias</span>
                      <span className="font-semibold">{100 - pctUrgente - pctCritico}% em dia</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden flex gap-0.5">
                      {pctUrgente > 0 && (
                        <div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${pctUrgente}%` }} />
                      )}
                      {pctCritico > 0 && (
                        <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${pctCritico}%` }} />
                      )}
                      <div className="h-full rounded-full bg-blue-500 flex-1 transition-all" />
                    </div>
                    <div className="flex gap-3 text-[11px]">
                      {emp.vencidas > 0 && <span className="text-red-700 font-semibold">{emp.vencidas} urgente{emp.vencidas > 1 ? "s" : ""}</span>}
                      {emp.vence30 > 0 && <span className="text-orange-600 font-semibold">{emp.vence30} crítico{emp.vence30 > 1 ? "s" : ""}</span>}
                      {emDia && <span className="text-blue-600 font-semibold">Tudo em ordem ✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* Donut de status geral */}
        <div className="lg:col-span-1">
          <div
            className="rounded-xl border border-border/60 bg-card p-5 flex flex-col items-center"
            style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                </div>
                Status Geral
              </h2>
            </div>
            <div className="flex flex-col items-center justify-center flex-1">
            {loadingStats ? (
              <Skeleton className="w-36 h-36 rounded-full" />
            ) : pieData.length > 0 ? (
              <>
                <div className="relative">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={pieData}
                      cx={75}
                      cy={75}
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-black text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                      {stats?.ativos ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">ativos</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 w-full">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground text-sm">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-blue-500" />
                <p>Sem dados ainda</p>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Alertas + Gráfico ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* Alertas urgentes */}
        <div className="lg:col-span-2">
          <div
            className="rounded-xl border border-border/60 bg-card overflow-hidden"
            style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                </div>
                Alertas Urgentes
                {alertas && alertas.length > 0 && (
                  <span className="ml-1 text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {alertas.length}
                  </span>
                )}
              </h2>
              {alertas && alertas.length > 0 && (
                <Link href="/ferias">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                    Ver todos <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              )}
            </div>
            {loadingAlertas ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : alertas && alertas.length > 0 ? (
              <div className="divide-y divide-border/50 max-h-[340px] overflow-y-auto">
                {alertas.map((a, idx) => {
                  const dl = toDateStr(a.dataLimite as any);
                  const status = calcularStatus(dl);
                  const dias = diasRestantes(dl);
                  const isVencida = dias !== null && dias < 0;
                  return (
                    <Link key={a.id} href={`/ferias/${a.id}`}>
                      <div className={`px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors group flex items-center gap-3 ${isVencida ? "bg-red-50/40" : ""}`}>
                        {/* Indicador lateral */}
                        <div className={`w-1 h-10 rounded-full shrink-0 ${isVencida ? "bg-red-500" : "bg-orange-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {a.nome}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.empresaNome} · {a.setorNome}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge className={`text-xs border font-bold ${statusColor(status)}`}>
                            {isVencida ? "Urgente" : `${dias}d`}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">{formatDate(dl)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-foreground">Tudo em ordem!</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhum alerta urgente no momento</p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico por setor */}
        <div className="lg:col-span-3">
          <div
            className="rounded-xl border border-border/60 bg-card p-4"
            style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                </div>
                Colaboradores por Setor
              </h2>
              <Link href="/setores">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                  Ver setores <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {loadingSetor ? (
              <Skeleton className="h-56 w-full rounded-lg" />
            ) : topSetores.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topSetores} layout="vertical" margin={{ left: 0, right: 30, top: 4, bottom: 4 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "oklch(0.55 0.022 240)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="setorNome"
                    tick={{ fontSize: 11, fill: "oklch(0.45 0.022 240)" }}
                    width={130}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    formatter={(value: number) => [value, "Colaboradores"]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 10,
                      border: "1px solid oklch(0.875 0.012 240)",
                      boxShadow: "0 4px 16px oklch(0.145 0.03 245 / 0.12)",
                      padding: "8px 12px"
                    }}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {topSetores.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.vencidas > 0 ? "#dc2626"
                          : entry.vence30 > 0 ? "#f97316"
                          : "oklch(0.20 0.08 252)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Legenda */}
            <div className="flex items-center gap-4 mt-1 px-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                <span>Urgente</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                <span>Crítico 30d</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.20 0.08 252)" }} />
                <span>Em dia</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabela por Setor ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            Status Detalhado por Setor
          </h2>
          <Link href="/setores">
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
              Ver setores <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <div
          className="rounded-xl border border-border/60 bg-card overflow-hidden"
          style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">#</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Empresa</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Setor</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Urgente</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Crítico 30d</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Saldo Médio</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest w-32">Situação</th>
                  <th className="px-4 py-3.5 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loadingSetor
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-5 py-3.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                  : (statusPorSetor ?? []).map((s, idx) => {
                    const temAlerta = s.vencidas > 0 || s.vence30 > 0;
                    return (
                      <tr key={s.setorId} className={`hover:bg-muted/25 transition-colors ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-5 py-3.5 text-xs font-bold text-muted-foreground/50">{idx + 1}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">{s.empresaNome}</td>
                        <td className="px-4 py-3.5 font-bold text-foreground">{s.setorNome}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="font-black text-foreground text-base" style={{ fontFamily: "var(--font-display)" }}>{s.total}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {s.vencidas > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-black bg-red-100 text-red-700">
                              {s.vencidas}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-lg">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {s.vence30 > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-black bg-orange-100 text-orange-700">
                              {s.vence30}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-lg">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="font-bold text-foreground">{s.saldoMedio}</span>
                          <span className="text-xs text-muted-foreground ml-1">dias</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="w-24">
                            <MiniBar
                          value={s.total - s.vencidas - s.vence30}
                          max={s.total}
                          color={temAlerta ? (s.vencidas > 0 ? "#dc2626" : "#f97316") : "#10b981"}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link href={`/setores/${s.setorId}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
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
        </div>
      </div>

    </div>
  );
}
