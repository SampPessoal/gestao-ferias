import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, ChevronRight, Users, AlertTriangle, CheckCircle2, Clock, Bell, Info, Shield, Pencil, Check, X } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EMPRESA_COLORS: Record<string, string> = {
  "Freire": "oklch(0.22 0.015 240)",
  "Sudoeste": "oklch(0.48 0.20 252)",
  "Solar": "oklch(0.55 0.145 148)",
  "Joanes": "oklch(0.30 0.012 240)",
};
function getEmpresaColor(nome: string) {
  // Tenta match parcial para nomes compostos (ex: "Freire Solar")
  for (const [key, color] of Object.entries(EMPRESA_COLORS)) {
    if (nome.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "oklch(0.22 0.015 240)";
}

type SetorStatus = {
  vencidas: number;
  vence30: number;
  vence60?: number;
  vence90?: number;
};

function getStatusInfo(s: SetorStatus) {
  const vence60 = s.vence60 ?? s.vence30;
  const vence90 = s.vence90 ?? s.vence30;
  // Contadores exclusivos (não cumulativos) para exibição
  const urgentes = s.vencidas;
  const criticos = s.vence30 - s.vencidas;
  const alertas  = vence60 - s.vence30;
  const atencoes = vence90 - vence60;

  if (urgentes > 0) return {
    label: "Urgente", color: "text-red-700", bg: "bg-red-100", border: "border-red-300",
    icon: AlertTriangle, dot: "bg-red-600",
    count: urgentes,
    desc: `${urgentes} urgente${urgentes > 1 ? "s" : ""} — passou da data limite`,
  };
  if (criticos > 0) return {
    label: "Crítico", color: "text-red-600", bg: "bg-red-50", border: "border-red-200",
    icon: Clock, dot: "bg-red-400",
    count: criticos,
    desc: `${criticos} crítico${criticos > 1 ? "s" : ""} — ≤ 30 dias`,
  };
  if (alertas > 0) return {
    label: "Alerta", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200",
    icon: Bell, dot: "bg-orange-500",
    count: alertas,
    desc: `${alertas} em alerta — ≤ 60 dias`,
  };
  if (atencoes > 0) return {
    label: "Atenção", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200",
    icon: Info, dot: "bg-blue-500",
    count: atencoes,
    desc: `${atencoes} em atenção — ≤ 90 dias`,
  };
  return {
    label: "Em dia", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200",
    icon: CheckCircle2, dot: "bg-blue-500",
    count: 0,
    desc: "Todas as férias em dia",
  };
}

export default function Setores() {
  const { data: setores, isLoading } = trpc.dashboard.statusPorSetor.useQuery();

  const totalColaboradores = setores?.reduce((acc, s) => acc + s.total, 0) ?? 0;
  const totalUrgentes  = setores?.reduce((acc, s) => acc + s.vencidas, 0) ?? 0;
  const totalCriticos  = setores?.reduce((acc, s) => acc + Math.max(0, s.vence30 - s.vencidas), 0) ?? 0;
  const totalEmDia     = (setores ?? []).filter(s => (s.vence90 ?? s.vence30) === 0).length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)"
      }}>
        <div className="px-7 py-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Setores</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Visão consolidada por setor e empresa — clique em um setor para ver os colaboradores</p>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de Colaboradores", value: totalColaboradores, icon: Users, color: "border-l-primary", bg: "bg-primary/5", text: "text-primary" },
          { label: "Urgente (passou da data)", value: totalUrgentes, icon: AlertTriangle, color: "border-l-red-600", bg: "bg-red-50", text: "text-red-700" },
          { label: "Crítico (≤30 dias)", value: totalCriticos, icon: Clock, color: "border-l-orange-500", bg: "bg-orange-50", text: "text-orange-600" },
          { label: "Setores em Dia", value: totalEmDia, icon: CheckCircle2, color: "border-l-emerald-500", bg: "bg-blue-50", text: "text-blue-600" },
        ].map(item => (
          <div key={item.label}
            className={`rounded-xl border border-l-4 ${item.color} border-border/60 ${item.bg} p-4`}
            style={{ boxShadow: "0 1px 3px oklch(0.145 0.03 245 / 0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <item.icon className={`w-4 h-4 ${item.text}`} />
            </div>
            <p className={`text-2xl font-bold ${item.text}`} style={{ fontFamily: "var(--font-display)" }}>{item.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Grid de setores */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))
          : (setores ?? []).map((s) => {
            const status = getStatusInfo(s);
            const StatusIcon = status.icon;
            const empColor = getEmpresaColor(s.empresaNome);

            // Contadores exclusivos para exibição no card
            const vence60 = (s as any).vence60 ?? s.vence30;
            const vence90 = (s as any).vence90 ?? s.vence30;
            const urgentes = s.vencidas;
            const criticos = s.vence30 - s.vencidas;
            const alertas  = vence60 - s.vence30;
            const atencoes = vence90 - vence60;
            const temAlerta = urgentes + criticos + alertas + atencoes > 0;

            return (
              <Link key={s.setorId} href={`/setores/${s.setorId}`}>
                <div
                  className="group rounded-xl border border-border/60 bg-card cursor-pointer transition-all duration-200 hover:-translate-y-0.5 overflow-hidden h-full"
                  style={{ boxShadow: "0 2px 8px oklch(0.145 0.03 245 / 0.06)" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 20px oklch(0.145 0.03 245 / 0.12)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 8px oklch(0.145 0.03 245 / 0.06)")}
                >
                  {/* Barra de cor da empresa */}
                  <div className="h-1.5 w-full" style={{ background: empColor }} />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${empColor}18`, border: `1px solid ${empColor}30` }}>
                          <Building2 className="w-5 h-5" style={{ color: empColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{s.setorNome}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.empresaNome}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>

                    {/* Métricas */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="text-center rounded-lg py-2 bg-muted/30">
                        <p className="text-base font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{s.total}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Colaboradores</p>
                      </div>
                      <div className="text-center rounded-lg py-2 bg-muted/30">
                        <p className="text-base font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{s.saldoMedio}d</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Saldo médio</p>
                      </div>
                      <div className={`text-center rounded-lg py-2 ${status.bg} border ${status.border}`}>
                        <p className={`text-base font-bold ${status.color}`} style={{ fontFamily: "var(--font-display)" }}>
                          {temAlerta ? status.count : "✓"}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${status.color} font-medium`}>{status.label}</p>
                      </div>
                    </div>

                    {/* Faixas de alerta detalhadas */}
                    {temAlerta ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {urgentes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {urgentes} urgente{urgentes > 1 ? "s" : ""}
                          </span>
                        )}
                        {criticos > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            <Clock className="w-2.5 h-2.5" />
                            {criticos} crítico{criticos > 1 ? "s" : ""}
                          </span>
                        )}
                        {alertas > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                            <Bell className="w-2.5 h-2.5" />
                            {alertas} alerta{alertas > 1 ? "s" : ""}
                          </span>
                        )}
                        {atencoes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            <Info className="w-2.5 h-2.5" />
                            {atencoes} atenção
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <CheckCircle2 className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-medium text-blue-600">Todas as férias em dia</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
      </div>

      {/* Configuração de Seguro de Vida por Empresa */}
      <ConfiguracaoSeguroVida />
    </div>
  );
}

function ConfiguracaoSeguroVida() {
  const utils = trpc.useUtils();
  const { data: empresas = [], isLoading } = trpc.empresas.list.useQuery();
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [valorTemp, setValorTemp] = useState("");

  const atualizar = trpc.empresas.updateValorSeguro.useMutation({
    onSuccess: () => {
      utils.empresas.list.invalidate();
      utils.colaboradores.listAtivos.invalidate();
      toast.success("Valor do seguro de vida atualizado!");
      setEditandoId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const iniciarEdicao = (id: number, valorAtual: string | null) => {
    setEditandoId(id);
    setValorTemp(valorAtual ? parseFloat(String(valorAtual)).toFixed(2) : "");
  };

  const salvar = (id: number) => {
    atualizar.mutate({ id, valorSeguroVida: valorTemp || null });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden"
      style={{ boxShadow: "0 2px 8px oklch(0.145 0.03 245 / 0.06)" }}>
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.48 0.20 252 / 0.20)", border: "1px solid oklch(0.48 0.20 252 / 0.30)" }}>
          <Shield className="w-4 h-4" style={{ color: "oklch(0.70 0.15 252)" }} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Valor do Seguro de Vida por Empresa</h2>
          <p className="text-xs" style={{ color: "oklch(0.65 0.008 240)" }}>Configure o desconto mensal do seguro de vida para cada empresa. Este valor é preenchido automaticamente ao lançar um novo colaborador na Movimentação do Mês.</p>
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 mx-4 my-2 rounded-lg" />)
        ) : empresas.map(emp => (
          <div key={emp.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted/40">
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{emp.nome}</p>
            </div>
            {editandoId === emp.id ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorTemp}
                    onChange={e => setValorTemp(e.target.value)}
                    className="w-28 pl-8 h-8 text-sm"
                    placeholder="0,00"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") salvar(emp.id); if (e.key === "Escape") setEditandoId(null); }}
                  />
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:text-emerald-300" onClick={() => salvar(emp.id)} disabled={atualizar.isPending}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditandoId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {(emp as any).valorSeguroVida ? (
                  <span className="text-sm font-semibold text-emerald-400">
                    R$ {parseFloat(String((emp as any).valorSeguroVida)).toFixed(2).replace('.', ',')}
                  </span>
                ) : (
                  <span className="text-xs text-amber-400/80">Não configurado</span>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => iniciarEdicao(emp.id, (emp as any).valorSeguroVida)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
