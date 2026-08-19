import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/useMobile";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { PrivacyValue } from "@/components/PrivacyValue";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileSpreadsheet, Download, ChevronDown, ChevronUp, Building2, Users, UserMinus, TrendingUp, Bus, Utensils, AlertCircle, UserPlus, UserX, Search, X, Pencil, CalendarPlus, ChevronRight, ChevronLeft, Calendar, CalendarX2, Layers, Sparkles, RefreshCw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 5 }, (_, i) => anoAtual - 1 + i);

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtR(v: number) {
  return `R$ ${fmt(v)}`;
}

type ColaboradorData = {
  id: number;
  nome: string;
  setorBeneficio: string | null;
  valorVR: number;
  valorVT: number;
  valorFixoQuinzenal: number;
  vtFixoQ1?: number;
  vtFixoQ2?: number;
  diasAusencia: number;
  ausenciaDetalhe?: { ferias: number; atestado: number; manual: number };
  diasVrQ1: number;
  diasVtQ1: number;
  totalVrQ1: number;
  totalVtQ1: number;
  totalQ1: number;
  diasVrQ2: number;
  diasVtQ2: number;
  totalVrQ2: number;
  totalVtQ2: number;
  totalQ2: number;
  geralVR: number;
  descontoVR: number;
  tipoDescontoVR: string;
  geralVT: number;
  totalGeral: number;
};

type SetorData = {
  setorId: number | null;
  setorNome: string;
  empresaId: number | null;
  empresaNome: string;
  colaboradores: ColaboradorData[];
  totalVrQ1: number;
  totalVtQ1: number;
  totalQ1: number;
  totalVrQ2: number;
  totalVtQ2: number;
  totalQ2: number;
  totalGeralVR: number;
  totalDescontoVR: number;
  totalGeralVT: number;
  totalGeral: number;
  totalAuxilioVeiculo?: number;
};

