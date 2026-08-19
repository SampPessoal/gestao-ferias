import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Edit2, Save, X, CalendarDays, Building2, AlertTriangle, Briefcase,
  Clock, CheckCircle2, TrendingUp, FileText
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { calcularStatus, statusColor, statusLabel, formatDate, diasRestantes, toDateStr, calcPeriodoFerias } from "@/lib/ferias";

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-right ${highlight ? "text-red-500" : "text-foreground"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50 bg-muted/20">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function FeriasDetalhe({ id }: { id: number }) {
  const utils = trpc.useUtils();
  const { data: colaborador, isLoading, isError, error, refetch } = trpc.colaboradores.byId.useQuery({ id }, { retry: 2 });
  const updateMutation = trpc.colaboradores.update.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados com sucesso!");
      utils.colaboradores.byId.invalidate({ id });
      setEditing(false);
    },
    onError: (err) => {
      const msg = err?.message ?? "Erro desconhecido";
      toast.error(`Erro ao atualizar dados. ${msg}`);
    },
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  function startEdit() {
    if (!colaborador) return;
    setForm({
      saldo: colaborador.saldo ?? 30,
      diasDireito: colaborador.diasDireito ?? 30,
      venda10: colaborador.venda10 ?? "NAO",
      fracionada: colaborador.fracionada ?? "",
      planejamento1: colaborador.planejamento1 ?? "",
      planejamento2: colaborador.planejamento2 ?? "",
      planejamento3: colaborador.planejamento3 ?? "",
      observacoes: colaborador.observacoes ?? "",
      admissao: toDateStr(colaborador.admissao as any) ?? "",
      periodoAquisitivo: toDateStr(colaborador.periodoAquisitivo as any) ?? "",
      vencimento: toDateStr(colaborador.vencimento as any) ?? "",
      dataLimite: toDateStr(colaborador.dataLimite as any) ?? "",
    });
    setEditing(true);
  }

  function saveEdit() {
    updateMutation.mutate({
      id,
      saldo: Number(form.saldo),
      diasDireito: Number(form.diasDireito),
      venda10: form.venda10 || null,
      fracionada: form.fracionada || null,
      planejamento1: form.planejamento1 || null,
      planejamento2: form.planejamento2 || null,
      planejamento3: form.planejamento3 || null,
      observacoes: form.observacoes || null,
      admissao: form.admissao || null,
      periodoAquisitivo: form.periodoAquisitivo || null,
      vencimento: form.vencimento || null,
      dataLimite: form.dataLimite || null,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    const isDbError = error?.message?.includes('indispon') || error?.message?.includes('unavailable') || error?.message?.includes('INTERNAL_SERVER_ERROR');
    return (
      <div className="text-center py-20">
        {isDbError ? (
          <>
            <p className="text-muted-foreground font-medium">Servidor reiniciando...</p>
            <p className="text-sm text-muted-foreground/70 mt-1">O banco de dados está sendo inicializado. Aguarde alguns segundos.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => refetch()}>
              <span>↻</span> Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Colaborador não encontrado.</p>
            <Link href="/ferias"><Button variant="outline" className="mt-4">Voltar</Button></Link>
          </>
        )}
      </div>
    );
  }
  if (!colaborador) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Colaborador não encontrado.</p>
        <Link href="/ferias">
          <Button variant="outline" className="mt-4">Voltar</Button>
        </Link>
      </div>
    );
  }

  const dl = toDateStr(colaborador.dataLimite as any);
  const status = calcularStatus(dl);
  const dias = diasRestantes(dl);
  const isInativo = colaborador.status === "inativo";
  const c = colaborador as any;

  const avatarColors = [
    "oklch(0.22 0.015 240)", "oklch(0.25 0.012 240)", "oklch(0.28 0.015 240)",
    "oklch(0.20 0.012 240)", "oklch(0.30 0.012 240)", "oklch(0.20 0.08 252)"
  ];
  const avatarColor = avatarColors[(colaborador.nome?.charCodeAt(0) ?? 0) % avatarColors.length];
  const initials = (colaborador.nome ?? "?")
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w: string) => w[0]).join("").toUpperCase();

  const alertStyle: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    urgente:  { bg: "bg-red-950/40",    border: "border-red-500/60",    text: "text-red-300",    icon: "text-red-400" },
    critico:  { bg: "bg-red-900/30",    border: "border-red-400/50",    text: "text-red-200",    icon: "text-red-300" },
    alerta:   { bg: "bg-orange-900/30", border: "border-orange-400/50", text: "text-orange-200", icon: "text-orange-300" },
    atencao:  { bg: "bg-blue-900/30",   border: "border-blue-400/50",   text: "text-blue-200",   icon: "text-blue-300" },
  };
  const al = alertStyle[status] ?? null;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Breadcrumb + ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/ferias">
            <button className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium">
              <ArrowLeft className="w-4 h-4" />
              Férias
            </button>
          </Link>
          <span className="opacity-40">/</span>
          <span className="text-foreground font-semibold truncate max-w-xs">{colaborador.nome}</span>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button size="sm" onClick={startEdit} disabled={isInativo} className="gap-1.5 h-8 text-xs">
              <Edit2 className="w-3.5 h-3.5" /> Editar
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} className="gap-1.5 h-8 text-xs">
                <Save className="w-3.5 h-3.5" /> Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="gap-1.5 h-8 text-xs">
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hero banner escuro */}
      <div className="rounded-2xl overflow-hidden border border-border/40"
        style={{
          background: "linear-gradient(135deg, oklch(0.16 0.025 245) 0%, oklch(0.12 0.018 248) 60%, oklch(0.10 0.012 250) 100%)",
          boxShadow: "0 4px 24px oklch(0.08 0.02 248 / 0.5)"
        }}>
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, oklch(0.55 0.18 248), oklch(0.65 0.14 220), oklch(0.55 0.18 248))" }} />
        <div className="p-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${avatarColor}, oklch(0.35 0.12 248))` }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {colaborador.nome}
                </h1>
                {isInativo && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-700/60 text-gray-300 border border-gray-600/50">
                    Inativo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-sm text-blue-200/70">
                <Building2 className="w-3.5 h-3.5" />
                <span className="font-medium text-blue-100/80">{colaborador.empresaNome ?? "—"}</span>
                {colaborador.setorNome && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{colaborador.setorNome}</span>
                  </>
                )}
                {c.cargo && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{c.cargo}</span>
                  </>
                )}
              </div>
            </div>
            {!isInativo && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${statusColor(status)}`}>
                <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                {statusLabel(status)}
                {dias !== null && (
                  <span className="opacity-70 text-xs">
                    {dias < 0 ? `(${Math.abs(dias)}d atrás)` : `(${dias}d)`}
                  </span>
                )}
              </span>
            )}
          </div>

          {!isInativo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[
                { label: "Admissão", value: formatDate(colaborador.admissao as any), icon: Clock },
                { label: "Período Aquisitivo", value: formatDate(colaborador.periodoAquisitivo as any), icon: CalendarDays },
                { label: "Vencimento", value: formatDate(colaborador.vencimento as any), icon: CheckCircle2 },
                { label: "Data Limite CLT", value: formatDate(dl), icon: AlertTriangle, highlight: ["urgente","critico","alerta","atencao"].includes(status) },
              ].map(m => (
                <div key={m.label} className="rounded-xl p-3 border"
                  style={{
                    background: "oklch(0.18 0.02 245 / 0.6)",
                    borderColor: (m as any).highlight ? "oklch(0.55 0.18 25 / 0.5)" : "oklch(0.35 0.04 245 / 0.4)"
                  }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <m.icon className={`w-3 h-3 ${(m as any).highlight ? "text-red-400" : "text-blue-300/60"}`} />
                    <p className="text-xs font-medium text-blue-200/50 uppercase tracking-wide">{m.label}</p>
                  </div>
                  <p className={`text-sm font-semibold ${(m as any).highlight ? "text-red-400" : "text-white"}`}>
                    {m.value || "—"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!isInativo && al && (
            <div className={`mt-4 flex items-center gap-3 p-4 rounded-xl border ${al.bg} ${al.border}`}>
              <AlertTriangle className={`w-5 h-5 shrink-0 ${al.icon}`} />
              <div>
                <p className={`text-sm font-semibold ${al.text}`}>
                  {status === "urgente"
                    ? `Data limite ultrapassada há ${Math.abs(dias ?? 0)} dias — Risco de infração trabalhista!`
                    : status === "critico"
                    ? `Data limite em ${dias} dias — Ação urgente necessária!`
                    : status === "alerta"
                    ? `Data limite em ${dias} dias — Agende as férias em breve.`
                    : `Data limite em ${dias} dias — Planeje as férias com antecedência.`}
                </p>
                <p className="text-xs text-blue-200/40 mt-0.5">Data limite CLT: {formatDate(dl)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid de 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna 1 — Datas */}
        <SectionCard title="Datas de Férias" icon={CalendarDays}>
          {editing ? (
            <div className="space-y-3">
              {[
                { key: "admissao", label: "Admissão" },
                { key: "periodoAquisitivo", label: "Período Aquisitivo" },
                { key: "vencimento", label: "Vencimento" },
                { key: "dataLimite", label: "Data Limite CLT" },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{f.label}</Label>
                  <Input type="date" className="h-8 text-sm" value={form[f.key]}
                    onChange={e => {
                      const val = e.target.value;
                      if (f.key === 'admissao' && val) {
                        // Ao alterar admissão: recalcula PA, vencimento e data limite
                        const calc = calcPeriodoFerias(val);
                        setForm({ ...form, admissao: val, periodoAquisitivo: val, vencimento: calc.vencimento, dataLimite: calc.dataLimite });
                      } else if (f.key === 'periodoAquisitivo' && val) {
                        // Ao alterar período aquisitivo manualmente: recalcula vencimento e data limite
                        // Útil para colaboradores já avançados (admitidos em 2015, 2018 etc.)
                        const calc = calcPeriodoFerias(val);
                        setForm({ ...form, periodoAquisitivo: val, vencimento: calc.vencimento, dataLimite: calc.dataLimite });
                      } else {
                        setForm({ ...form, [f.key]: val });
                      }
                    }} />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <InfoRow label="Admissão" value={formatDate(colaborador.admissao as any)} />
              <InfoRow label="Período Aquisitivo" value={formatDate(colaborador.periodoAquisitivo as any)} />
              <InfoRow label="Vencimento" value={formatDate(colaborador.vencimento as any)} />
              <InfoRow label="Data Limite CLT" value={formatDate(dl)} highlight={["urgente","critico","alerta","atencao"].includes(status)} />
            </div>
          )}
        </SectionCard>

        {/* Coluna 2 — Saldo */}
        <SectionCard title="Saldo e Direitos" icon={TrendingUp}>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Dias de Direito</Label>
                <Input type="number" className="h-8 text-sm" value={form.diasDireito}
                  onChange={e => setForm({ ...form, diasDireito: e.target.value })} min={0} max={30} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Saldo de Férias</Label>
                <Input type="number" className="h-8 text-sm" value={form.saldo}
                  onChange={e => setForm({ ...form, saldo: e.target.value })} min={0} max={30} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Venda 10 dias</Label>
                <Select value={form.venda10 || "NAO"} onValueChange={v => setForm({ ...form, venda10: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAO">Não</SelectItem>
                    <SelectItem value="SIM">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fracionada</Label>
                <Input className="h-8 text-sm" value={form.fracionada}
                  onChange={e => setForm({ ...form, fracionada: e.target.value })}
                  placeholder="Ex: SIM, 2 PERÍODOS" />
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label="Dias de Direito" value={`${colaborador.diasDireito ?? 30} dias`} />
              <InfoRow label="Saldo de Férias" value={`${colaborador.saldo ?? 30} dias`} />
              <InfoRow label="Venda 10 dias" value={colaborador.venda10 === "SIM" ? "Sim" : "Não"} />
              <InfoRow label="Fracionada" value={colaborador.fracionada} />
            </div>
          )}
        </SectionCard>

        {/* Coluna 3 — Planejamento */}
        <SectionCard title="Planejamento" icon={FileText}>
          {editing ? (
            <div className="space-y-3">
              {[
                { key: "planejamento1", label: "Planejamento 1", placeholder: "Ex: 01/01/2026 a 15/01/2026" },
                { key: "planejamento2", label: "Planejamento 2", placeholder: "Ex: 01/07/2026 a 15/07/2026" },
                { key: "planejamento3", label: "Planejamento 3", placeholder: "Opcional" },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">{f.label}</Label>
                  <Input className="h-8 text-sm" value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div className="space-y-1 pt-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Observações</Label>
                <Textarea value={form.observacoes}
                  onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações sobre as férias deste colaborador..."
                  rows={3} className="text-sm resize-none" />
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label="Planejamento 1" value={colaborador.planejamento1} />
              <InfoRow label="Planejamento 2" value={colaborador.planejamento2} />
              <InfoRow label="Planejamento 3" value={colaborador.planejamento3} />
              {colaborador.observacoes && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Observações</p>
                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">
                    {colaborador.observacoes}
                  </p>
                </div>
              )}
              {!colaborador.planejamento1 && !colaborador.planejamento2 && !colaborador.planejamento3 && !colaborador.observacoes && (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum planejamento registrado.</p>
                  <p className="text-xs mt-1 opacity-60">Clique em Editar para adicionar.</p>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
