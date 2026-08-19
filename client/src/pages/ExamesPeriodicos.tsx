import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Stethoscope, Search, X, CheckCircle2, XCircle,
  Building2, Filter, Download, Layers, ChevronRight,
  CalendarDays, ClipboardList, User, AlertCircle, Clock,
  Send, SendHorizonal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import * as XLSX from "xlsx";

function getInitials(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

interface ExameRow {
  colaboradorId: number;
  colaboradorNome: string;
  empresaId: number;
  empresaNome: string;
  setorId: number | null;
  setorNome: string | null;
  exameId: number | null;
  realizou: boolean;
  dataExame: string | null;
  observacoes: string | null;
  enviadoContabilidade: boolean;
  dataEnvioContabilidade: string | null;
  admissao: string | null;
  proximoExame: string | null;
  diasParaProximoExame: number | null;
  statusExame: "ok" | "vencido" | "a_vencer" | "sem_admissao";
}

function formatarData(d: string | Date | null | undefined) {
  if (!d) return null;
  // Garante que temos uma string ISO "YYYY-MM-DD" independente do formato recebido
  let iso: string;
  if (d instanceof Date) {
    iso = d.toISOString().substring(0, 10);
  } else {
    // Pode vir como "2026-06-30T00:00:00.000Z" ou "2026-06-30"
    iso = String(d).substring(0, 10);
  }
  const parts = iso.split("-");
  if (parts.length !== 3 || parts[0].length !== 4) return String(d);
  const [y, m, dia] = parts;
  if (!y || !m || !dia) return String(d);
  return `${dia}/${m}/${y}`;
}

// Converte "YYYY-MM-DD" → "DD/MM/YYYY" para exibição
function isoParaBr(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Converte "DD/MM/YYYY" → "YYYY-MM-DD" para armazenamento
function brParaIso(br: string) {
  const clean = br.replace(/\D/g, "");
  if (clean.length !== 8) return "";
  return `${clean.slice(4)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`;
}

// Input de data com máscara dd/mm/aaaa — sempre em português
function DateInputBR({
  value, onChange, disabled, placeholder = "dd/mm/aaaa"
}: {
  value: string; // "YYYY-MM-DD"
  onChange: (iso: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(() => isoParaBr(value));

  // Sincronizar quando value muda externamente
  useMemo(() => { setDisplay(isoParaBr(value)); }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    let masked = raw;
    if (raw.length > 2) masked = raw.slice(0, 2) + "/" + raw.slice(2);
    if (raw.length > 4) masked = raw.slice(0, 2) + "/" + raw.slice(2, 4) + "/" + raw.slice(4);
    setDisplay(masked);
    if (raw.length === 8) {
      const iso = brParaIso(masked);
      const dt = new Date(iso);
      if (!isNaN(dt.getTime())) onChange(iso);
    } else {
      onChange("");
    }
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={10}
      className="h-10 text-sm"
      style={disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}}
    />
  );
}

// ─── Sheet lateral de edição ─────────────────────────────────────────────────
function SheetEditar({
  row,
  ano,
  open,
  onOpenChange,
  onSaved,
}: {
  row: ExameRow | null;
  ano: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [realizou, setRealizou] = useState<boolean>(false);
  const [dataExame, setDataExame] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [enviadoContabilidade, setEnviadoContabilidade] = useState<boolean>(false);
  const [dataEnvioContabilidade, setDataEnvioContabilidade] = useState<string>("");

  // Sincronizar estado quando a row muda
  useMemo(() => {
    if (row) {
      setRealizou(row.realizou);
      setDataExame(row.dataExame?.substring(0, 10) ?? "");
      setObservacoes(row.observacoes ?? "");
      setEnviadoContabilidade(row.enviadoContabilidade);
      setDataEnvioContabilidade(row.dataEnvioContabilidade?.substring(0, 10) ?? "");
    }
  }, [row]);

  const upsert = trpc.examesPeriodicos.upsert.useMutation({
    onSuccess: () => {
      toast.success("Exame atualizado com sucesso!");
      onSaved();
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar. Tente novamente."),
  });

  function handleSalvar() {
    if (!row) return;
    if (realizou && !dataExame) {
      toast.error("Informe a data em que o exame foi realizado.");
      return;
    }
    if (enviadoContabilidade && !dataEnvioContabilidade) {
      toast.error("Informe a data de envio para a contabilidade.");
      return;
    }
    upsert.mutate({
      colaboradorId: row.colaboradorId,
      ano,
      realizou,
      dataExame: realizou ? dataExame : null,
      observacoes: observacoes.trim() || undefined,
      enviadoContabilidade,
      dataEnvioContabilidade: enviadoContabilidade ? dataEnvioContabilidade : null,
    });
  }

  if (!row) return null;

  const initials = getInitials(row.colaboradorNome);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 flex flex-col overflow-hidden"
        style={{
          background: "oklch(0.98 0.002 240)",
          borderLeft: "1px solid oklch(0.88 0.006 240)",
        }}
      >
        {/* Header do colaborador */}
        <div
          className="px-6 pt-6 pb-5 shrink-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.20 0.08 252) 100%)",
            borderBottom: "1px solid oklch(0.25 0.09 252)",
          }}
        >
          <SheetHeader className="mb-0">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
                style={{
                  background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))",
                  boxShadow: "0 4px 12px oklch(0.60 0.13 65 / 0.35)",
                  color: "white",
                  letterSpacing: "0.05em",
                }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <SheetTitle className="text-white text-base font-bold leading-tight truncate">
                  {row.colaboradorNome}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs leading-relaxed" style={{ color: "oklch(0.65 0.008 240)" }}>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {row.empresaNome}
                    {row.setorNome && (
                      <>
                        <span style={{ color: "oklch(0.40 0.008 240)" }}>·</span>
                        {row.setorNome}
                      </>
                    )}
                  </span>
                </SheetDescription>
                {/* Badge status atual */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {row.realizou ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "oklch(0.35 0.10 145 / 0.25)", color: "oklch(0.82 0.12 145)", border: "1px solid oklch(0.45 0.10 145 / 0.4)" }}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Exame realizado em {ano}
                      {row.dataExame && ` · ${formatarData(row.dataExame)}`}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "oklch(0.35 0.12 30 / 0.25)", color: "oklch(0.82 0.10 30)", border: "1px solid oklch(0.45 0.12 30 / 0.4)" }}
                    >
                      <AlertCircle className="w-3 h-3" />
                      Pendente — sem registro em {ano}
                    </span>
                  )}
                  {row.enviadoContabilidade && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "oklch(0.35 0.10 250 / 0.25)", color: "oklch(0.80 0.12 250)", border: "1px solid oklch(0.45 0.10 250 / 0.4)" }}
                    >
                      <SendHorizonal className="w-3 h-3" />
                      Enviado à contabilidade
                      {row.dataEnvioContabilidade && ` · ${formatarData(row.dataEnvioContabilidade)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Formulário */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Realizou o exame? */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <ClipboardList className="w-3.5 h-3.5" />
              Realizou o exame periódico em {ano}?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRealizou(true)}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all duration-150"
                style={realizou ? {
                  background: "oklch(0.965 0.025 145)",
                  borderColor: "oklch(0.65 0.12 145)",
                  color: "oklch(0.35 0.12 145)",
                  boxShadow: "0 0 0 3px oklch(0.65 0.12 145 / 0.15)",
                } : {
                  background: "white",
                  borderColor: "oklch(0.88 0.006 240)",
                  color: "oklch(0.50 0.008 240)",
                }}
              >
                <CheckCircle2 className="w-6 h-6" style={{ color: realizou ? "oklch(0.55 0.14 145)" : "oklch(0.70 0.006 240)" }} />
                <span className="text-sm font-semibold">Sim</span>
                <span className="text-xs opacity-60">Realizado</span>
              </button>
              <button
                onClick={() => { setRealizou(false); setDataExame(""); }}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all duration-150"
                style={!realizou ? {
                  background: "oklch(0.970 0.015 25)",
                  borderColor: "oklch(0.65 0.12 25)",
                  color: "oklch(0.40 0.12 25)",
                  boxShadow: "0 0 0 3px oklch(0.65 0.12 25 / 0.15)",
                } : {
                  background: "white",
                  borderColor: "oklch(0.88 0.006 240)",
                  color: "oklch(0.50 0.008 240)",
                }}
              >
                <XCircle className="w-6 h-6" style={{ color: !realizou ? "oklch(0.55 0.14 25)" : "oklch(0.70 0.006 240)" }} />
                <span className="text-sm font-semibold">Não</span>
                <span className="text-xs opacity-60">Pendente</span>
              </button>
            </div>
          </div>

          <Separator />

          {/* Data do exame */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              Data do exame
              {realizou && <span className="text-red-500 font-bold">*</span>}
            </label>
            <DateInputBR
              value={dataExame}
              onChange={setDataExame}
              disabled={!realizou}
            />
            {!realizou && (
              <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Disponível apenas quando o exame foi realizado
              </p>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              Observações
              <span className="font-normal normal-case text-muted-foreground/50">(opcional)</span>
            </label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: Apto, pendente resultado, encaminhado para especialista..."
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition-all"
            />
            <p className="text-xs text-muted-foreground/40 text-right">{observacoes.length}/500</p>
          </div>

          <Separator />

          {/* Enviado para Contabilidade */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Send className="w-3.5 h-3.5" />
              Enviado para a contabilidade?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setEnviadoContabilidade(true)}
                className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl border-2 transition-all duration-150"
                style={enviadoContabilidade ? {
                  background: "oklch(0.965 0.020 250)",
                  borderColor: "oklch(0.60 0.12 250)",
                  color: "oklch(0.30 0.12 250)",
                  boxShadow: "0 0 0 3px oklch(0.60 0.12 250 / 0.15)",
                } : {
                  background: "white",
                  borderColor: "oklch(0.88 0.006 240)",
                  color: "oklch(0.50 0.008 240)",
                }}
              >
                <SendHorizonal className="w-5 h-5" style={{ color: enviadoContabilidade ? "oklch(0.50 0.14 250)" : "oklch(0.70 0.006 240)" }} />
                <span className="text-sm font-semibold">Sim</span>
                <span className="text-xs opacity-60">Enviado</span>
              </button>
              <button
                onClick={() => { setEnviadoContabilidade(false); setDataEnvioContabilidade(""); }}
                className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl border-2 transition-all duration-150"
                style={!enviadoContabilidade ? {
                  background: "oklch(0.975 0.006 240)",
                  borderColor: "oklch(0.75 0.006 240)",
                  color: "oklch(0.40 0.006 240)",
                  boxShadow: "0 0 0 3px oklch(0.75 0.006 240 / 0.15)",
                } : {
                  background: "white",
                  borderColor: "oklch(0.88 0.006 240)",
                  color: "oklch(0.50 0.008 240)",
                }}
              >
                <XCircle className="w-5 h-5" style={{ color: !enviadoContabilidade ? "oklch(0.55 0.006 240)" : "oklch(0.70 0.006 240)" }} />
                <span className="text-sm font-semibold">Não</span>
                <span className="text-xs opacity-60">Pendente</span>
              </button>
            </div>
          </div>

          {/* Data de envio para contabilidade */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              Data de envio para contabilidade
              {enviadoContabilidade && <span className="text-red-500 font-bold">*</span>}
            </label>
            <DateInputBR
              value={dataEnvioContabilidade}
              onChange={setDataEnvioContabilidade}
              disabled={!enviadoContabilidade}
            />
            {!enviadoContabilidade && (
              <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Disponível apenas quando marcado como enviado
              </p>
            )}
          </div>

          {/* Info de registro existente */}
          {row.exameId && (
            <div
              className="rounded-lg px-3.5 py-3 flex items-start gap-2.5"
              style={{ background: "oklch(0.965 0.008 240)", border: "1px solid oklch(0.88 0.006 240)" }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "oklch(0.55 0.12 145)" }} />
              <div>
                <p className="text-xs font-semibold text-foreground">Registro existente</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Este colaborador já possui um registro para {ano}. Salvar irá atualizar os dados.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer com botões */}
        <div
          className="px-6 py-4 flex gap-3 shrink-0"
          style={{ borderTop: "1px solid oklch(0.88 0.006 240)", background: "white" }}
        >
          <Button
            variant="outline"
            className="flex-1 h-10"
            onClick={() => onOpenChange(false)}
            disabled={upsert.isPending}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 h-10 font-semibold text-white"
            onClick={handleSalvar}
            disabled={upsert.isPending}
            style={{
              background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))",
              border: "none",
            }}
          >
            {upsert.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </span>
            ) : "Salvar registro"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Card de colaborador ────────────────────────────────────────────────────
function ColaboradorCard({ row, onEditar }: { row: ExameRow; onEditar: () => void }) {
  return (
    <button
      className="group w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150 hover:shadow-md active:scale-[0.98]"
      style={{
        background: row.realizou ? "oklch(0.972 0.018 145)" : "white",
        borderColor: row.realizou ? "oklch(0.82 0.08 145)" : "oklch(0.885 0.006 240)",
        boxShadow: "0 1px 3px oklch(0.12 0.015 240 / 0.06)",
      }}
      onClick={onEditar}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: row.realizou ? "oklch(0.82 0.10 145)" : "oklch(0.92 0.004 240)",
          color: row.realizou ? "oklch(0.32 0.10 145)" : "oklch(0.45 0.006 240)",
        }}
      >
        {getInitials(row.colaboradorNome)}
      </div>

      {/* Nome e data */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight" title={row.colaboradorNome}>
          {row.colaboradorNome}
        </p>
        {row.realizou && row.dataExame ? (
          <p className="text-xs font-medium mt-0.5" style={{ color: "oklch(0.45 0.12 145)" }}>
            Realizado em {formatarData(row.dataExame)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/50 mt-0.5">Clique para registrar</p>
        )}
        {/* Próximo exame por aniversário de admissão */}
        {row.proximoExame && (
          <p className="text-xs mt-0.5" style={{
            color: row.statusExame === "vencido" ? "oklch(0.50 0.18 25)" :
                   row.statusExame === "a_vencer" ? "oklch(0.55 0.18 55)" :
                   "oklch(0.50 0.006 240)"
          }}>
            {row.statusExame === "vencido"
              ? `⚠️ Exame vencido desde ${formatarData(row.proximoExame)}`
              : row.statusExame === "a_vencer"
              ? `⏰ Próximo exame em ${formatarData(row.proximoExame)} (${row.diasParaProximoExame}d)`
              : `📅 Próximo exame: ${formatarData(row.proximoExame)}`
            }
          </p>
        )}
        {row.observacoes && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.observacoes}</p>
        )}
        {/* Badge enviado contabilidade */}
        {row.enviadoContabilidade && (
          <span
            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: "oklch(0.92 0.015 250)", color: "oklch(0.38 0.12 250)", border: "1px solid oklch(0.78 0.10 250)" }}
          >
            <SendHorizonal className="w-2.5 h-2.5" />
            Contabilidade{row.dataEnvioContabilidade ? ` · ${formatarData(row.dataEnvioContabilidade)}` : ""}
          </span>
        )}
      </div>

      {/* Badge status */}
      {row.realizou ? (
        <span
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
          style={{ background: "oklch(0.88 0.10 145)", color: "oklch(0.32 0.12 145)", border: "1px solid oklch(0.75 0.10 145)" }}
        >
          <CheckCircle2 className="w-3 h-3" /> Realizado
        </span>
      ) : (
        <span
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
          style={{ background: "oklch(0.96 0.012 25)", color: "oklch(0.50 0.15 25)", border: "1px solid oklch(0.87 0.06 25)" }}
        >
          <AlertCircle className="w-3 h-3" /> Pendente
        </span>
      )}

      {/* Seta */}
      <ChevronRight className="w-4 h-4 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
    </button>
  );
}

// ─── Bloco de setor ─────────────────────────────────────────────────────────
function SetorBloco({ setorNome, rows, onEditar }: {
  setorNome: string; rows: ExameRow[]; onEditar: (r: ExameRow) => void;
}) {
  const sim = rows.filter(r => r.realizou).length;
  const total = rows.length;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Layers className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{setorNome}</span>
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-xs text-muted-foreground font-medium tabular-nums">{sim}/{total}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(row => (
          <ColaboradorCard key={row.colaboradorId} row={row} onEditar={() => onEditar(row)} />
        ))}
      </div>
    </div>
  );
}

// ─── Bloco de empresa ────────────────────────────────────────────────────────
function EmpresaBloco({ empresaNome, setores, onEditar }: {
  empresaNome: string;
  setores: { setorNome: string; rows: ExameRow[] }[];
  onEditar: (r: ExameRow) => void;
}) {
  const totalRows = setores.flatMap(s => s.rows);
  const sim = totalRows.filter(r => r.realizou).length;
  const total = totalRows.length;
  const pct = total > 0 ? Math.round((sim / total) * 100) : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        border: "1px solid oklch(0.885 0.006 240)",
        boxShadow: "0 2px 8px oklch(0.12 0.015 240 / 0.07)",
        background: "white",
      }}
    >
      {/* Header da empresa */}
      <div
        className="px-5 py-4 flex items-center gap-4"
        style={{
          background: "linear-gradient(135deg, oklch(0.14 0.07 254), oklch(0.17 0.015 240))",
          borderBottom: "1px solid oklch(0.25 0.09 252)",
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.25 0.012 240)", border: "1px solid oklch(0.30 0.012 240)" }}
        >
          <Building2 className="w-4 h-4" style={{ color: "oklch(0.48 0.20 252)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">{empresaNome}</p>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.60 0.008 240)" }}>
            {sim} de {total} colaboradores realizaram o exame
          </p>
        </div>
        {/* Progress pill */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span
            className="text-lg font-bold tabular-nums leading-none"
            style={{ color: pct >= 80 ? "oklch(0.72 0.14 145)" : pct >= 50 ? "oklch(0.48 0.20 252)" : "oklch(0.72 0.12 25)" }}
          >
            {pct}%
          </span>
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.25 0.012 240)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct >= 80
                  ? "linear-gradient(90deg, oklch(0.65 0.12 145), oklch(0.72 0.14 145))"
                  : pct >= 50
                  ? "linear-gradient(90deg, oklch(0.45 0.18 255), oklch(0.48 0.20 252))"
                  : "linear-gradient(90deg, oklch(0.55 0.12 25), oklch(0.65 0.12 30))",
              }}
            />
          </div>
        </div>
      </div>

      {/* Setores */}
      <div className="p-5 space-y-5">
        {setores.map(s => (
          <SetorBloco key={s.setorNome} setorNome={s.setorNome} rows={s.rows} onEditar={onEditar} />
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function ExamesPeriodicos() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "sim" | "nao">("todos");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editando, setEditando] = useState<ExameRow | null>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.examesPeriodicos.getAll.useQuery({ ano });

  const listaEmpresas = useMemo(() => {
    if (!data) return [];
    const map = new Map<number, string>();
    data.forEach(r => map.set(r.empresaId, r.empresaNome));
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  const filtrado = useMemo(() => {
    if (!data) return [];
    return data.filter(r => {
      if (filtroEmpresa !== "todas" && String(r.empresaId) !== filtroEmpresa) return false;
      if (filtroStatus === "sim" && !r.realizou) return false;
      if (filtroStatus === "nao" && r.realizou) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!r.colaboradorNome.toLowerCase().includes(q) &&
            !r.empresaNome.toLowerCase().includes(q) &&
            !(r.setorNome ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data, filtroEmpresa, filtroStatus, busca]);

  const agrupado = useMemo(() => {
    const empMap = new Map<number, { empresaId: number; empresaNome: string; setorMap: Map<string, ExameRow[]> }>();
    filtrado.forEach(r => {
      if (!empMap.has(r.empresaId)) empMap.set(r.empresaId, { empresaId: r.empresaId, empresaNome: r.empresaNome, setorMap: new Map() });
      const emp = empMap.get(r.empresaId)!;
      const setorKey = r.setorNome ?? "Sem Setor";
      if (!emp.setorMap.has(setorKey)) emp.setorMap.set(setorKey, []);
      emp.setorMap.get(setorKey)!.push(r);
    });
    return Array.from(empMap.values())
      .sort((a, b) => a.empresaNome.localeCompare(b.empresaNome))
      .map(emp => ({
        ...emp,
        setores: Array.from(emp.setorMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([setorNome, rows]) => ({ setorNome, rows: rows.sort((a, b) => a.colaboradorNome.localeCompare(b.colaboradorNome)) }))
      }));
  }, [filtrado]);

  const totalSim = data?.filter(r => r.realizou).length ?? 0;
  const total = data?.length ?? 0;
  const totalNao = total - totalSim;
  const pct = total > 0 ? Math.round((totalSim / total) * 100) : 0;

  function abrirEditar(row: ExameRow) {
    setEditando(row);
    setSheetOpen(true);
  }

  function exportarExcel() {
    if (!filtrado.length) return;
    const rows = filtrado.map(r => ({
      "Colaborador": r.colaboradorNome,
      "Empresa": r.empresaNome,
      "Setor": r.setorNome ?? "—",
      "Realizou Exame": r.realizou ? "Sim" : "Não",
      "Data do Exame": r.dataExame ? r.dataExame.substring(0, 10).split("-").reverse().join("/") : "—",
      "Observações": r.observacoes ?? "",
      "Enviado Contabilidade": r.enviadoContabilidade ? "Sim" : "Não",
      "Data Envio Contabilidade": r.dataEnvioContabilidade ? r.dataEnvioContabilidade.substring(0, 10).split("-").reverse().join("/") : "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Exames ${ano}`);
    XLSX.writeFile(wb, `Exames-Periodicos-${ano}.xlsx`);
  }

  const hasFilters = busca || filtroEmpresa !== "todas" || filtroStatus !== "todos";

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
          border: "1px solid oklch(0.25 0.09 252)",
          boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)",
        }}
      >
        <div className="px-7 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))",
                boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)",
              }}
            >
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight">Exames Periódicos</h1>
              <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>
                Controle de exames médicos anuais dos colaboradores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
              <SelectTrigger className="w-28 h-9 text-sm bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[anoAtual - 1, anoAtual, anoAtual + 1].map(a => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={exportarExcel}
              disabled={!filtrado.length}
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
          </div>
        </div>

        {/* Barra de progresso geral */}
        <div className="px-7 pb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "oklch(0.65 0.008 240)" }}>
              Progresso geral — {ano}
            </span>
            <span className="text-xs font-bold" style={{ color: "oklch(0.48 0.20 252)" }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.25 0.09 252)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, oklch(0.45 0.18 255), oklch(0.48 0.20 252))",
              }}
            />
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: total, sub: "colaboradores", style: { bg: "oklch(0.975 0.002 240)", border: "oklch(0.885 0.006 240)", val: "oklch(0.20 0.015 240)" } },
          { label: "Realizaram", value: totalSim, sub: `exame em ${ano}`, style: { bg: "oklch(0.972 0.025 145)", border: "oklch(0.82 0.07 145)", val: "oklch(0.38 0.12 145)" } },
          { label: "Pendentes", value: totalNao, sub: "sem registro", style: { bg: "oklch(0.975 0.015 25)", border: "oklch(0.87 0.06 25)", val: "oklch(0.50 0.15 25)" } },
        ].map(item => (
          <div
            key={item.label}
            className="rounded-xl p-4"
            style={{
              background: item.style.bg,
              border: `1px solid ${item.style.border}`,
              boxShadow: "0 1px 4px oklch(0.12 0.015 240 / 0.06)",
            }}
          >
            <p className="text-3xl font-bold leading-none" style={{ color: item.style.val }}>{item.value}</p>
            <p className="text-xs font-semibold mt-1.5 text-muted-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground/70">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div
        className="rounded-xl p-4 flex flex-wrap gap-3 items-end bg-white"
        style={{ border: "1px solid oklch(0.885 0.006 240)", boxShadow: "0 1px 4px oklch(0.12 0.015 240 / 0.06)" }}
      >
        <div className="flex-1 min-w-44 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input placeholder="Nome, empresa ou setor..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
        <div className="min-w-44 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</label>
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="h-9 w-52">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/50 shrink-0" />
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {listaEmpresas.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-40 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
          <Select value={filtroStatus} onValueChange={v => setFiltroStatus(v as "todos" | "sim" | "nao")}>
            <SelectTrigger className="h-9 w-40">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/50 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sim">Realizaram</SelectItem>
              <SelectItem value="nao">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="ghost" size="sm"
            className="h-9 gap-1.5 text-muted-foreground self-end"
            onClick={() => { setBusca(""); setFiltroEmpresa("todas"); setFiltroStatus("todos"); }}
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : agrupado.length === 0 ? (
        <div
          className="rounded-2xl border border-border/60 bg-white flex flex-col items-center justify-center py-20 text-center"
          style={{ boxShadow: "0 1px 4px oklch(0.12 0.015 240 / 0.06)" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <Stethoscope className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <p className="font-semibold text-foreground">Nenhum colaborador encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros de busca</p>
        </div>
      ) : (
        <div className="space-y-5">
          {agrupado.map(emp => (
            <EmpresaBloco
              key={emp.empresaId}
              empresaNome={emp.empresaNome}
              setores={emp.setores}
              onEditar={abrirEditar}
            />
          ))}
        </div>
      )}

      {/* Sheet lateral de edição */}
      <SheetEditar
        row={editando}
        ano={ano}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={() => utils.examesPeriodicos.getAll.invalidate({ ano })}
      />
    </div>
  );
}