// ─── Célula de ausência editável ─────────────────────────────────────────────
function AusenciaCell({ colaboradorId, ano, mes, valorInicial, detalhe }: {
  colaboradorId: number; ano: number; mes: number; valorInicial: number;
  detalhe?: { ferias: number; atestado: number; manual: number };
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(valorInicial));
  const utils = trpc.useUtils();

  const upsert = trpc.ausenciasVRVT.upsert.useMutation({
    onSuccess: () => { utils.planilhaVRVT.getDados.invalidate(); toast.success("Ausência salva"); setEditando(false); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const salvar = useCallback(() => {
    const dias = parseInt(valor) || 0;
    if (dias < 0 || dias > 31) { toast.error("Valor inválido (0–31)"); return; }
    upsert.mutate({ colaboradorId, ano, mes, diasAusencia: dias });
  }, [valor, colaboradorId, ano, mes, upsert]);

  if (editando) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <Input type="number" min={0} max={31} value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") salvar(); if (e.key === "Escape") { setEditando(false); setValor(String(valorInicial)); } }}
          className="w-12 h-5 text-xs text-center px-1" autoFocus />
        <button onClick={salvar} disabled={upsert.isPending} className="text-[10px] text-blue-600 font-bold">✓</button>
        <button onClick={() => { setEditando(false); setValor(String(valorInicial)); }} className="text-[10px] text-slate-400">✕</button>
      </div>
    );
  }
  const temDetalhe = detalhe && (detalhe.ferias > 0 || detalhe.atestado > 0 || detalhe.manual > 0);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={() => setEditando(true)}
            className={`w-full text-center rounded px-1 py-0.5 text-xs font-medium transition-all hover:scale-105 ${
              valorInicial > 0
                ? "text-blue-700 bg-blue-100 border border-blue-300"
                : "text-slate-400 hover:bg-slate-100"
            }`}>
            {valorInicial > 0 ? valorInicial : "—"}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-0 overflow-hidden border-0 shadow-xl">
          <div className="bg-slate-900 border border-slate-700 rounded-lg min-w-[180px]">
            {/* Header */}
            <div className="px-3 py-2 border-b border-slate-700/60 bg-slate-800/80">
              <p className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
                Ausências — {valorInicial} dia{valorInicial !== 1 ? "s" : ""}
              </p>
            </div>
            {/* Detalhamento */}
            {temDetalhe ? (
              <div className="px-3 py-2 space-y-1.5">
                {(detalhe!.ferias > 0) && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-[11px] text-blue-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      Férias
                    </span>
                    <span className="text-[11px] font-bold text-blue-200">{detalhe!.ferias}d</span>
                  </div>
                )}
                {(detalhe!.atestado > 0) && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-[11px] text-red-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      Atestado
                    </span>
                    <span className="text-[11px] font-bold text-red-200">{detalhe!.atestado}d</span>
                  </div>
                )}
                {(detalhe!.manual > 0) && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-[11px] text-blue-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      Falta manual
                    </span>
                    <span className="text-[11px] font-bold text-blue-200">{detalhe!.manual}d</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-2">
                <p className="text-[11px] text-slate-500">Sem ausências registradas</p>
              </div>
            )}
            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-slate-700/60 bg-slate-800/40">
              <p className="text-[10px] text-slate-500">Clique para editar manualmente</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Célula de dias editável (VR ou VT por quinzena) ───────────────────────────
function DiaEditavelCell({
  colaboradorId, ano, mes, quinzena, tipo, valorInicial, cor,
}: {
  colaboradorId: number; ano: number; mes: number;
  quinzena: "Q1" | "Q2"; tipo: "VR" | "VT";
  valorInicial: number; cor: string;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(valorInicial));
  useEffect(() => { setValor(String(valorInicial)); }, [valorInicial]);
  const utils = trpc.useUtils();
  const mutation = trpc.planilhaVRVT.editarDias.useMutation({
    onSuccess: () => {
      utils.planilhaVRVT.getDados.invalidate();
      toast.success(`Dias de ${tipo} (${quinzena}) atualizados!`);
      setEditando(false);
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const salvar = useCallback(() => {
    const dias = parseInt(valor);
    if (isNaN(dias) || dias < 0 || dias > 31) { toast.error("Valor inválido (0–31)"); return; }
    mutation.mutate({ colaboradorId, ano, mes, quinzena, tipo, dias });
  }, [valor, colaboradorId, ano, mes, quinzena, tipo, mutation]);
  if (editando) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <Input
          type="number" min={0} max={31} value={valor}
          onChange={e => setValor(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") { setEditando(false); setValor(String(valorInicial)); }
          }}
          className="w-12 h-6 text-xs text-center px-1 bg-slate-900 border-slate-500" autoFocus
        />
        <div className="flex items-center gap-1">
          <button
            onClick={salvar}
            disabled={mutation.isPending}
            className="text-[9px] bg-blue-800 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded font-bold transition-colors"
          >
            {mutation.isPending ? "..." : "✓ Confirmar"}
          </button>
          <button
            onClick={() => { setEditando(false); setValor(String(valorInicial)); }}
            className="text-[9px] text-slate-400 hover:text-slate-200 px-1 py-0.5 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setEditando(true)}
            className={`w-full text-center rounded px-1 py-0.5 font-medium transition-all hover:scale-110 hover:ring-1 hover:ring-white/20 ${cor} cursor-pointer`}
          >
            {valorInicial > 0 ? valorInicial : <span className="text-slate-600">—</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Clique para editar dias de {tipo} ({quinzena})
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Cabeçalho de setor ──────────────────────────────────────────────────────
function SetorHeader({ setor, aberto, onToggle }: { setor: SetorData; aberto: boolean; onToggle: () => void }) {
  const totalAusencias = setor.colaboradores.reduce((a, c) => a + (c.diasAusencia || 0), 0);
  return (
    <button type="button" onClick={onToggle} className="w-full text-left">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 hover:bg-slate-750 transition-colors cursor-pointer select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-sm font-bold text-white truncate">{setor.setorNome}</span>
          <span className="text-xs text-slate-400 shrink-0">{setor.empresaNome}</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 shrink-0">
            <Users className="w-2.5 h-2.5" />{setor.colaboradores.length}
          </span>
          {totalAusencias > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50 shrink-0">
              <UserMinus className="w-2.5 h-2.5" />{totalAusencias}d
            </span>
          )}
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <div className="hidden md:flex items-center gap-5">
            {(setor.totalAuxilioVeiculo ?? 0) > 0 && (
              <>
                <div className="text-right">
                  <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider">Aux. Veículo</p>
                  <p className="text-sm font-bold text-blue-300"><PrivacyValue value={fmtR(setor.totalAuxilioVeiculo ?? 0)} iconSize={12} /></p>
                </div>
                <div className="w-px h-7 bg-slate-600" />
              </>
            )}
            <div className="text-right">
              <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider">1ª Quinzena</p>
              <p className="text-sm font-bold text-blue-300"><PrivacyValue value={fmtR(setor.totalQ1)} iconSize={12} /></p>
            </div>
            <div className="w-px h-7 bg-slate-600" />
            <div className="text-right">
              <p className="text-[9px] font-semibold text-violet-400 uppercase tracking-wider">2ª Quinzena</p>
              <p className="text-sm font-bold text-violet-300"><PrivacyValue value={fmtR(setor.totalQ2)} iconSize={12} /></p>
            </div>
            <div className="w-px h-7 bg-slate-600" />
            <div className="text-right">
              <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider">Total Geral</p>
              <p className="text-sm font-bold text-blue-300"><PrivacyValue value={fmtR(setor.totalGeral)} iconSize={12} /></p>
            </div>
          </div>
          {aberto ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>
    </button>
  );
}

// ─── Tabela do setor ─────────────────────────────────────────────────────────
// ── Modal de Edição de Colaborador ─────────────────────────────────────────
type ColabEdit = { id: number; nome: string; valorVR: number; valorVT: number };
function ModalEditarColaborador({ colab, onClose }: { colab: ColabEdit | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [nome, setNome] = useState("");
  const [vr, setVr] = useState("");
  const [vt, setVt] = useState("");

  // Sincronizar campos quando o colaborador selecionado mudar
  useEffect(() => {
    if (colab) {
      setNome(colab.nome);
      setVr(colab.valorVR != null ? String(colab.valorVR) : "0");
      setVt(colab.valorVT != null ? String(colab.valorVT) : "0");
    }
  }, [colab?.id]);

  const editar = trpc.planilhaVRVT.editar.useMutation({
    onSuccess: () => { utils.planilhaVRVT.getDados.invalidate(); toast.success("Colaborador atualizado com sucesso!"); onClose(); },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  if (!colab) return null;

  const salvar = () => {
    const vrNum = parseFloat(vr.replace(",", "."));
    const vtNum = parseFloat(vt.replace(",", "."));
    editar.mutate({
      id: colab.id,
      nome: nome.trim() || undefined,
      valorVR: isNaN(vrNum) ? null : vrNum,
      valorVT: isNaN(vtNum) ? null : vtNum,
    });
  };

  const vrAtual = colab.valorVR ?? 0;
  const vtAtual = colab.valorVT ?? 0;

  return (
    <Dialog open={!!colab} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-slate-950 border-slate-700/60 text-slate-100 max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-600/20 via-slate-800 to-slate-900 px-6 py-5 border-b border-slate-700/60">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(245,158,11,0.10)_0%,_transparent_60%)]" />
          <div className="relative flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Pencil className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Editando colaborador</p>
              <h2 className="text-base font-bold text-white leading-tight break-words">{colab.nome}</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-300 text-xs font-medium">
                  <Utensils className="w-3 h-3" />
                  VR atual: {vrAtual > 0 ? `R$ ${vrAtual.toFixed(2)}/dia` : <span className="text-slate-500">não recebe</span>}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/15 border border-blue-500/25 text-blue-300 text-xs font-medium">
                  <Bus className="w-3 h-3" />
                  VT atual: {vtAtual > 0 ? `R$ ${vtAtual.toFixed(2)}/dia` : <span className="text-slate-500">não recebe</span>}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="p-6 space-y-5">
          {/* Campo Nome */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nome completo</label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value.toUpperCase())}
              className="bg-slate-800/80 border-slate-600/60 text-slate-100 text-sm h-10 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 rounded-xl"
              placeholder="Nome do colaborador"
            />
          </div>

          {/* Campos VR e VT */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Utensils className="w-3 h-3" /> Vale-Refeição (VR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                <Input
                  value={vr}
                  onChange={e => setVr(e.target.value)}
                  placeholder="39,52"
                  className="bg-slate-800/80 border-orange-700/30 text-slate-100 text-sm h-10 pl-9 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 rounded-xl"
                />
              </div>
              <p className="text-[10px] text-slate-500">Valor por dia trabalhado</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Bus className="w-3 h-3" /> Vale-Transporte (VT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                <Input
                  value={vt}
                  onChange={e => setVt(e.target.value)}
                  placeholder="0,00"
                  className="bg-slate-800/80 border-teal-700/30 text-slate-100 text-sm h-10 pl-9 focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/30 rounded-xl"
                />
              </div>
              <p className="text-[10px] text-slate-500">Valor por dia trabalhado (0 = não recebe)</p>
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
            <p className="text-[10px] text-slate-600">As alterações serão refletidas na planilha imediatamente.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}
                className="border-slate-600/60 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-lg">
                Cancelar
              </Button>
              <Button size="sm" onClick={salvar} disabled={editar.isPending}
                className="bg-blue-500 hover:bg-blue-400 text-slate-900 font-bold rounded-lg shadow-md min-w-[90px]">
                {editar.isPending ? <Spinner className="w-3.5 h-3.5 mr-1.5" /> : <Pencil className="w-3.5 h-3.5 mr-1.5" />}
                {editar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SetorTable({ setor, diasQ1, diasQ2, mes, ano, valorVR }: {
  setor: SetorData; diasQ1: number; diasQ2: number; mes: number; ano: number; valorVR: number;
}) {
  const totalAusencias = setor.colaboradores.reduce((a, c) => a + (c.diasAusencia || 0), 0);
  const [colabEditando, setColabEditando] = useState<ColabEdit | null>(null);
  return (
    <div>
      <ModalEditarColaborador colab={colabEditando} onClose={() => setColabEditando(null)} />
      <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
        <thead>
          {/* Linha 1 — grupos */}
          <tr>
            <th rowSpan={3} className="border border-slate-700 px-2 py-1.5 text-left font-semibold text-slate-200 bg-slate-850 sticky left-0 z-10 min-w-[180px] max-w-[220px]"
              style={{ background: "#1e293b" }}>
              COLABORADOR
            </th>
            <th rowSpan={3} className="border border-slate-700 px-2 py-1.5 text-center font-semibold text-blue-400 bg-blue-950/40 min-w-[60px]">
              AUSÊNCIAS
            </th>
            {/* 1ª Quinzena — VR */}
            <th colSpan={3} className="border border-slate-700 px-2 py-1 text-center font-bold text-blue-300 bg-blue-950/50">
              <span className="flex items-center justify-center gap-1">
                <Utensils className="w-3 h-3" /> VR — 1ª QUINZENA ({diasQ1} dias)
              </span>
            </th>
            {/* 1ª Quinzena — VT */}
            <th colSpan={3} className="border border-slate-700 px-2 py-1 text-center font-bold text-blue-300 bg-blue-950/40">
              <span className="flex items-center justify-center gap-1">
                <Bus className="w-3 h-3" /> VT — 1ª QUINZENA ({diasQ1} dias)
              </span>
            </th>
            {/* 2ª Quinzena — VR */}
            <th colSpan={3} className="border border-slate-700 px-2 py-1 text-center font-bold text-violet-300 bg-violet-950/50">
              <span className="flex items-center justify-center gap-1">
                <Utensils className="w-3 h-3" /> VR — 2ª QUINZENA ({diasQ2} dias)
              </span>
            </th>
            {/* 2ª Quinzena — VT */}
            <th colSpan={3} className="border border-slate-700 px-2 py-1 text-center font-bold text-blue-300 bg-blue-950/40">
              <span className="flex items-center justify-center gap-1">
                <Bus className="w-3 h-3" /> VT — 2ª QUINZENA ({diasQ2} dias)
              </span>
            </th>
            {/* Totais */}
            <th rowSpan={3} className="border border-slate-700 px-2 py-1.5 text-center font-bold text-blue-300 bg-emerald-950/40 min-w-[85px]">
              TOTAL GERAL
            </th>
            <th rowSpan={3} className="border border-slate-700 px-2 py-1.5 text-center font-bold text-orange-300 bg-orange-950/40 min-w-[85px]">
              TOTAL GERAL VR
            </th>
            <th rowSpan={3} className="border border-slate-700 px-2 py-1.5 text-center font-semibold text-red-400 bg-red-950/30 min-w-[75px]">
              DESC. VR<br /><span className="text-[9px] font-normal">(10%)</span>
            </th>
          </tr>
          {/* Linha 2 — subcolunas */}
          <tr>
            {/* VR Q1 */}
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-blue-950/30 text-[10px] font-semibold min-w-[38px]">Dias</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-blue-950/30 text-[10px] font-semibold min-w-[62px]">Valor</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-blue-950/30 text-[10px] font-semibold min-w-[72px]">Total</th>
            {/* VT Q1 */}
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-cyan-950/20 text-[10px] font-semibold min-w-[38px]">Dias</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-cyan-950/20 text-[10px] font-semibold min-w-[62px]">Valor</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-cyan-950/20 text-[10px] font-semibold min-w-[72px]">Total</th>
            {/* VR Q2 */}
            <th className="border border-slate-700 px-1.5 py-1 text-center text-violet-400 bg-violet-950/30 text-[10px] font-semibold min-w-[38px]">Dias</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-violet-400 bg-violet-950/30 text-[10px] font-semibold min-w-[62px]">Valor</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-violet-400 bg-violet-950/30 text-[10px] font-semibold min-w-[72px]">Total</th>
            {/* VT Q2 */}
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-teal-950/20 text-[10px] font-semibold min-w-[38px]">Dias</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-teal-950/20 text-[10px] font-semibold min-w-[62px]">Valor</th>
            <th className="border border-slate-700 px-1.5 py-1 text-center text-blue-400 bg-teal-950/20 text-[10px] font-semibold min-w-[72px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {setor.colaboradores.map((c, i) => {
            const isFixed = c.valorFixoQuinzenal > 0;
            const halfMark = <span className="text-violet-400 font-bold text-sm" title="Valor fixo quinzenal">½</span>;
            const hasVtFixoQ1 = (c.vtFixoQ1 ?? 0) > 0;
            const hasVtFixoQ2 = (c.vtFixoQ2 ?? 0) > 0;
            const fixoTag = <span className="text-blue-400 font-bold text-[10px] tracking-wide" title="Valor fixo">FIXO</span>;
            const cajuTipo = (c as any).tipoRecebimentoCaju;
            const cajuStyle: React.CSSProperties = cajuTipo === 'vt_saldo_livre'
              ? { borderLeft: '3px solid #34d399', background: i % 2 === 0 ? '#0a1f15' : '#0c2218' }
              : cajuTipo === 'vr_saldo_livre'
              ? { borderLeft: '3px solid #f87171', background: i % 2 === 0 ? '#1e0f0f' : '#231212' }
              : cajuTipo === 'auxilio_veiculo'
              ? { borderLeft: '3px solid #fbbf24', background: i % 2 === 0 ? '#1e1a0a' : '#231e0d' }
              : i % 2 !== 0 ? { background: '#172033' } : {};
            return (
              <tr key={c.id}
                className={`transition-colors ${c.diasAusencia > 0 ? "ring-1 ring-inset ring-blue-600/40" : ""} hover:bg-slate-800`}
                style={cajuStyle}>
                {/* Nome */}
                <td className="border border-slate-700/60 px-2 py-1.5 font-medium text-slate-100 sticky left-0 z-10"
                  style={{ background: cajuTipo === 'vt_saldo_livre' ? (i % 2 === 0 ? '#0a1f15' : '#0c2218') : cajuTipo === 'vr_saldo_livre' ? (i % 2 === 0 ? '#1e0f0f' : '#231212') : cajuTipo === 'auxilio_veiculo' ? (i % 2 === 0 ? '#1e1a0a' : '#231e0d') : i % 2 === 0 ? '#0f172a' : '#172033' }}>
                  {c.nome}
                </td>
                {/* Ausências */}
                <td className="border border-slate-700/60 px-1.5 py-1 bg-blue-950/10">
                  <AusenciaCell colaboradorId={c.id} ano={ano} mes={mes} valorInicial={c.diasAusencia} detalhe={c.ausenciaDetalhe} />
                </td>

                {/* VR Q1 — Dias */}
                <td className="border border-slate-700/60 px-1 py-0.5 text-center text-blue-300 bg-blue-950/10">
                  {isFixed ? halfMark : <DiaEditavelCell colaboradorId={c.id} ano={ano} mes={mes} quinzena="Q1" tipo="VR" valorInicial={c.diasVrQ1} cor="text-blue-300 hover:bg-blue-900/40" />}
                </td>
                {/* VR Q1 — Valor unitário */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-center bg-blue-950/10">
                  {c.valorVR > 0 ? <span className="text-blue-400 text-[10px]">{fmtR(c.valorVR)}</span> : <span className="text-slate-600">—</span>}
                </td>
                {/* VR Q1 — Total */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-right font-semibold text-blue-200 bg-blue-950/10">
                  {c.totalVrQ1 > 0 ? fmt(c.totalVrQ1) : <span className="text-slate-600">—</span>}
                </td>

                {/* VT Q1 — Dias */}
                <td className="border border-slate-700/60 px-1 py-0.5 text-center text-blue-300 bg-cyan-950/10">
                  {isFixed ? halfMark : hasVtFixoQ1 ? fixoTag : <DiaEditavelCell colaboradorId={c.id} ano={ano} mes={mes} quinzena="Q1" tipo="VT" valorInicial={c.diasVtQ1} cor="text-blue-300 hover:bg-cyan-900/40" />}
                </td>
                {/* VT Q1 — Valor unitário */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-center bg-cyan-950/10">
                  {c.valorVT > 0 ? <span className="text-blue-400 text-[10px]">{fmtR(c.valorVT)}</span> : <span className="text-slate-600">—</span>}
                </td>
                {/* VT Q1 — Total */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-right font-semibold bg-cyan-950/10">
                  {hasVtFixoQ1
                    ? <span className="text-blue-300 font-bold">{fmtR(c.vtFixoQ1!)}</span>
                    : c.totalVtQ1 > 0 ? <span className="text-cyan-200">{fmt(c.totalVtQ1)}</span> : <span className="text-slate-600">—</span>}
                </td>

                {/* VR Q2 — Dias */}
                <td className="border border-slate-700/60 px-1 py-0.5 text-center text-violet-300 bg-violet-950/10">
                  {isFixed ? halfMark : <DiaEditavelCell colaboradorId={c.id} ano={ano} mes={mes} quinzena="Q2" tipo="VR" valorInicial={c.diasVrQ2} cor="text-violet-300 hover:bg-violet-900/40" />}
                </td>
                {/* VR Q2 — Valor unitário */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-center bg-violet-950/10">
                  {c.valorVR > 0 ? <span className="text-violet-400 text-[10px]">{fmtR(c.valorVR)}</span> : <span className="text-slate-600">—</span>}
                </td>
                {/* VR Q2 — Total */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-right font-semibold text-violet-200 bg-violet-950/10">
                  {c.totalVrQ2 > 0 ? fmt(c.totalVrQ2) : <span className="text-slate-600">—</span>}
                </td>

                {/* VT Q2 — Dias */}
                <td className="border border-slate-700/60 px-1 py-0.5 text-center text-blue-300 bg-teal-950/10">
                  {isFixed ? halfMark : hasVtFixoQ2 ? fixoTag : (hasVtFixoQ1 && !hasVtFixoQ2) ? <span className="text-slate-600 text-xs">—</span> : <DiaEditavelCell colaboradorId={c.id} ano={ano} mes={mes} quinzena="Q2" tipo="VT" valorInicial={c.diasVtQ2} cor="text-blue-300 hover:bg-teal-900/40" />}
                </td>
                {/* VT Q2 — Valor unitário */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-center bg-teal-950/10">
                  {c.valorVT > 0 ? <span className="text-blue-400 text-[10px]">{fmtR(c.valorVT)}</span> : <span className="text-slate-600">—</span>}
                </td>
                {/* VT Q2 — Total */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-right font-semibold bg-teal-950/10">
                  {hasVtFixoQ1 && !hasVtFixoQ2
                    ? <span className="text-slate-600">—</span>
                    : hasVtFixoQ2
                      ? <span className="text-blue-300 font-bold">{fmtR(c.vtFixoQ2!)}</span>
                      : c.totalVtQ2 > 0 ? <span className="text-teal-200">{fmt(c.totalVtQ2)}</span> : <span className="text-slate-600">—</span>}
                </td>

                {/* Total Geral (VR + VT) */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-right font-bold bg-emerald-950/20">
                  {(hasVtFixoQ1 || hasVtFixoQ2)
                    ? <span className="text-blue-300">{fmtR(c.geralVT)}</span>
                    : <span className="text-blue-300">{fmt(c.totalGeral)}</span>}
                </td>
                {/* Total Geral VR (VR Q1 + VR Q2) */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-right font-bold text-orange-300 bg-orange-950/20">
                  {fmt(parseFloat((c.totalVrQ1 + c.totalVrQ2).toFixed(2)))}
                </td>
                {/* Desconto VR */}
                <td className="border border-slate-700/60 px-1.5 py-1 text-right text-red-400 bg-red-950/10">
                  {c.tipoDescontoVR === 'zero'
                    ? <span className="text-slate-400 text-[10px]">R$ 0,00</span>
                    : c.descontoVR > 0
                      ? `(${fmt(c.descontoVR)})`
                      : <span className="text-slate-600">—</span>}
                </td>
                {/* Ações — Editar */}
                <td className="border border-slate-700/60 px-1 py-1 text-center bg-slate-800/40">
                  <button
                    onClick={() => setColabEditando({ id: c.id, nome: c.nome, valorVR: c.valorVR, valorVT: c.valorVT })}
                    className="p-1.5 rounded hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 transition-colors"
                    title="Editar colaborador">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-800 font-semibold border-t-2 border-slate-600">
            <td className="border border-slate-600 px-2 py-1.5 text-slate-200 sticky left-0 z-10 bg-slate-800">TOTAL</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-blue-400">
              {totalAusencias > 0 ? totalAusencias : "—"}
            </td>
            {/* VR Q1 */}
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-right text-blue-300"><PrivacyValue value={fmt(setor.totalVrQ1)} iconSize={10} /></td>
            {/* VT Q1 */}
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-right text-blue-300"><PrivacyValue value={fmt(setor.totalVtQ1)} iconSize={10} /></td>
            {/* VR Q2 */}
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-right text-violet-300"><PrivacyValue value={fmt(setor.totalVrQ2)} iconSize={10} /></td>
            {/* VT Q2 */}
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-center text-slate-500">—</td>
            <td className="border border-slate-600 px-1.5 py-1.5 text-right text-blue-300"><PrivacyValue value={fmt(setor.totalVtQ2)} iconSize={10} /></td>
            {/* Total Geral */}
            <td className="border border-slate-600 px-1.5 py-1.5 text-right font-bold text-blue-300 bg-emerald-950/30"><PrivacyValue value={fmt(setor.totalGeral)} iconSize={10} /></td>
            {/* Total Geral VR */}
            <td className="border border-slate-600 px-1.5 py-1.5 text-right font-bold text-orange-300 bg-orange-950/30"><PrivacyValue value={fmt(parseFloat((setor.totalVrQ1 + setor.totalVrQ2).toFixed(2)))} iconSize={10} /></td>
            {/* Desconto VR */}
            <td className="border border-slate-600 px-1.5 py-1.5 text-right text-red-400">(<PrivacyValue value={fmt(setor.totalDescontoVR)} iconSize={10} />)</td>
            <td className="border border-slate-600 px-1.5 py-1.5 bg-slate-800"></td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
}
// ─── Card de setor (header + tabela) ─────────────────────────────────────────
function SetorCard({ setor, diasQ1, diasQ2, mes, ano, valorVR }: {
  setor: SetorData; diasQ1: number; diasQ2: number; mes: number; ano: number; valorVR: number;
}) {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 shadow-md mb-3">
      <SetorHeader setor={setor} aberto={aberto} onToggle={() => setAberto(!aberto)} />
      {aberto && <SetorTable setor={setor} diasQ1={diasQ1} diasQ2={diasQ2} mes={mes} ano={ano} valorVR={valorVR} />}
    </div>
  );
}

// ─── Modal Gerenciar Colaboradores ─────────────────────────────────────────
function ModalGerenciarColaboradores({ open, onClose, mes, ano }: { open: boolean; onClose: () => void; mes: number; ano: number }) {
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState<"incluir" | "excluir">("excluir");
  const utils = trpc.useUtils();

  const { data: excluidos, isLoading: loadingExcluidos } = trpc.planilhaVRVT.getExcluidos.useQuery(
    { busca: tab === "incluir" ? busca : undefined },
    { enabled: open && tab === "incluir" }
  );
  const { data: dadosPlanilha } = trpc.planilhaVRVT.getDados.useQuery(
    { ano, mes },
    { enabled: open && tab === "excluir" }
  );
  const toggle = trpc.planilhaVRVT.toggleAtivo.useMutation({
    onSuccess: () => {
      utils.planilhaVRVT.getDados.invalidate();
      utils.planilhaVRVT.getExcluidos.invalidate();
      toast.success(tab === "excluir" ? "Colaborador removido da planilha" : "Colaborador adicionado à planilha");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const colaboradoresPlanilha = dadosPlanilha?.setores.flatMap(s => s.colaboradores) ?? [];
  const filtradosPlanilha = colaboradoresPlanilha.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase())
  );
  const filtradosExcluidos = (excluidos ?? []).filter((c: any) =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const totalAtivos = colaboradoresPlanilha.length;
  const totalExcluidos = excluidos?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setBusca(""); setTab("excluir"); } }}>
      <DialogContent showCloseButton={false} className="max-w-2xl w-[95vw] bg-[#0d1117] border border-slate-700/50 text-white p-0 rounded-2xl flex flex-col" style={{ maxHeight: "85vh", height: "85vh" }}>

        {/* ── Header ── */}
        <div className="relative overflow-hidden px-6 py-5 border-b border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-transparent to-transparent" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-white tracking-tight">Gerenciar Colaboradores</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Controle quem aparece na Planilha VR/VT</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-slate-300 text-xs font-semibold">{totalAtivos}</span>
                <span className="text-slate-500 text-[10px]">na planilha</span>
              </div>
              {totalExcluidos > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                  <span className="text-slate-300 text-xs font-semibold">{totalExcluidos}</span>
                  <span className="text-slate-500 text-[10px]">fora</span>
                </div>
              )}
              <button
                onClick={() => { onClose(); setBusca(""); setTab("excluir"); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex bg-slate-900/60 border-b border-slate-800">
          {(["excluir", "incluir"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setBusca(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-all relative ${
                tab === t
                  ? t === "excluir"
                    ? "text-red-300 bg-red-500/5"
                    : "text-blue-300 bg-blue-500/5"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
              }`}>
              {t === "excluir" ? <UserX className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {t === "excluir" ? "Na Planilha" : "Fora da Planilha"}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                tab === t
                  ? t === "excluir" ? "bg-red-500/20 text-red-300" : "bg-blue-500/20 text-blue-300"
                  : "bg-slate-700/60 text-slate-500"
              }`}>
                {t === "excluir" ? totalAtivos : totalExcluidos}
              </span>
              {tab === t && (
                <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${
                  t === "excluir" ? "bg-red-500" : "bg-blue-500"
                }`} />
              )}
            </button>
          ))}
        </div>

        {/* ── Corpo ── */}
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Barra de busca */}
          <div className="px-5 pt-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder={tab === "excluir" ? "Buscar na planilha..." : "Buscar colaborador..."}
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {busca && (
              <p className="text-[11px] text-slate-600 mt-1.5 ml-1">
                {(tab === "excluir" ? filtradosPlanilha : filtradosExcluidos).length} resultado(s) para &ldquo;{busca}&rdquo;
              </p>
            )}
          </div>

          {/* Grid de colaboradores */}
          <div className="flex-1 overflow-y-auto px-5 pb-5" style={{ minHeight: 0 }}>
            {tab === "excluir" ? (
              filtradosPlanilha.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center">
                    <Users className="w-7 h-7 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Nenhum colaborador encontrado</p>
                    <p className="text-xs text-slate-600 mt-1">Tente um termo diferente na busca</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filtradosPlanilha.map(c => (
                    <div key={c.id} className="group flex flex-col gap-2.5 p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/70 transition-all duration-200">
                      {/* Nome + avatar */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-600/50 flex items-center justify-center shrink-0 text-[11px] font-bold text-slate-300">
                          {c.nome.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-100 leading-snug" title={c.nome}>
                            {c.nome.length > 28 ? c.nome.slice(0, 28) + "…" : c.nome}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {c.valorVR > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/12 border border-orange-500/20 text-orange-300 text-[10px] font-medium">
                                <Utensils className="w-2.5 h-2.5" /> R$ {c.valorVR.toFixed(2)}
                              </span>
                            )}
                            {c.valorVT > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/12 border border-teal-500/20 text-blue-300 text-[10px] font-medium">
                                <Bus className="w-2.5 h-2.5" /> R$ {c.valorVT.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Botão */}
                      <button
                        onClick={() => toggle.mutate({ id: c.id, ativo: false })}
                        disabled={toggle.isPending}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/15 hover:border-red-500/35 hover:text-red-300 transition-all disabled:opacity-40 group-hover:border-red-500/30">
                        <UserX className="w-3.5 h-3.5" /> Remover da planilha
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              loadingExcluidos ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-7 h-7 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
                  <p className="text-xs text-slate-600">Carregando colaboradores...</p>
                </div>
              ) : filtradosExcluidos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-900/20 border border-emerald-800/30 flex items-center justify-center">
                    <UserPlus className="w-7 h-7 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Todos estão na planilha</p>
                    <p className="text-xs text-slate-600 mt-1">Nenhum colaborador fora da planilha</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filtradosExcluidos.map((c: any) => (
                    <div key={c.id} className="group flex flex-col gap-2.5 p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/70 transition-all duration-200">
                      {/* Nome + avatar */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-800/60 to-slate-700 border border-emerald-700/30 flex items-center justify-center shrink-0 text-[11px] font-bold text-blue-300">
                          {c.nome.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-100 leading-snug" title={c.nome}>
                            {c.nome.length > 28 ? c.nome.slice(0, 28) + "…" : c.nome}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {c.empresaNome && (
                              <span className="text-[10px] text-slate-600 font-medium bg-slate-700/40 px-2 py-0.5 rounded-full border border-slate-700/60">{c.empresaNome}</span>
                            )}
                            {c.valorVR && parseFloat(c.valorVR) > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/12 border border-orange-500/20 text-orange-300 text-[10px] font-medium">
                                <Utensils className="w-2.5 h-2.5" /> R$ {parseFloat(c.valorVR).toFixed(2)}
                              </span>
                            )}
                            {c.valorVT && parseFloat(c.valorVT) > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600/12 border border-teal-500/20 text-blue-300 text-[10px] font-medium">
                                <Bus className="w-2.5 h-2.5" /> R$ {parseFloat(c.valorVT).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Botão */}
                      <button
                        onClick={() => toggle.mutate({ id: c.id, ativo: true })}
                        disabled={toggle.isPending}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500/8 border border-emerald-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/15 hover:border-emerald-500/35 hover:text-blue-300 transition-all disabled:opacity-40">
                        <UserPlus className="w-3.5 h-3.5" /> Adicionar à planilha
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PlanilhaVRVT() {
  const isMobile = useIsMobile();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [setorFiltro, setSetorFiltro] = useState<string>("todos");
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  // Portal para injetar a barra de controles no slot sticky do DashboardLayout
  const [stickySlot, setStickySlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('sticky-header-slot');
    setStickySlot(el);
    return () => {
      // Limpa o slot ao desmontar
      if (el) el.innerHTML = '';
    };
  }, []);
  const utils = trpc.useUtils();

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: setoresDisponiveis } = trpc.setores.list.useQuery(
    { empresaId: empresaFiltro !== "todas" ? parseInt(empresaFiltro) : undefined },
    { enabled: true }
  );

  // Verifica se o mês atual já foi gerado
  const { data: mesGeradoData, isLoading: loadingMesGerado } = trpc.planilhaVRVT.isMesGerado.useQuery(
    { ano, mes },
    { enabled: true }
  );
  const mesGerado = mesGeradoData?.gerado ?? false;

  // Estado para diálogo de confirmação de exclusão
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  // Mutation para deletar o mês
  const { mutate: deletarMes, isPending: deletando } = trpc.planilhaVRVT.deletarMes.useMutation({
    onSuccess: () => {
      toast.success(`Planilha de ${MESES[mes - 1]} ${ano} apagada com sucesso!`);
      setConfirmarExcluir(false);
      utils.planilhaVRVT.isMesGerado.invalidate({ ano, mes });
      utils.planilhaVRVT.getDados.invalidate({ ano, mes });
    },
    onError: (e) => toast.error(`Erro ao apagar planilha: ${e.message}`),
  });

  // Mutation para gerar o mês
  const { mutate: gerarMes, isPending: gerando } = trpc.planilhaVRVT.gerarMes.useMutation({
    onSuccess: () => {
      toast.success(`Planilha de ${MESES[mes - 1]} ${ano} gerada com sucesso!`);
      utils.planilhaVRVT.isMesGerado.invalidate({ ano, mes });
      utils.planilhaVRVT.getDados.invalidate({ ano, mes });
    },
    onError: (e) => toast.error(`Erro ao gerar mês: ${e.message}`),
  });

  const { data, isLoading } = trpc.planilhaVRVT.getDados.useQuery(
    {
      ano,
      mes,
      empresaId: empresaFiltro !== "todas" ? parseInt(empresaFiltro) : undefined,
      setorId: setorFiltro !== "todos" ? parseInt(setorFiltro) : undefined,
    },
    { enabled: mesGerado } // Só busca dados se o mês foi gerado
  );

  const setoresFiltrados = useMemo(() => {
    if (!data?.setores) return [];
    return data.setores as SetorData[];
  }, [data]);
  // Setores com colaboradores filtrados pela busca (usado na renderização e no Excel)
  const setoresVisiveis = useMemo(() => {
    if (!buscaColaborador.trim()) return setoresFiltrados;
    const termo = buscaColaborador.trim().toLowerCase();
    return setoresFiltrados
      .map(s => ({ ...s, colaboradores: s.colaboradores.filter(c => c.nome.toLowerCase().includes(termo)) }))
      .filter(s => s.colaboradores.length > 0);
  }, [setoresFiltrados, buscaColaborador]);

  const totaisGerais = useMemo(() => {
    if (!setoresFiltrados.length) return null;
    return setoresFiltrados.reduce(
      (acc, s) => ({
        totalVrQ1: parseFloat((acc.totalVrQ1 + s.totalVrQ1).toFixed(2)),
        totalVtQ1: parseFloat((acc.totalVtQ1 + s.totalVtQ1).toFixed(2)),
        totalQ1: parseFloat((acc.totalQ1 + s.totalQ1).toFixed(2)),
        totalVrQ2: parseFloat((acc.totalVrQ2 + s.totalVrQ2).toFixed(2)),
        totalVtQ2: parseFloat((acc.totalVtQ2 + s.totalVtQ2).toFixed(2)),
        totalQ2: parseFloat((acc.totalQ2 + s.totalQ2).toFixed(2)),
        totalGeralVR: parseFloat((acc.totalGeralVR + s.totalGeralVR).toFixed(2)),
        totalDescontoVR: parseFloat((acc.totalDescontoVR + s.totalDescontoVR).toFixed(2)),
        totalGeralVT: parseFloat((acc.totalGeralVT + s.totalGeralVT).toFixed(2)),
        totalGeral: parseFloat((acc.totalGeral + s.totalGeral).toFixed(2)),
      }),
      { totalVrQ1: 0, totalVtQ1: 0, totalQ1: 0, totalVrQ2: 0, totalVtQ2: 0, totalQ2: 0, totalGeralVR: 0, totalDescontoVR: 0, totalGeralVT: 0, totalGeral: 0 }
    );
  }, [setoresFiltrados]);

  function exportarExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const mesNome = MESES[mes - 1].toUpperCase();
    const competencia = `${mesNome} / ${ano} - ${data.diasUteis} DIAS ÚTEIS`;
    for (const setor of setoresVisiveis) {
      const rows: (string | number)[][] = [];
      rows.push([`BENEFÍCIO: ${setor.empresaNome} - ( ${setor.setorNome} )`]);
      rows.push([`MÊS DE COMPETÊNCIA: ${competencia}`]);
      rows.push([
        "COLABORADOR", "AUSÊNCIAS",
        "VR Q1 - DIAS", "VR Q1 - VALOR", "VR Q1 - TOTAL",
        "VT Q1 - DIAS", "VT Q1 - VALOR", "VT Q1 - TOTAL",
        "VR Q2 - DIAS", "VR Q2 - VALOR", "VR Q2 - TOTAL",
        "VT Q2 - DIAS", "VT Q2 - VALOR", "VT Q2 - TOTAL",
        "DESC. VR (10%)", "TOTAL GERAL",
      ]);
      for (const c of setor.colaboradores) {
        rows.push([
          c.nome, c.diasAusencia > 0 ? c.diasAusencia : "",
          c.diasVrQ1, c.valorVR, c.totalVrQ1,
          c.diasVtQ1, c.valorVT, c.totalVtQ1,
          c.diasVrQ2, c.valorVR, c.totalVrQ2,
          c.diasVtQ2, c.valorVT, c.totalVtQ2,
          c.descontoVR, c.totalGeral,
        ]);
      }
      rows.push([
        "TOTAL", "",
        "", "", setor.totalVrQ1,
        "", "", setor.totalVtQ1,
        "", "", setor.totalVrQ2,
        "", "", setor.totalVtQ2,
        setor.totalDescontoVR, setor.totalGeral,
      ]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 35 }, { wch: 10 },
        { wch: 8 }, { wch: 12 }, { wch: 14 },
        { wch: 8 }, { wch: 12 }, { wch: 14 },
        { wch: 8 }, { wch: 12 }, { wch: 14 },
        { wch: 8 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, `${setor.setorNome}`.slice(0, 31));
    }
    // Resumo
    const resumoRows: (string | number)[][] = [
      [`RESUMO FINANCEIRO - ${competencia}`], [],
      ["SETOR", "EMPRESA", "COLABORADORES", "TOTAL VR Q1", "TOTAL VT Q1", "TOTAL Q1", "TOTAL VR Q2", "TOTAL VT Q2", "TOTAL Q2", "DESC. VR", "TOTAL GERAL"],
    ];
    for (const s of setoresVisiveis) {
      resumoRows.push([s.setorNome, s.empresaNome, s.colaboradores.length, s.totalVrQ1, s.totalVtQ1, s.totalQ1, s.totalVrQ2, s.totalVtQ2, s.totalQ2, s.totalDescontoVR, s.totalGeral]);
    }
    if (totaisGerais) {
      resumoRows.push([]);
      resumoRows.push(["TOTAL GERAL", "", setoresVisiveis.reduce((a, s) => a + s.colaboradores.length, 0), totaisGerais.totalVrQ1, totaisGerais.totalVtQ1, totaisGerais.totalQ1, totaisGerais.totalVrQ2, totaisGerais.totalVtQ2, totaisGerais.totalQ2, totaisGerais.totalDescontoVR, totaisGerais.totalGeral]);
    }
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    wsResumo["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo Financeiro");
    const sheetNames = wb.SheetNames;
    const resumoIdx = sheetNames.indexOf("Resumo Financeiro");
    if (resumoIdx > 0) { sheetNames.splice(resumoIdx, 1); sheetNames.unshift("Resumo Financeiro"); }
    XLSX.writeFile(wb, `VTVR-${MESES[mes - 1].toUpperCase()}-${ano}.xlsx`);
  }

  const totalColaboradores = setoresVisiveis.reduce((a, s) => a + s.colaboradores.length, 0);
  const totalAusencias = setoresVisiveis.reduce((a, s) => a + s.colaboradores.reduce((b, c) => b + (c.diasAusencia || 0), 0), 0);

  return (
    // Barra de controles vai via Portal para o slot sticky do DashboardLayout
    <>
    <ModalGerenciarColaboradores open={modalAberto} onClose={() => setModalAberto(false)} mes={mes} ano={ano} />
    {/* Portal: injeta a barra de controles no bloco sticky da topbar */}
    {stickySlot && createPortal(
      <div className="bg-[#0f1623] border-b border-slate-700/60">

        {/* ── Linha 1: título + navegação de mês/ano + botões ── */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800/70">

          {/* Ícone + título */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Planilha VR/VT</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Benefícios mensais</p>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-700/60 shrink-0" />

          {/* Navegação mês/ano */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { const d = new Date(ano, mes - 2, 1); setMes(d.getMonth() + 1); setAno(d.getFullYear()); }}
              className="w-7 h-8 flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all active:scale-95"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <Select value={String(mes)} onValueChange={v => setMes(parseInt(v))}>
              <SelectTrigger className="h-8 px-3 bg-slate-800/80 border-slate-700 text-slate-100 text-sm font-semibold min-w-[120px] hover:bg-slate-700 hover:border-slate-500 transition-all focus:ring-1 focus:ring-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={v => setAno(parseInt(v))}>
              <SelectTrigger className="h-8 px-3 bg-slate-800/80 border-slate-700 text-slate-400 text-sm font-medium min-w-[76px] hover:bg-slate-700 hover:border-slate-500 transition-all focus:ring-1 focus:ring-primary/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              onClick={() => { const d = new Date(ano, mes, 1); setMes(d.getMonth() + 1); setAno(d.getFullYear()); }}
              className="w-7 h-8 flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all active:scale-95"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Botões — direita */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Button
              onClick={() => setModalAberto(true)}
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
            >
              <Users className="w-3.5 h-3.5" />
              Gerenciar Colaboradores
            </Button>
            {mesGerado && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setConfirmarExcluir(true)}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 border-rose-800/60 bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 hover:text-rose-300 hover:border-rose-700 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Apagar Planilha
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-slate-800 border-slate-600 text-white">
                    Apagar a planilha de {MESES[mes - 1]} {ano}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              onClick={exportarExcel}
              disabled={!data || isLoading || setoresVisiveis.length === 0}
              size="sm"
              className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* ── Linha 2: filtros de empresa, setor e busca ── */}
        <div className="flex items-end gap-4 px-5 py-2.5 border-b border-slate-800/70 bg-slate-900/30">

          {/* Filtro Empresa */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" /> Empresa
            </label>
            <Select value={empresaFiltro} onValueChange={v => { setEmpresaFiltro(v); setSetorFiltro("todos"); }}>
              <SelectTrigger className="h-8 px-3 bg-slate-800/60 border-slate-700 text-slate-100 text-xs w-[220px] hover:bg-slate-700 hover:border-slate-500 transition-all focus:ring-1 focus:ring-primary/40">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {empresas?.map((e: { id: number; nome: string }) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Divisor */}
          <div className="w-px h-8 bg-slate-700/60 shrink-0 mb-0.5" />

          {/* Filtro Setor */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Layers className="w-2.5 h-2.5" /> Setor
            </label>
            <Select value={setorFiltro} onValueChange={setSetorFiltro}>
              <SelectTrigger className="h-8 px-3 bg-slate-800/60 border-slate-700 text-slate-100 text-xs w-[220px] hover:bg-slate-700 hover:border-slate-500 transition-all focus:ring-1 focus:ring-primary/40">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setoresDisponiveis?.map((s: { id: number; nome: string }) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Divisor */}
          <div className="w-px h-8 bg-slate-700/60 shrink-0 mb-0.5" />

          {/* Busca colaborador */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Search className="w-2.5 h-2.5" /> Buscar Colaborador
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={buscaColaborador}
                onChange={e => setBuscaColaborador(e.target.value)}
                placeholder="Digite o nome..."
                className="h-8 pl-8 pr-7 w-[220px] rounded-md bg-slate-800/60 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/60 hover:bg-slate-700 hover:border-slate-500 transition-all"
              />
              {buscaColaborador && (
                <button
                  onClick={() => setBuscaColaborador("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Indicador de filtros ativos */}
          {(empresaFiltro !== "todas" || setorFiltro !== "todos" || buscaColaborador) && (
            <button
              onClick={() => { setEmpresaFiltro("todas"); setSetorFiltro("todos"); setBuscaColaborador(""); }}
              className="mb-0.5 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-medium hover:bg-primary/20 transition-all shrink-0"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>

        {/* ── Linha 2: métricas de dias úteis + feriados ── */}
        {data && (
          <div className="flex items-center gap-3 px-5 py-2 border-t border-slate-800/80 bg-slate-950/40">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest shrink-0">Dias úteis</span>

            {/* Q1 */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-950/60 border border-blue-800/40">
              <div className="flex flex-col items-center leading-none">
                <span className="text-[8px] font-bold text-blue-500 uppercase tracking-wider">1ª Quinzena</span>
                <span className="text-sm font-bold text-blue-200 mt-0.5">{data.diasQ1} <span className="text-[10px] font-normal text-blue-400">dias</span></span>
              </div>
            </div>

            {/* Q2 */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-950/60 border border-violet-800/40">
              <div className="flex flex-col items-center leading-none">
                <span className="text-[8px] font-bold text-violet-500 uppercase tracking-wider">2ª Quinzena</span>
                <span className="text-sm font-bold text-violet-200 mt-0.5">{data.diasQ2} <span className="text-[10px] font-normal text-violet-400">dias</span></span>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <div className="flex flex-col items-center leading-none">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Total Mês</span>
                <span className="text-sm font-bold text-white mt-0.5">{data.diasUteis} <span className="text-[10px] font-normal text-slate-400">dias</span></span>
              </div>
            </div>

            <div className="w-px h-6 bg-slate-700/60 mx-1" />

            {/* Colaboradores */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex flex-col leading-none">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Colaboradores</span>
                <span className="text-sm font-bold text-white mt-0.5">{totalColaboradores}</span>
              </div>
              {totalAusencias > 0 && (
                <>
                  <div className="w-px h-5 bg-slate-700" />
                  <UserMinus className="w-3.5 h-3.5 text-blue-400" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wider">Ausências</span>
                    <span className="text-sm font-bold text-blue-300 mt-0.5">{totalAusencias}d</span>
                  </div>
                </>
              )}
            </div>

            {/* Feriados descontados */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border cursor-default transition-colors ${
                    data.feriadosDescontados && data.feriadosDescontados.length > 0
                      ? 'bg-rose-950/60 border-rose-800/50 hover:bg-rose-950/80'
                      : 'bg-slate-800/80 border-slate-700/60'
                  }`}>
                    <CalendarX2 className={`w-3.5 h-3.5 shrink-0 ${
                      data.feriadosDescontados && data.feriadosDescontados.length > 0 ? 'text-rose-400' : 'text-slate-500'
                    }`} />
                    <div className="flex flex-col leading-none">
                      <span className={`text-[8px] font-bold uppercase tracking-wider ${
                        data.feriadosDescontados && data.feriadosDescontados.length > 0 ? 'text-rose-500' : 'text-slate-500'
                      }`}>Feriados</span>
                      {data.feriadosDescontados && data.feriadosDescontados.length > 0 ? (
                        <span className="text-sm font-bold text-rose-300 mt-0.5">
                          {data.feriadosDescontados.length} <span className="text-[10px] font-normal text-rose-400">descontado{data.feriadosDescontados.length > 1 ? 's' : ''}</span>
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-slate-500 mt-0.5">Nenhum</span>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-slate-800 border-slate-600 text-white max-w-xs">
                  {data.feriadosDescontados && data.feriadosDescontados.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-rose-300 mb-1">Feriados descontados neste mês:</p>
                      {data.feriadosDescontados.map((f: { data: string; nome: string }) => {
                        const [y, m, d] = f.data.split('-');
                        return (
                          <div key={f.data} className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">{d}/{m}/{y}</span>
                            <span className="text-white">{f.nome}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Nenhum feriado em dia de semana neste mês.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    , stickySlot)}

    {/* Conteúdo principal da planilha */}
    <div className="flex flex-col bg-slate-950" style={{ minHeight: '100svh' }}>

      {/* ── Aviso ausências ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-950/30 border-b border-blue-900/40 text-[10px] text-blue-400">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>Clique na coluna <strong>Ausências</strong> para registrar faltas — VR e VT são recalculados automaticamente (desconto da 2ª quinzena primeiro).</span>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-3 py-3 overflow-x-auto pb-16">
        {loadingMesGerado ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner className="w-8 h-8 text-primary" />
            <p className="text-sm text-slate-400">Verificando planilha...</p>
          </div>
        ) : !mesGerado ? (
          /* Mês ainda não foi gerado — exibe aviso com botão */
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CalendarPlus className="w-10 h-10 text-primary/70" />
            </div>
            <div className="text-center max-w-md">
              <p className="text-xl font-bold text-white">
                {MESES[mes - 1]} {ano}
              </p>
              <p className="text-base text-slate-400 mt-1">
                A planilha deste mês ainda não foi gerada.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Clique no botão abaixo para gerar a planilha de <strong className="text-slate-300">{MESES[mes - 1]} {ano}</strong>.
                Os colaboradores ativos com VR/VT serão incluídos automaticamente.
              </p>
            </div>
            <Button
              onClick={() => gerarMes({ ano, mes })}
              disabled={gerando}
              className="gap-2 px-6 py-3 text-sm font-semibold h-auto bg-primary hover:bg-primary/90 transition-all"
            >
              {gerando ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Gerando planilha...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Gerar Planilha de {MESES[mes - 1]} {ano}</>
              )}
            </Button>
            <button
              onClick={() => {
                const d = new Date(ano, mes - 2, 1);
                setMes(d.getMonth() + 1);
                setAno(d.getFullYear());
              }}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Voltar para {MESES[new Date(ano, mes - 2, 1).getMonth()]} {new Date(ano, mes - 2, 1).getFullYear()}
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner className="w-8 h-8 text-primary" />
            <p className="text-sm text-slate-400">Carregando planilha...</p>
          </div>
        ) : setoresVisiveis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center">
              {buscaColaborador ? <Search className="w-8 h-8 text-slate-500" /> : <CalendarX2 className="w-8 h-8 text-slate-500" />}
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-slate-300">
                Nenhum colaborador encontrado
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Nenhum colaborador com VR/VT encontrado com os filtros selecionados.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Legenda Caju ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 mb-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Legenda:</span>
              {/* VT Saldo Livre — verde */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399', border: '1px solid #10b981' }}></div>
                <span className="text-[11px] font-medium" style={{ color: '#34d399' }}>VT Saldo Livre (Caju)</span>
              </div>
              {/* VR Saldo Livre — vermelho */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f87171', border: '1px solid #ef4444' }}></div>
                <span className="text-[11px] font-medium" style={{ color: '#f87171' }}>VR Saldo Livre (Caju)</span>
              </div>
              {/* Auxílio Veículo Caju — amarelo */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fbbf24', border: '1px solid #f59e0b' }}></div>
                <span className="text-[11px] font-medium" style={{ color: '#fbbf24' }}>Aux. Veículo (Caju)</span>
              </div>
              {/* Normal */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#475569', border: '1px solid #64748b' }}></div>
                <span className="text-[11px] text-slate-400">Normal</span>
              </div>
            </div>

            {setoresVisiveis.map((setor) => (
              <SetorCard
                key={`${setor.empresaId}-${setor.setorId}`}
                setor={setor}
                diasQ1={data?.diasQ1 ?? 0}
                diasQ2={data?.diasQ2 ?? 0}
                mes={mes}
                ano={ano}
                valorVR={data?.valorVR ?? 0}
              />
            ))}

            {/* ── Resumo consolidado ──────────────────────────────── */}
            {totaisGerais && (
              <div className="rounded-lg overflow-hidden border border-emerald-800/60 shadow-md mt-2">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-950/60 border-b border-emerald-800/50">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-blue-300">Resumo Financeiro Consolidado</span>
                  <span className="text-xs text-blue-500 ml-1">— {MESES[mes - 1]} {ano} · {setoresVisiveis.length} setor{setoresVisiveis.length > 1 ? "es" : ""} · {totalColaboradores} colaborador{totalColaboradores > 1 ? "es" : ""}</span>
                </div>
                <div className="overflow-x-auto bg-slate-900">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800">
                        <th className="border border-slate-700 px-3 py-2 text-left font-semibold text-slate-300">Métrica</th>
                        <th className="border border-slate-700 px-3 py-2 text-right font-semibold text-blue-400">1ª Quinzena</th>
                        <th className="border border-slate-700 px-3 py-2 text-right font-semibold text-violet-400">2ª Quinzena</th>
                        <th className="border border-slate-700 px-3 py-2 text-right font-bold text-blue-400">Total Geral</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-slate-300">
                          <span className="inline-flex items-center gap-1.5"><Utensils className="w-3 h-3 text-orange-400" /> Vale-Refeição (VR)</span>
                        </td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right text-blue-300"><PrivacyValue value={fmtR(totaisGerais.totalVrQ1)} iconSize={11} /></td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right text-violet-300"><PrivacyValue value={fmtR(totaisGerais.totalVrQ2)} iconSize={11} /></td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right font-semibold text-slate-200"><PrivacyValue value={fmtR(totaisGerais.totalGeralVR)} iconSize={11} /></td>
                      </tr>
                      <tr className="bg-slate-800/40">
                        <td className="border border-slate-700/60 px-3 py-1.5 text-slate-300">
                          <span className="inline-flex items-center gap-1.5"><Bus className="w-3 h-3 text-blue-400" /> Vale-Transporte (VT)</span>
                        </td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right text-blue-300"><PrivacyValue value={fmtR(totaisGerais.totalVtQ1)} iconSize={11} /></td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right text-violet-300"><PrivacyValue value={fmtR(totaisGerais.totalVtQ2)} iconSize={11} /></td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right font-semibold text-slate-200"><PrivacyValue value={fmtR(totaisGerais.totalGeralVT)} iconSize={11} /></td>
                      </tr>
                      <tr>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-red-400">Desconto VR (10%)</td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right text-slate-600">—</td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right text-slate-600">—</td>
                        <td className="border border-slate-700/60 px-3 py-1.5 text-right font-semibold text-red-400">(<PrivacyValue value={fmtR(totaisGerais.totalDescontoVR)} iconSize={11} />)</td>
                      </tr>
                      <tr className="bg-emerald-950/30 font-bold">
                        <td className="border border-slate-700/60 px-3 py-2 text-blue-300">TOTAL GERAL</td>
                        <td className="border border-slate-700/60 px-3 py-2 text-right text-blue-300"><PrivacyValue value={fmtR(totaisGerais.totalQ1)} iconSize={12} /></td>
                        <td className="border border-slate-700/60 px-3 py-2 text-right text-violet-300"><PrivacyValue value={fmtR(totaisGerais.totalQ2)} iconSize={12} /></td>
                        <td className="border border-slate-700/60 px-3 py-2 text-right text-blue-300 text-sm"><PrivacyValue value={fmtR(totaisGerais.totalGeral)} iconSize={12} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* Diálogo de confirmação de exclusão da planilha */}
    <AlertDialog open={confirmarExcluir} onOpenChange={v => { if (!v) setConfirmarExcluir(false); }}>
      <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            Apagar planilha?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            Deseja apagar a planilha de <strong className="text-slate-200">{MESES[mes - 1]} {ano}</strong>?
            <br />
            <span className="text-xs text-slate-500 mt-1 block">
              Esta ação removerá a planilha e todos os dias personalizados lançados neste mês.
              Os colaboradores e seus valores base não serão afetados.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white"
            onClick={() => setConfirmarExcluir(false)}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deletarMes({ ano, mes })}
            disabled={deletando}
            className="bg-rose-700 hover:bg-rose-600 text-white border-0"
          >
            {deletando ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> Apagando...</>
            ) : (
              <><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Sim, apagar planilha</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>  
  );
}
