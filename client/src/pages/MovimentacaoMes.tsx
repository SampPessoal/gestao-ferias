import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Shield, Laptop, Heart, Bus, Baby, Award,
  Plus, Trash2, Pencil, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronUp, Search, Building2,
  Download, FileSpreadsheet, FileText,
} from "lucide-react";
import * as XLSX from "xlsx";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const EMPRESAS = ["FREIRE", "JOANES", "SUDOESTE", "SOLAR"] as const;
type Empresa = typeof EMPRESAS[number];

const EMPRESA_CORES: Record<Empresa, string> = {
  FREIRE: "bg-blue-500",
  JOANES: "bg-zinc-500",
  SUDOESTE: "bg-stone-500",
  SOLAR: "bg-neutral-500",
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  // Se é string no formato YYYY-MM-DD, adiciona T12:00:00 para evitar problema de fuso
  if (typeof d === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
    return new Date(d).toLocaleDateString("pt-BR");
  }
  // Se é Date object (superjson serializa como ISO string), extrai a data local
  // usando os métodos UTC para evitar problema de fuso (o banco salva como UTC midnight)
  const utcYear = d.getUTCFullYear();
  const utcMonth = String(d.getUTCMonth() + 1).padStart(2, "0");
  const utcDay = String(d.getUTCDate()).padStart(2, "0");
  return new Date(`${utcYear}-${utcMonth}-${utcDay}T12:00:00`).toLocaleDateString("pt-BR");
}

function calcIdade(dataNasc: Date | string | null | undefined): number | null {
  if (!dataNasc) return null;
  const dt = typeof dataNasc === "string" ? new Date(dataNasc + "T12:00:00") : dataNasc;
  const hoje = new Date();
  let idade = hoje.getFullYear() - dt.getFullYear();
  const m = hoje.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dt.getDate())) idade--;
  return idade;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TipoMovimentacao = "seguroVida" | "auxNotebook" | "planoSaude" | "valeTransporte" | "auxCreche" | "bonusIndicacao";

const ABAS: { id: TipoMovimentacao; label: string; icon: React.ReactNode; cor: string }[] = [
  { id: "seguroVida", label: "Seguro de Vida", icon: <Shield className="w-4 h-4" />, cor: "text-zinc-300" },
  { id: "auxNotebook", label: "Auxílio Notebook", icon: <Laptop className="w-4 h-4" />, cor: "text-zinc-300" },
  { id: "planoSaude", label: "Plano de Saúde", icon: <Heart className="w-4 h-4" />, cor: "text-zinc-300" },
  { id: "valeTransporte", label: "Vale Transporte", icon: <Bus className="w-4 h-4" />, cor: "text-zinc-300" },
  { id: "auxCreche", label: "Auxílio Creche", icon: <Baby className="w-4 h-4" />, cor: "text-zinc-300" },
  { id: "bonusIndicacao", label: "Bônus por Indicação", icon: <Award className="w-4 h-4" />, cor: "text-zinc-300" },
];

// ─── Busca de colaborador inline ──────────────────────────────────────────────
function BuscaColaborador({
  value, onChange, placeholder = "Buscar colaborador...", incluirInativos = false,
}: {
  value: { id: number; nome: string; empresa: string; valorSeguroVida?: string | null } | null;
  onChange: (c: { id: number; nome: string; empresa: string; valorSeguroVida?: string | null } | null) => void;
  placeholder?: string;
  incluirInativos?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const { data: ativos } = trpc.colaboradores.listAtivos.useQuery(undefined, { staleTime: 30_000 });
  // Para movimentações que precisam de inativos, busca via list com status=todos
  const { data: todos } = trpc.colaboradores.list.useQuery(
    incluirInativos ? { busca: busca.length >= 2 ? busca : undefined, status: "todos" } : undefined,
    { enabled: incluirInativos && busca.length >= 2, staleTime: 10_000 }
  );

  const filtrados = useMemo(() => {
    if (busca.length < 2) return [];
    const lower = busca.toLowerCase();
    if (incluirInativos && todos) {
      return (todos.data ?? []).filter((c: any) => c.nome.toLowerCase().includes(lower)).slice(0, 10);
    }
    if (!ativos) return [];
    return ativos.filter(c => c.nome.toLowerCase().includes(lower)).slice(0, 10);
  }, [ativos, todos, busca, incluirInativos]);

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="text-sm text-foreground flex-1">{value.nome}</span>
          <Badge variant="outline" className="text-[10px]">{value.empresa}</Badge>
          <button onClick={() => { onChange(null); setBusca(""); }} className="text-muted-foreground hover:text-foreground ml-1">×</button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <Input
            value={busca}
            onChange={e => { setBusca(e.target.value); setAberto(true); }}
            onFocus={() => setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 200)}
            placeholder={placeholder}
            className="pl-8 text-sm"
          />
          {aberto && filtrados.length > 0 && (
            <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-card shadow-xl max-h-56 overflow-y-auto">
              {filtrados.map((c: any) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 border-b border-border/30 last:border-0 transition-colors"
                  onMouseDown={() => { onChange({ id: c.id, nome: c.nome, empresa: c.empresaNome ?? "" }); setBusca(""); setAberto(false); }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{c.nome}</span>
                    {c.status && c.status !== "ativo" && (
                      <span className="text-[10px] text-amber-400/80 shrink-0">{c.status === "inativo" ? "Inativo" : c.status}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.empresaNome ?? "—"}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal genérico de confirmação de exclusão ────────────────────────────────
function ModalExcluir({ aberto, onClose, onConfirm, nome }: {
  aberto: boolean; onClose: () => void; onConfirm: () => void; nome: string;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir registro</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Deseja excluir o registro de <strong className="text-foreground">{nome}</strong>? Esta ação não pode ser desfeita.</p>
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={onConfirm}>Excluir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba Seguro de Vida ───────────────────────────────────────────────────────
function AbaSeguroVida({ mes, ano, empresa, onDataLoad }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [excluirNome, setExcluirNome] = useState("");
  const [form, setForm] = useState({ colaborador: null as { id: number; nome: string; empresa: string; valorSeguroVida?: string | null } | null, tipo: "incluir" as "incluir" | "excluir", data: "", valor: "", observacao: "" });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.movimentacao.seguroVida.list.useQuery({ empresa: empresa || undefined, mes, ano });
  useEffect(() => {
    if (data && onDataLoad) onDataLoad(data);
  }, [data, onDataLoad]);
  const criar = trpc.movimentacao.seguroVida.create.useMutation({
    onSuccess: () => { utils.movimentacao.seguroVida.list.invalidate(); toast.success("Registro adicionado!"); setModal(false); setForm({ colaborador: null, tipo: "incluir", data: "", valor: "", observacao: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.movimentacao.seguroVida.update.useMutation({
    onSuccess: () => { utils.movimentacao.seguroVida.list.invalidate(); toast.success("Registro atualizado!"); setEditandoId(null); setModal(false); setForm({ colaborador: null, tipo: "incluir", data: "", valor: "", observacao: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const excluir = trpc.movimentacao.seguroVida.delete.useMutation({
    onSuccess: () => { utils.movimentacao.seguroVida.list.invalidate(); toast.success("Registro excluído!"); setExcluirId(null); },
    onError: (e) => toast.error(e.message),
  });

  const abrirEdicao = (r: any) => {
    setEditandoId(r.id);
    const dtStr = r.data ? (r.data instanceof Date ? `${r.data.getUTCFullYear()}-${String(r.data.getUTCMonth()+1).padStart(2,'0')}-${String(r.data.getUTCDate()).padStart(2,'0')}` : String(r.data).slice(0,10)) : "";
    setForm({ colaborador: { id: r.colaboradorId, nome: r.nomeColaborador ?? "", empresa: r.empresa ?? "" }, tipo: r.tipo, data: dtStr, valor: r.valor != null ? String(r.valor) : "", observacao: r.observacao ?? "" });
    setModal(true);
  };

  const handleSalvar = () => {
    if (editandoId) {
      atualizar.mutate({ id: editandoId, tipo: form.tipo, data: form.data || undefined, observacao: form.observacao || undefined });
      return;
    }
    if (!form.colaborador) return toast.error("Selecione um colaborador");
    if (!form.data) return toast.error("Informe a data");
    criar.mutate({ colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome, empresa: form.colaborador.empresa || empresa, tipo: form.tipo, data: form.data, observacao: form.observacao || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} registro(s) no período</p>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Registro
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colaborador</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observação</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registrado por</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
              ) : data.map((r, i) => (
                <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.nomeColaborador ?? "—"}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.empresa}</Badge></td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className={r.tipo === "incluir" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-red-100 text-red-700 border-red-200"}>
                      {r.tipo === "incluir" ? "Incluir" : "Excluir"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.data)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{r.observacao ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.createdByNome ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEdicao(r)} className="text-muted-foreground/40 hover:text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setExcluirId(r.id); setExcluirNome(r.nomeColaborador ?? ""); }} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal novo/editar */}
      <Dialog open={modal} onOpenChange={v => {       setModal(v); if (!v) { setEditandoId(null); setForm({ colaborador: null, tipo: "incluir", data: "", valor: "", observacao: "" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> {editandoId ? "Editar" : "Novo"} — Seguro de Vida</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Colaborador *</label><BuscaColaborador value={form.colaborador} onChange={c => setForm(f => ({ ...f, colaborador: c, valor: c?.valorSeguroVida ? String(c.valorSeguroVida) : f.valor }))} /></div>
            {/* Empresa preenchida automaticamente */}
            {form.colaborador && (
              <div><label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                  <span className="text-sm text-foreground">{form.colaborador.empresa || "—"}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">Preenchido automaticamente</Badge>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incluir">Incluir</SelectItem>
                    <SelectItem value="excluir">Excluir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Data *</label><Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Valor do Desconto (R$)</label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="Preenchido automaticamente pela empresa..."
                  className={form.colaborador?.valorSeguroVida ? "border-emerald-500/50 bg-emerald-950/10" : ""}
                />
                {form.colaborador?.valorSeguroVida && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 font-medium">Auto</span>
                )}
              </div>
              {form.colaborador?.valorSeguroVida && (
                <p className="text-[11px] text-emerald-400 mt-1">✓ Valor preenchido automaticamente com base na empresa do colaborador. Pode ser editado se necessário.</p>
              )}
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Observação</label><Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={criar.isPending || atualizar.isPending}>{(criar.isPending || atualizar.isPending) ? <Spinner className="w-3 h-3 mr-1" /> : null}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModalExcluir aberto={excluirId !== null} onClose={() => setExcluirId(null)} onConfirm={() => excluirId && excluir.mutate({ id: excluirId })} nome={excluirNome} />
    </div>
  );
}

// ─── Aba Auxílio Notebook ─────────────────────────────────────────────────────
function AbaAuxilioNotebook({ mes, ano, empresa, onDataLoad }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [excluirNome, setExcluirNome] = useState("");
  const [form, setForm] = useState({ colaborador: null as { id: number; nome: string; empresa: string } | null, tipo: "incluir" as "incluir" | "excluir", dataInicio: "", valor: "150.00", observacao: "" });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.movimentacao.auxNotebook.list.useQuery({ empresa: empresa || undefined, mes, ano });
  useEffect(() => {
    if (data && onDataLoad) onDataLoad(data);
  }, [data, onDataLoad]);
  const criar = trpc.movimentacao.auxNotebook.create.useMutation({
    onSuccess: () => { utils.movimentacao.auxNotebook.list.invalidate(); toast.success("Registro adicionado!"); setModal(false); setForm({ colaborador: null, tipo: "incluir", dataInicio: "", valor: "150.00", observacao: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.movimentacao.auxNotebook.update.useMutation({
    onSuccess: () => { utils.movimentacao.auxNotebook.list.invalidate(); toast.success("Registro atualizado!"); setEditandoId(null); setModal(false); setForm({ colaborador: null, tipo: "incluir", dataInicio: "", valor: "150.00", observacao: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const excluir = trpc.movimentacao.auxNotebook.delete.useMutation({
    onSuccess: () => { utils.movimentacao.auxNotebook.list.invalidate(); toast.success("Registro excluído!"); setExcluirId(null); },
    onError: (e) => toast.error(e.message),
  });

  const abrirEdicao = (r: any) => {
    setEditandoId(r.id);
    const dtStr = r.dataInicio ? (r.dataInicio instanceof Date ? `${r.dataInicio.getUTCFullYear()}-${String(r.dataInicio.getUTCMonth()+1).padStart(2,'0')}-${String(r.dataInicio.getUTCDate()).padStart(2,'0')}` : String(r.dataInicio).slice(0,10)) : "";
    setForm({ colaborador: { id: r.colaboradorId, nome: r.nomeColaborador ?? "", empresa: r.empresa ?? "" }, tipo: r.tipo, dataInicio: dtStr, valor: r.valor != null ? String(r.valor) : "150.00", observacao: r.observacao ?? "" });
    setModal(true);
  };

  const handleSalvar = () => {
    if (editandoId) {
      atualizar.mutate({ id: editandoId, tipo: form.tipo, dataInicio: form.dataInicio || undefined, valor: parseFloat(form.valor) || undefined, observacao: form.observacao || undefined });
      return;
    }
    if (!form.colaborador) return toast.error("Selecione um colaborador");
    if (!form.dataInicio) return toast.error("Informe a data de início");
    criar.mutate({ colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome, empresa: form.colaborador.empresa || empresa, tipo: form.tipo, dataInicio: form.dataInicio, valor: parseFloat(form.valor) || 150, observacao: form.observacao || undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} registro(s) no período</p>
          <Badge variant="outline" className="text-xs">Valor padrão: R$ 150,00</Badge>
        </div>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Registro
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colaborador</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Início</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observação</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
              ) : data.map((r, i) => (
                <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.nomeColaborador ?? "—"}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.empresa}</Badge></td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className={r.tipo === "incluir" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-red-100 text-red-700 border-red-200"}>
                      {r.tipo === "incluir" ? "Incluir" : "Excluir"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.dataInicio)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                    {r.valor != null ? Number(r.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 150,00"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate">{r.observacao ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEdicao(r)} className="text-muted-foreground/40 hover:text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setExcluirId(r.id); setExcluirNome(r.nomeColaborador ?? ""); }} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modal} onOpenChange={v => { setModal(v); if (!v) { setEditandoId(null); setForm({ colaborador: null, tipo: "incluir", dataInicio: "", valor: "150.00", observacao: "" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Laptop className="w-4 h-4 text-primary" /> {editandoId ? "Editar" : "Novo"} — Auxílio Notebook</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Colaborador *</label><BuscaColaborador value={form.colaborador} onChange={c => setForm(f => ({ ...f, colaborador: c }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incluir">Incluir</SelectItem>
                    <SelectItem value="excluir">Excluir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Data Início *</label><Input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Observação</label><Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={criar.isPending}>{criar.isPending ? <Spinner className="w-3 h-3 mr-1" /> : null}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModalExcluir aberto={excluirId !== null} onClose={() => setExcluirId(null)} onConfirm={() => excluirId && excluir.mutate({ id: excluirId })} nome={excluirNome} />
    </div>
  );
}

// ─── Aba Plano de Saúde ───────────────────────────────────────────────────────
function AbaPlanoSaude({ mes, ano, empresa, onDataLoad }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [excluirNome, setExcluirNome] = useState("");
  const FORM_INICIAL_PS = { colaborador: null as { id: number; nome: string; empresa: string } | null, tipo: "incluir" as "incluir" | "excluir", tipoPlano: "", categoria: "titular" as "titular" | "dependente", dataNascimento: "", valor: "", observacao: "" };
  const [form, setForm] = useState(FORM_INICIAL_PS);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.movimentacao.planoSaude.list.useQuery({ empresa: empresa || undefined, mes, ano });
  useEffect(() => {
    if (data && onDataLoad) onDataLoad(data);
  }, [data, onDataLoad]);
  const criar = trpc.movimentacao.planoSaude.create.useMutation({
    onSuccess: () => { utils.movimentacao.planoSaude.list.invalidate(); toast.success("Registro adicionado!"); setModal(false); setForm(FORM_INICIAL_PS); },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.movimentacao.planoSaude.update.useMutation({
    onSuccess: () => { utils.movimentacao.planoSaude.list.invalidate(); toast.success("Registro atualizado!"); setEditandoId(null); setModal(false); setForm(FORM_INICIAL_PS); },
    onError: (e) => toast.error(e.message),
  });
  const excluir = trpc.movimentacao.planoSaude.delete.useMutation({
    onSuccess: () => { utils.movimentacao.planoSaude.list.invalidate(); toast.success("Registro excluído!"); setExcluirId(null); },
    onError: (e) => toast.error(e.message),
  });

  const idadeForm = calcIdade(form.dataNascimento);

  const abrirEdicao = (r: any) => {
    setEditandoId(r.id);
    const dtStr = r.dataNascimento ? (r.dataNascimento instanceof Date ? `${r.dataNascimento.getUTCFullYear()}-${String(r.dataNascimento.getUTCMonth()+1).padStart(2,'0')}-${String(r.dataNascimento.getUTCDate()).padStart(2,'0')}` : String(r.dataNascimento).slice(0,10)) : "";
    setForm({ colaborador: { id: r.colaboradorId, nome: r.nomeColaborador ?? "", empresa: r.empresa ?? "" }, tipo: r.tipo, tipoPlano: r.tipoPlano ?? "", categoria: r.categoria ?? "titular", dataNascimento: dtStr, valor: r.valor != null ? String(r.valor) : "", observacao: r.observacao ?? "" });
    setModal(true);
  };

  const handleSalvar = () => {
      if (editandoId) {
      atualizar.mutate({ id: editandoId, tipo: form.tipo, tipoPlano: form.tipoPlano || undefined, categoria: form.categoria, dataNascimento: form.dataNascimento || undefined, valor: form.valor ? parseFloat(form.valor) : undefined, valorEmpresa: calculoSubsidio?.subsidio ?? undefined, valorColaborador: calculoSubsidio?.valorColaborador ?? undefined, observacao: form.observacao || undefined });
      return;
    }
    if (!form.colaborador) return toast.error("Selecione um colaborador");
    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      tipoPlano: form.tipoPlano || undefined, categoria: form.categoria,
      dataNascimento: form.dataNascimento || undefined,
      valor: form.valor ? parseFloat(form.valor) : undefined,
      valorEmpresa: calculoSubsidio?.subsidio ?? undefined,
      valorColaborador: calculoSubsidio?.valorColaborador ?? undefined,
      observacao: form.observacao || undefined,
      competenciaMes: mes, competenciaAno: ano,
    });
  };

  // ── Tabela de preços para select de plano e cálculo de subsídio ──────────────
  const { data: precos = [] } = trpc.tabelaPrecos.list.useQuery({ empresa: undefined });
  const PLANO_BASE = "967067"; // Prata QC — base do subsídio em todas as empresas
  const empresaForm = form.colaborador?.empresa || empresa || "";

  // Planos disponíveis para a empresa do colaborador (sem duplicatas)
  const planosDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    (precos as any[]).forEach(p => {
      if (p.empresa === empresaForm) map.set(p.codigoPlano, p.nomePlano);
    });
    return Array.from(map.entries()).map(([codigo, nome]) => ({ codigo, nome }));
  }, [precos, empresaForm]);

  // Formata nome do plano de forma amigável
  const fmtPlano = (nome: string) => {
    if (!nome) return nome;
    return nome.replace(/\s*COPART\s*/gi, "").replace(/\s*TP\s*/gi, "").replace(/\s*PJ_PME\s*/gi, "").trim()
      .split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  };

  // Calcula valor automático pela faixa etária
  const valorAutomatico = useMemo(() => {
    if (!form.tipoPlano || !empresaForm || !idadeForm) return null;
    const faixa = (precos as any[]).find(
      p => p.empresa === empresaForm && p.codigoPlano === form.tipoPlano &&
        p.faixaInicio <= idadeForm && p.faixaFim >= idadeForm
    );
    if (!faixa) return null;
    return form.categoria === "titular" ? Number(faixa.valorTitular) : Number(faixa.valorDependente);
  }, [precos, empresaForm, form.tipoPlano, idadeForm, form.categoria]);

  // Atualiza valor automaticamente ao mudar plano/idade/categoria
  useEffect(() => {
    if (valorAutomatico !== null) setForm(f => ({ ...f, valor: valorAutomatico.toFixed(2) }));
  }, [valorAutomatico]);

  // Calcula subsídio: 70% do Prata QC na mesma faixa etária
  const calculoSubsidio = useMemo(() => {
    if (!form.tipoPlano || !empresaForm || !idadeForm || valorAutomatico === null) return null;
    const faixaPrata = (precos as any[]).find(
      p => p.empresa === empresaForm && p.codigoPlano === PLANO_BASE &&
        p.faixaInicio <= idadeForm && p.faixaFim >= idadeForm
    );
    const valorPrata = faixaPrata ? (form.categoria === "titular" ? Number(faixaPrata.valorTitular) : Number(faixaPrata.valorDependente)) : 0;
    const subsidio = valorPrata * 0.7;
    const isPrata = form.tipoPlano === PLANO_BASE;
    const valorColaborador = Math.max(0, valorAutomatico - subsidio);
    return { valorBruto: valorAutomatico, subsidio, valorColaborador, isPrata };
  }, [precos, empresaForm, form.tipoPlano, idadeForm, form.categoria, valorAutomatico]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} registro(s) no período</p>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Registro
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colaborador</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plano</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Idade</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor Plano</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: "oklch(0.40 0.10 250)" }}>Empresa</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold" style={{ color: "oklch(0.45 0.10 30)" }}>Colaborador</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
              ) : data.map((r, i) => (
                <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.nomeColaborador ?? "—"}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.empresa}</Badge></td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className={r.tipo === "incluir" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-red-100 text-red-700 border-red-200"}>
                      {r.tipo === "incluir" ? "Incluir" : "Excluir"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.tipoPlano ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={`text-[10px] ${r.categoria === "titular" ? "border-blue-400 text-blue-700" : ""}`}>
                      {r.categoria === "titular" ? "Titular" : "Dependente"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{calcIdade(r.dataNascimento) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                    {r.valor != null ? Number(r.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "oklch(0.35 0.10 250)" }}>
                    {(r as any).valorEmpresa != null ? Number((r as any).valorEmpresa).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "oklch(0.40 0.14 30)" }}>
                    {(r as any).valorColaborador != null ? Number((r as any).valorColaborador).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEdicao(r)} className="text-muted-foreground/40 hover:text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setExcluirId(r.id); setExcluirNome(r.nomeColaborador ?? ""); }} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modal} onOpenChange={v => { setModal(v); if (!v) { setEditandoId(null); setForm(FORM_INICIAL_PS); } }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              {editandoId ? "Editar" : "Novo Registro"} — Plano de Saúde
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 overflow-y-auto flex-1 pr-0.5">
            {/* Colaborador */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Colaborador *</label>
              <BuscaColaborador value={form.colaborador} onChange={c => setForm(f => ({ ...f, colaborador: c, tipoPlano: "" }))} />
            </div>
            {/* Tipo + Categoria */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tipo *</label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incluir">Incluir</SelectItem>
                    <SelectItem value="excluir">Excluir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Categoria</label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="titular">Titular</SelectItem>
                    <SelectItem value="dependente">Dependente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Data de Nascimento */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Data de Nascimento</label>
              <Input type="date" value={form.dataNascimento} onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value }))} />
              {idadeForm !== null && idadeForm > 0 && (
                <p className="text-xs text-blue-600 mt-1 font-medium">{idadeForm} anos</p>
              )}
            </div>
            {/* Plano — select filtrado pela empresa do colaborador */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Plano {empresaForm ? <span className="text-blue-500">({empresaForm})</span> : ""}
              </label>
              {planosDisponiveis.length > 0 ? (
                <Select value={form.tipoPlano} onValueChange={v => setForm(f => ({ ...f, tipoPlano: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o plano..." /></SelectTrigger>
                  <SelectContent>
                    {planosDisponiveis.map(p => (
                      <SelectItem key={p.codigo} value={p.codigo}>{fmtPlano(p.nome)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.tipoPlano} onChange={e => setForm(f => ({ ...f, tipoPlano: e.target.value }))} placeholder={empresaForm ? "Nenhum plano cadastrado para esta empresa" : "Selecione um colaborador primeiro..."} />
              )}
            </div>
            {/* Valor */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Valor (R$)</label>
              <Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              {valorAutomatico !== null && (
                <p className="text-[11px] text-amber-600 mt-1">Calculado automaticamente pela faixa etária ({idadeForm} anos)</p>
              )}
            </div>
            {/* Card de subsídio */}
            {calculoSubsidio !== null && (
              <div className="rounded-lg border p-3 space-y-2" style={{ background: "oklch(0.97 0.01 150)", borderColor: "oklch(0.85 0.06 150)" }}>
                <p className="text-[11px] font-bold" style={{ color: "oklch(0.30 0.10 150)" }}>
                  Resumo · {idadeForm} anos · {calculoSubsidio.isPrata ? "Prata QC (70% subsidiado)" : "Plano superior"}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md p-2" style={{ background: "oklch(0.93 0.03 150)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.45 0.08 150)" }}>Valor Plano</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.25 0.10 150)" }}>R$ {calculoSubsidio.valorBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-md p-2" style={{ background: "oklch(0.93 0.05 250)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.40 0.10 250)" }}>Empresa</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.25 0.12 250)" }}>R$ {calculoSubsidio.subsidio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-md p-2" style={{ background: "oklch(0.93 0.05 30)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.45 0.10 30)" }}>Colaborador</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.30 0.14 30)" }}>R$ {calculoSubsidio.valorColaborador.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                {!calculoSubsidio.isPrata && (
                  <p className="text-[10px]" style={{ color: "oklch(0.45 0.08 150)" }}>Subsídio = 70% do Prata QC na mesma faixa etária</p>
                )}
              </div>
            )}
            {/* Observação */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Observação</label>
              <Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4 pt-2 border-t border-border/40">
            <Button variant="outline" size="sm" onClick={() => { setModal(false); setEditandoId(null); setForm(FORM_INICIAL_PS); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={criar.isPending || atualizar.isPending}>
              {(criar.isPending || atualizar.isPending) ? <Spinner className="w-3 h-3 mr-1" /> : null}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModalExcluir aberto={excluirId !== null} onClose={() => setExcluirId(null)} onConfirm={() => excluirId && excluir.mutate({ id: excluirId })} nome={excluirNome} />
    </div>
  );
}

// ─── Aba Vale Transporte ──────────────────────────────────────────────────────
function AbaValeTransporte({ mes, ano, empresa, onDataLoad }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [excluirNome, setExcluirNome] = useState("");
  const FORM_INICIAL_VT = { colaborador: null as { id: number; nome: string; empresa: string } | null, tipo: "incluir" as "incluir" | "excluir", observacao: "" };
  const [form, setForm] = useState(FORM_INICIAL_VT);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.movimentacao.valeTransporte.list.useQuery({ empresa: empresa || undefined, mes, ano });
  useEffect(() => {
    if (data && onDataLoad) onDataLoad(data);
  }, [data, onDataLoad]);
  const criar = trpc.movimentacao.valeTransporte.create.useMutation({
    onSuccess: () => { utils.movimentacao.valeTransporte.list.invalidate(); toast.success("Registro adicionado!"); setModal(false); setForm(FORM_INICIAL_VT); },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.movimentacao.valeTransporte.update.useMutation({
    onSuccess: () => { utils.movimentacao.valeTransporte.list.invalidate(); toast.success("Registro atualizado!"); setEditandoId(null); setModal(false); setForm(FORM_INICIAL_VT); },
    onError: (e) => toast.error(e.message),
  });
  const excluir = trpc.movimentacao.valeTransporte.delete.useMutation({
    onSuccess: () => { utils.movimentacao.valeTransporte.list.invalidate(); toast.success("Registro excluído!"); setExcluirId(null); },
    onError: (e) => toast.error(e.message),
  });

  const abrirEdicao = (r: any) => {
    setEditandoId(r.id);
    setForm({ colaborador: { id: r.colaboradorId, nome: r.nomeColaborador ?? "", empresa: r.empresa ?? "" }, tipo: r.tipo, observacao: r.observacao ?? "" });
    setModal(true);
  };

  const handleSalvar = () => {
    if (editandoId) {
      atualizar.mutate({ id: editandoId, tipo: form.tipo, observacao: form.observacao || undefined });
      return;
    }
    if (!form.colaborador) return toast.error("Selecione um colaborador");
    criar.mutate({ colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome, empresa: form.colaborador.empresa || empresa, tipo: form.tipo, observacao: form.observacao || undefined, competenciaMes: mes, competenciaAno: ano });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} registro(s) no período</p>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Registro
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colaborador</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observação</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registrado por</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
              ) : data.map((r, i) => (
                <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.nomeColaborador ?? "—"}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.empresa}</Badge></td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className={r.tipo === "incluir" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-red-100 text-red-700 border-red-200"}>
                      {r.tipo === "incluir" ? "Incluir" : "Excluir"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[250px] truncate">{r.observacao ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.createdByNome ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEdicao(r)} className="text-muted-foreground/40 hover:text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setExcluirId(r.id); setExcluirNome(r.nomeColaborador ?? ""); }} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modal} onOpenChange={v => { setModal(v); if (!v) { setEditandoId(null); setForm(FORM_INICIAL_VT); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Bus className="w-4 h-4 text-primary" /> {editandoId ? "Editar" : "Novo"} — Vale Transporte</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Colaborador *</label><BuscaColaborador value={form.colaborador} onChange={c => setForm(f => ({ ...f, colaborador: c }))} incluirInativos={true} placeholder="Buscar colaborador (ativos e inativos)..." /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incluir">Incluir</SelectItem>
                  <SelectItem value="excluir">Excluir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Observação</label><Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: Linha 1234, valor R$ 4,50..." /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => { setModal(false); setEditandoId(null); setForm(FORM_INICIAL_VT); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={criar.isPending || atualizar.isPending}>{(criar.isPending || atualizar.isPending) ? <Spinner className="w-3 h-3 mr-1" /> : null}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModalExcluir aberto={excluirId !== null} onClose={() => setExcluirId(null)} onConfirm={() => excluirId && excluir.mutate({ id: excluirId })} nome={excluirNome} />
    </div>
  );
}

// ─── Aba Auxílio Creche ───────────────────────────────────────────────────────
function AbaAuxilioCreche({ mes, ano, empresa, onDataLoad }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [excluirNome, setExcluirNome] = useState("");
  const FORM_INICIAL_AC = { colaborador: null as { id: number; nome: string; empresa: string } | null, tipo: "incluir" as "incluir" | "excluir", nomeFilho: "", dataNascimentoFilho: "", valor: "", observacao: "" };
  const [form, setForm] = useState(FORM_INICIAL_AC);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.movimentacao.auxCreche.list.useQuery({ empresa: empresa || undefined, mes, ano });
  useEffect(() => {
    if (data && onDataLoad) onDataLoad(data);
  }, [data, onDataLoad]);
  const criar = trpc.movimentacao.auxCreche.create.useMutation({
    onSuccess: () => { utils.movimentacao.auxCreche.list.invalidate(); toast.success("Registro adicionado!"); setModal(false); setForm(FORM_INICIAL_AC); },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.movimentacao.auxCreche.update.useMutation({
    onSuccess: () => { utils.movimentacao.auxCreche.list.invalidate(); toast.success("Registro atualizado!"); setEditandoId(null); setModal(false); setForm(FORM_INICIAL_AC); },
    onError: (e) => toast.error(e.message),
  });
  const excluir = trpc.movimentacao.auxCreche.delete.useMutation({
    onSuccess: () => { utils.movimentacao.auxCreche.list.invalidate(); toast.success("Registro excluído!"); setExcluirId(null); },
    onError: (e) => toast.error(e.message),
  });

  const idadeFilho = calcIdade(form.dataNascimentoFilho);

  const abrirEdicao = (r: any) => {
    setEditandoId(r.id);
    const dtStr = r.dataNascimentoFilho ? (r.dataNascimentoFilho instanceof Date ? `${r.dataNascimentoFilho.getUTCFullYear()}-${String(r.dataNascimentoFilho.getUTCMonth()+1).padStart(2,'0')}-${String(r.dataNascimentoFilho.getUTCDate()).padStart(2,'0')}` : String(r.dataNascimentoFilho).slice(0,10)) : "";
    setForm({ colaborador: { id: r.colaboradorId, nome: r.nomeColaborador ?? "", empresa: r.empresa ?? "" }, tipo: r.tipo, nomeFilho: r.nomeFilho ?? "", dataNascimentoFilho: dtStr, valor: r.valor != null ? String(r.valor) : "", observacao: r.observacao ?? "" });
    setModal(true);
  };

  const handleSalvar = () => {
    if (editandoId) {
      atualizar.mutate({ id: editandoId, tipo: form.tipo, nomeFilho: form.nomeFilho || undefined, dataNascimentoFilho: form.dataNascimentoFilho || undefined, valor: form.valor ? parseFloat(form.valor) : undefined, observacao: form.observacao || undefined });
      return;
    }
    if (!form.colaborador) return toast.error("Selecione um colaborador");
    if (!form.nomeFilho.trim()) return toast.error("Informe o nome do filho");
    criar.mutate({
      colaboradorId: form.colaborador.id, nomeColaborador: form.colaborador.nome,
      empresa: form.colaborador.empresa || empresa, tipo: form.tipo,
      nomeFilho: form.nomeFilho,
      dataNascimentoFilho: form.dataNascimentoFilho || undefined,
      valor: form.valor ? parseFloat(form.valor) : undefined,
      observacao: form.observacao || undefined,
      competenciaMes: mes, competenciaAno: ano,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} registro(s) no período</p>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Registro
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colaborador</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Filho</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Idade</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nasc. Filho</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
              ) : data.map((r, i) => (
                <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.nomeColaborador ?? "—"}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.empresa}</Badge></td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className={r.tipo === "incluir" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-red-100 text-red-700 border-red-200"}>
                      {r.tipo === "incluir" ? "Incluir" : "Excluir"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{r.nomeFilho}</td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">{calcIdade(r.dataNascimentoFilho) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.dataNascimentoFilho)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                    {r.valor != null ? Number(r.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => abrirEdicao(r)} className="text-muted-foreground/40 hover:text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setExcluirId(r.id); setExcluirNome(r.nomeColaborador ?? ""); }} className="text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modal} onOpenChange={v => { setModal(v); if (!v) { setEditandoId(null); setForm(FORM_INICIAL_AC); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Baby className="w-4 h-4 text-primary" /> {editandoId ? "Editar" : "Novo"} — Auxílio Creche</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Colaborador *</label><BuscaColaborador value={form.colaborador} onChange={c => setForm(f => ({ ...f, colaborador: c }))} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incluir">Incluir</SelectItem>
                  <SelectItem value="excluir">Excluir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Nome do Filho *</label><Input value={form.nomeFilho} onChange={e => setForm(f => ({ ...f, nomeFilho: e.target.value }))} placeholder="Nome completo do filho" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de Nascimento</label>
                <Input type="date" value={form.dataNascimentoFilho} onChange={e => setForm(f => ({ ...f, dataNascimentoFilho: e.target.value }))} />
                {idadeFilho !== null && <p className="text-xs text-blue-600 mt-1">{idadeFilho} anos</p>}
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Observação</label><Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => { setModal(false); setEditandoId(null); setForm(FORM_INICIAL_AC); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={criar.isPending || atualizar.isPending}>{(criar.isPending || atualizar.isPending) ? <Spinner className="w-3 h-3 mr-1" /> : null}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModalExcluir aberto={excluirId !== null} onClose={() => setExcluirId(null)} onConfirm={() => excluirId && excluir.mutate({ id: excluirId })} nome={excluirNome} />
    </div>
  );
}

// ─── Aba Bônus por Indicação ──────────────────────────────────────────────────
function AbaBonusIndicacao({ mes, ano, empresa, onDataLoad }: { mes: number; ano: number; empresa: string; onDataLoad?: (data: any[]) => void }) {
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [modalStatus, setModalStatus] = useState<{ id: number; nomeIndicado: string } | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [excluirNome, setExcluirNome] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const FORM_INICIAL_BI = { indicador: null as { id: number; nome: string; empresa: string } | null, nomeIndicado: "", empresa: empresa || "FREIRE", dataAdmissaoIndicado: "", valorBonus: "1000.00", observacao: "" };
  const [form, setForm] = useState(FORM_INICIAL_BI);
  const [formStatus, setFormStatus] = useState({ status: "pago" as "pago" | "cancelado", dataPagamentoEfetivo: "", observacao: "" });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.movimentacao.bonusIndicacao.list.useQuery({
    empresa: empresa || undefined,
    status: filtroStatus === "todos" ? undefined : filtroStatus,
    mes, ano,
  });
  useEffect(() => {
    if (data && onDataLoad) onDataLoad(data);
  }, [data, onDataLoad]);
  const criar = trpc.movimentacao.bonusIndicacao.create.useMutation({
    onSuccess: () => { utils.movimentacao.bonusIndicacao.list.invalidate(); toast.success("Bônus registrado!"); setModal(false); setForm(FORM_INICIAL_BI); },
    onError: (e) => toast.error(e.message),
  });
  const atualizar = trpc.movimentacao.bonusIndicacao.update.useMutation({
    onSuccess: () => { utils.movimentacao.bonusIndicacao.list.invalidate(); toast.success("Registro atualizado!"); setEditandoId(null); setModal(false); setForm(FORM_INICIAL_BI); },
    onError: (e) => toast.error(e.message),
  });
  const atualizarStatus = trpc.movimentacao.bonusIndicacao.updateStatus.useMutation({
    onSuccess: () => { utils.movimentacao.bonusIndicacao.list.invalidate(); toast.success("Status atualizado!"); setModalStatus(null); },
    onError: (e) => toast.error(e.message),
  });
  const excluir = trpc.movimentacao.bonusIndicacao.delete.useMutation({
    onSuccess: () => { utils.movimentacao.bonusIndicacao.list.invalidate(); toast.success("Registro excluído!"); setExcluirId(null); },
    onError: (e) => toast.error(e.message),
  });

  const abrirEdicao = (r: any) => {
    setEditandoId(r.id);
    const dtStr = r.dataAdmissaoIndicado ? (r.dataAdmissaoIndicado instanceof Date ? `${r.dataAdmissaoIndicado.getUTCFullYear()}-${String(r.dataAdmissaoIndicado.getUTCMonth()+1).padStart(2,'0')}-${String(r.dataAdmissaoIndicado.getUTCDate()).padStart(2,'0')}` : String(r.dataAdmissaoIndicado).slice(0,10)) : "";
    setForm({ indicador: { id: r.indicadorId, nome: r.nomeIndicador ?? "", empresa: r.empresa ?? "" }, nomeIndicado: r.nomeIndicado ?? "", empresa: (r.empresa ?? empresa) || "FREIRE", dataAdmissaoIndicado: dtStr, valorBonus: r.valorBonus != null ? String(r.valorBonus) : "1000.00", observacao: r.observacao ?? "" });
    setModal(true);
  };

  const handleSalvar = () => {
    if (editandoId) {
      atualizar.mutate({ id: editandoId, nomeIndicado: form.nomeIndicado || undefined, empresa: form.empresa || undefined, dataAdmissaoIndicado: form.dataAdmissaoIndicado || undefined, valorBonus: parseFloat(form.valorBonus) || undefined, observacao: form.observacao || undefined });
      return;
    }
    if (!form.indicador) return toast.error("Selecione o colaborador que indicou");
    if (!form.nomeIndicado.trim()) return toast.error("Informe o nome do indicado");
    if (!form.dataAdmissaoIndicado) return toast.error("Informe a data de admissão do indicado");
    criar.mutate({
      indicadorId: form.indicador.id, nomeIndicador: form.indicador.nome,
      nomeIndicado: form.nomeIndicado,
      empresa: form.empresa,
      dataAdmissaoIndicado: form.dataAdmissaoIndicado,
      valorBonus: parseFloat(form.valorBonus) || 1000,
      observacao: form.observacao || undefined,
    });
  };

  const statusBadge = (s: string) => {
    if (s === "pago") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><CheckCircle className="w-3 h-3" /> Pago</Badge>;
    if (s === "cancelado") return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> Cancelado</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><Clock className="w-3 h-3" /> Pendente</Badge>;
  };

  const pendentes = data?.filter(r => r.status === "pendente").length ?? 0;
  const totalPago = data?.filter(r => r.status === "pago").reduce((a, r) => a + Number(r.valorBonus ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-3" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{pendentes}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <p className="text-xs text-muted-foreground">Total Pago</p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">{totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <p className="text-xs text-muted-foreground">Total Registros</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{data?.length ?? 0}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Bônus
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indicador</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indicado</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admissão</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pgto. Previsto</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pgto. Efetivo</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(!data || data.length === 0) ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado</td></tr>
              ) : data.map((r, i) => (
                <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground font-medium">{r.nomeIndicador ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.nomeIndicado}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{r.empresa}</Badge></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.dataAdmissaoIndicado)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.dataPagamentoPrevisto)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.dataPagamentoEfetivo ? fmtDate(r.dataPagamentoEfetivo) : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                    {Number(r.valorBonus ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2.5 text-center">{statusBadge(r.status)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => abrirEdicao(r)} className="text-muted-foreground/40 hover:text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      {r.status === "pendente" && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={() => { setModalStatus({ id: r.id, nomeIndicado: r.nomeIndicado }); setFormStatus({ status: "pago", dataPagamentoEfetivo: "", observacao: "" }); }} className="text-white/30 hover:text-blue-400 transition-colors">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Marcar como pago</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <button onClick={() => { setExcluirId(r.id); setExcluirNome(r.nomeIndicado); }} className="text-white/30 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal novo/editar bônus */}
      <Dialog open={modal} onOpenChange={v => { setModal(v); if (!v) { setEditandoId(null); setForm(FORM_INICIAL_BI); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> {editandoId ? "Editar" : "Novo"} Bônus por Indicação</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Quem indicou (colaborador) *</label><BuscaColaborador value={form.indicador} onChange={c => setForm(f => ({ ...f, indicador: c, empresa: c?.empresa || f.empresa }))} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Nome do indicado (novo colaborador) *</label><Input value={form.nomeIndicado} onChange={e => setForm(f => ({ ...f, nomeIndicado: e.target.value }))} placeholder="Nome completo do novo colaborador" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground mb-1 block">Empresa *</label>
                <Select value={form.empresa} onValueChange={v => setForm(f => ({ ...f, empresa: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Data de Admissão *</label><Input type="date" value={form.dataAdmissaoIndicado} onChange={e => setForm(f => ({ ...f, dataAdmissaoIndicado: e.target.value }))} /></div>
            </div>
            {form.dataAdmissaoIndicado && (
              <div className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Pagamento previsto: {(() => { const [y, m, d] = form.dataAdmissaoIndicado.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1 + 3, d)); return dt.toLocaleDateString("pt-BR"); })()}  (3 meses após admissão)
              </div>
            )}
            <div><label className="text-xs text-muted-foreground mb-1 block">Valor do Bônus (R$)</label><Input type="number" step="0.01" value={form.valorBonus} onChange={e => setForm(f => ({ ...f, valorBonus: e.target.value }))} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Observação</label><Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => { setModal(false); setEditandoId(null); setForm(FORM_INICIAL_BI); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSalvar} disabled={criar.isPending || atualizar.isPending}>{(criar.isPending || atualizar.isPending) ? <Spinner className="w-3 h-3 mr-1" /> : null}{editandoId ? "Salvar" : "Registrar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal atualizar status */}
      <Dialog open={modalStatus !== null} onOpenChange={() => setModalStatus(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Atualizar Status — {modalStatus?.nomeIndicado}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><label className="text-xs text-muted-foreground mb-1 block">Novo Status</label>
              <Select value={formStatus.status} onValueChange={v => setFormStatus(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formStatus.status === "pago" && (
              <div><label className="text-xs text-muted-foreground mb-1 block">Data do Pagamento</label><Input type="date" value={formStatus.dataPagamentoEfetivo} onChange={e => setFormStatus(f => ({ ...f, dataPagamentoEfetivo: e.target.value }))} /></div>
            )}
            <div><label className="text-xs text-muted-foreground mb-1 block">Observação</label><Input value={formStatus.observacao} onChange={e => setFormStatus(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setModalStatus(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => modalStatus && atualizarStatus.mutate({ id: modalStatus.id, ...formStatus })} disabled={atualizarStatus.isPending}>{atualizarStatus.isPending ? <Spinner className="w-3 h-3 mr-1" /> : null}Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModalExcluir aberto={excluirId !== null} onClose={() => setExcluirId(null)} onConfirm={() => excluirId && excluir.mutate({ id: excluirId })} nome={excluirNome} />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
// ─── Helpers de exportação ────────────────────────────────────────────────────
function buildSheetSeguroVida(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Data": fmtDate(r.data), "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetAuxNotebook(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Data Início": fmtDate(r.dataInicio), "Valor (R$)": r.valor != null ? Number(r.valor).toFixed(2) : "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetPlanoSaude(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Plano": r.tipoPlano ?? "", "Categoria": r.categoria ?? "", "Dt. Nascimento": fmtDate(r.dataNascimento), "Valor (R$)": r.valor != null ? Number(r.valor).toFixed(2) : "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetValeTransporte(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetAuxCreche(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Nome do Filho": r.nomeFilho ?? "", "Dt. Nasc. Filho": fmtDate(r.dataNascimentoFilho), "Valor (R$)": r.valor != null ? Number(r.valor).toFixed(2) : "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetBonus(rows: any[]) {
  return rows.map(r => ({ "Indicador": r.nomeIndicador ?? "", "Indicado": r.nomeIndicado ?? "", "Empresa": r.empresa ?? "", "Admissão Indicado": fmtDate(r.dataAdmissaoIndicado), "Pgto. Previsto": fmtDate(r.dataPagamentoPrevisto), "Pgto. Efetivo": fmtDate(r.dataPagamentoEfetivo), "Valor Bônus (R$)": r.valorBonus != null ? Number(r.valorBonus).toFixed(2) : "", "Status": r.status ?? "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}

function appendXlsxSheet(wb: XLSX.WorkBook, rows: Record<string, string>[], sheetName: string) {
  if (rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["Nenhum registro neste mês"]]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
}

function buildPdfHtml(titulo: string, competencia: string, empresa: string, secoes: { nome: string; headers: string[]; rows: string[][] }[]) {
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bahia" });
  const empresaLabel = empresa ? ` — ${empresa}` : "";
  const secoesHtml = secoes.map(s => {
    if (s.rows.length === 0) return `<div class="section"><h2>${s.nome}</h2><p class="empty">Nenhum registro neste mês.</p></div>`;
    const thead = s.headers.map(h => `<th>${h}</th>`).join("");
    const tbody = s.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
    return `<div class="section"><h2>${s.nome} <span class="count">${s.rows.length} registro${s.rows.length !== 1 ? "s" : ""}</span></h2><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
  }).join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:9px;color:#1e293b}.header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0f172a 100%);color:white;padding:14px 18px;border-radius:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:15px;font-weight:800}.header .meta{font-size:8px;opacity:.7;margin-top:3px}.section{margin-bottom:18px;page-break-inside:avoid}.section h2{font-size:11px;font-weight:700;color:#1e3a5f;border-left:3px solid #3b82f6;padding-left:8px;margin-bottom:6px}.section h2 .count{font-size:8px;font-weight:400;color:#64748b;margin-left:6px}.empty{font-size:9px;color:#94a3b8;padding:6px 0}table{width:100%;border-collapse:collapse;margin-bottom:4px}thead tr{background:#1e293b;color:white}thead th{padding:5px 7px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:5px 7px;border-bottom:1px solid #e2e8f0;font-size:8.5px}tbody td:first-child{font-weight:600}.footer{margin-top:12px;font-size:7.5px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px}</style></head><body>
<div class="header"><div><h1>${titulo}${empresaLabel}</h1><div class="meta">Competência: ${competencia} · Gerado em ${now}</div></div></div>
${secoesHtml}
<div class="footer">Gestão de RH — Sistema de Recursos Humanos · Salvador/BA · Documento gerado automaticamente</div>
</body></html>`;
}

export default function MovimentacaoMes() {
  const hoje = new Date();
  // Mês de referência = mês atual
  const mesRef = hoje.getMonth() + 1; // getMonth() retorna 0-11, precisamos 1-12
  const anoRef = hoje.getFullYear();
  const [mes, setMes] = useState(mesRef);
  const [ano, setAno] = useState(anoRef);
  const [empresa, setEmpresa] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<TipoMovimentacao>("seguroVida");

  const anosDisponiveis = useMemo(() => {
    const a = [];
    for (let y = 2024; y <= hoje.getFullYear() + 1; y++) a.push(y);
    return a;
  }, []);

  const competencia = `${MESES[mes - 1]} / ${ano}`;
  const nomeArquivo = `Movimentacao-${MESES[mes - 1].toUpperCase()}-${ano}${empresa ? "-" + empresa : ""}`;

  // Dados da aba atual (passados pelas abas via callback)
  const [dadosAbaAtual, setDadosAbaAtual] = useState<any[]>([]);

  // Query lazy para exportar todas as abas de uma vez
  const exportAllQuery = trpc.movimentacao.exportAll.useQuery(
    { empresa: empresa || undefined, mes, ano },
    { enabled: false }
  );

  const exportarExcelAbaAtual = () => {
    const wb = XLSX.utils.book_new();
    const abaInfo = ABAS.find(a => a.id === abaAtiva);
    const sheetName = abaInfo?.label ?? abaAtiva;
    let rows: Record<string, string>[] = [];
    if (abaAtiva === "seguroVida") rows = buildSheetSeguroVida(dadosAbaAtual);
    else if (abaAtiva === "auxNotebook") rows = buildSheetAuxNotebook(dadosAbaAtual);
    else if (abaAtiva === "planoSaude") rows = buildSheetPlanoSaude(dadosAbaAtual);
    else if (abaAtiva === "valeTransporte") rows = buildSheetValeTransporte(dadosAbaAtual);
    else if (abaAtiva === "auxCreche") rows = buildSheetAuxCreche(dadosAbaAtual);
    else if (abaAtiva === "bonusIndicacao") rows = buildSheetBonus(dadosAbaAtual);
    appendXlsxSheet(wb, rows, sheetName);
    XLSX.writeFile(wb, `${nomeArquivo}-${sheetName}.xlsx`);
    toast.success("Excel exportado!");
  };

  const exportarExcelTodas = async () => {
    const result = await exportAllQuery.refetch();
    if (!result.data) { toast.error("Erro ao buscar dados"); return; }
    const d = result.data;
    const wb = XLSX.utils.book_new();
    appendXlsxSheet(wb, buildSheetSeguroVida(d.seguroVida), "Seguro de Vida");
    appendXlsxSheet(wb, buildSheetAuxNotebook(d.auxNotebook), "Auxílio Notebook");
    appendXlsxSheet(wb, buildSheetPlanoSaude(d.planoSaude), "Plano de Saúde");
    appendXlsxSheet(wb, buildSheetValeTransporte(d.valeTransporte), "Vale Transporte");
    appendXlsxSheet(wb, buildSheetAuxCreche(d.auxCreche), "Auxílio Creche");
    appendXlsxSheet(wb, buildSheetBonus(d.bonusIndicacao), "Bônus por Indicação");
    XLSX.writeFile(wb, `${nomeArquivo}-COMPLETO.xlsx`);
    toast.success("Excel completo exportado!");
  };

  const exportarPdfAbaAtual = () => {
    const abaInfo = ABAS.find(a => a.id === abaAtiva);
    const titulo = `Movimentação do Mês — ${abaInfo?.label ?? abaAtiva}`;
    let secao: { nome: string; headers: string[]; rows: string[][] };
    const rows = dadosAbaAtual;
    if (abaAtiva === "seguroVida") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Data", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.data), r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "auxNotebook") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Data Início", "Valor (R$)", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.dataInicio), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "planoSaude") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Plano", "Categoria", "Valor (R$)", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.tipoPlano ?? "", r.categoria ?? "", r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "valeTransporte") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "auxCreche") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Nome do Filho", "Dt. Nasc. Filho", "Valor (R$)", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.nomeFilho ?? "", fmtDate(r.dataNascimentoFilho), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) };
    else secao = { nome: abaInfo!.label, headers: ["Indicador", "Indicado", "Empresa", "Admissão", "Pgto. Previsto", "Valor (R$)", "Status", "Registrado por"], rows: rows.map((r: any) => [r.nomeIndicador ?? "", r.nomeIndicado ?? "", r.empresa ?? "", fmtDate(r.dataAdmissaoIndicado), fmtDate(r.dataPagamentoPrevisto), r.valorBonus != null ? `R$ ${Number(r.valorBonus).toFixed(2)}` : "", r.status ?? "", r.createdByNome ?? ""]) };
    const html = buildPdfHtml(titulo, competencia, empresa, [secao]);
    const win = window.open("", "_blank");
    if (!win) { toast.error("Bloqueio de pop-up detectado. Permita pop-ups para este site."); return; }
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
    toast.success("PDF pronto para impressão!");
  };

  const exportarPdfTodas = async () => {
    const result = await exportAllQuery.refetch();
    if (!result.data) { toast.error("Erro ao buscar dados"); return; }
    const d = result.data;
    const secoes = [
      { nome: "Seguro de Vida", headers: ["Colaborador", "Empresa", "Tipo", "Data", "Observação", "Registrado por"], rows: d.seguroVida.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.data), r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Auxílio Notebook", headers: ["Colaborador", "Empresa", "Tipo", "Data Início", "Valor (R$)", "Observação", "Registrado por"], rows: d.auxNotebook.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.dataInicio), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Plano de Saúde", headers: ["Colaborador", "Empresa", "Tipo", "Plano", "Categoria", "Valor (R$)", "Observação", "Registrado por"], rows: d.planoSaude.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.tipoPlano ?? "", r.categoria ?? "", r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Vale Transporte", headers: ["Colaborador", "Empresa", "Tipo", "Observação", "Registrado por"], rows: d.valeTransporte.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Auxílio Creche", headers: ["Colaborador", "Empresa", "Tipo", "Nome do Filho", "Dt. Nasc. Filho", "Valor (R$)", "Observação", "Registrado por"], rows: d.auxCreche.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.nomeFilho ?? "", fmtDate(r.dataNascimentoFilho), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Bônus por Indicação", headers: ["Indicador", "Indicado", "Empresa", "Admissão", "Pgto. Previsto", "Valor (R$)", "Status", "Registrado por"], rows: d.bonusIndicacao.map((r: any) => [r.nomeIndicador ?? "", r.nomeIndicado ?? "", r.empresa ?? "", fmtDate(r.dataAdmissaoIndicado), fmtDate(r.dataPagamentoPrevisto), r.valorBonus != null ? `R$ ${Number(r.valorBonus).toFixed(2)}` : "", r.status ?? "", r.createdByNome ?? ""]) },
    ];
    const html = buildPdfHtml("Movimentação do Mês — Completo", competencia, empresa, secoes);
    const win = window.open("", "_blank");
    if (!win) { toast.error("Bloqueio de pop-up detectado. Permita pop-ups para este site."); return; }
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
    toast.success("PDF completo pronto para impressão!");
  };

  return (
    <div className="flex flex-col">
      {/* Hero Header escuro */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.13 0.02 245) 0%, oklch(0.17 0.025 250) 60%, oklch(0.14 0.03 260) 100%)",
          borderBottom: "1px solid oklch(0.25 0.02 245 / 0.6)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 80% at 80% 50%, oklch(0.35 0.08 260 / 0.08) 0%, transparent 70%)" }} />
        <div className="relative px-6 pt-6 pb-0">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.55 0.18 260 / 0.25)", border: "1px solid oklch(0.55 0.18 260 / 0.4)" }}>
                  <Building2 className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.15 260)" }} />
                </div>
                <h1 className="text-xl font-bold" style={{ color: "oklch(0.96 0.005 245)" }}>Movimentação do Mês</h1>
              </div>
              <p className="text-xs" style={{ color: "oklch(0.60 0.01 245)" }}>Registre inclusões e exclusões de benefícios por competência</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger className="w-32 h-8 text-sm" style={{ background: "oklch(0.20 0.015 245 / 0.8)", border: "1px solid oklch(0.30 0.02 245 / 0.6)", color: "oklch(0.92 0.005 245)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
                <SelectTrigger className="w-24 h-8 text-sm" style={{ background: "oklch(0.20 0.015 245 / 0.8)", border: "1px solid oklch(0.30 0.02 245 / 0.6)", color: "oklch(0.92 0.005 245)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={empresa || "todas"} onValueChange={v => setEmpresa(v === "todas" ? "" : v)}>
                <SelectTrigger className="w-52 h-8 text-sm" style={{ background: "oklch(0.20 0.015 245 / 0.8)", border: "1px solid oklch(0.30 0.02 245 / 0.6)", color: "oklch(0.92 0.005 245)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                  {EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Botão Exportar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 gap-1.5 text-sm" style={{ background: "oklch(0.55 0.18 260 / 0.25)", border: "1px solid oklch(0.55 0.18 260 / 0.4)", color: "oklch(0.90 0.05 260)" }}>
                    <Download className="w-3.5 h-3.5" /> Exportar <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Aba atual: {ABAS.find(a => a.id === abaAtiva)?.label}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={exportarExcelAbaAtual} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel — aba atual
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportarPdfAbaAtual} className="gap-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-red-600" /> PDF — aba atual
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Todas as 6 abas</DropdownMenuLabel>
                  <DropdownMenuItem onClick={exportarExcelTodas} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel — completo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportarPdfTodas} className="gap-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-red-600" /> PDF — completo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Sub-abas */}
          <div className="flex gap-0.5 overflow-x-auto">
            {ABAS.map(aba => (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all"
                style={abaAtiva === aba.id ? {
                  color: "oklch(0.96 0.005 245)",
                  borderBottom: "2px solid oklch(0.65 0.18 260)",
                  background: "oklch(0.22 0.02 245 / 0.5)",
                  borderRadius: "6px 6px 0 0",
                } : {
                  color: "oklch(0.55 0.01 245)",
                  borderBottom: "2px solid transparent",
                  borderRadius: "6px 6px 0 0",
                }}
              >
                {aba.icon}
                {aba.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="px-6 py-6">
        {abaAtiva === "seguroVida" && <AbaSeguroVida mes={mes} ano={ano} empresa={empresa} onDataLoad={setDadosAbaAtual} />}
        {abaAtiva === "auxNotebook" && <AbaAuxilioNotebook mes={mes} ano={ano} empresa={empresa} onDataLoad={setDadosAbaAtual} />}
        {abaAtiva === "planoSaude" && <AbaPlanoSaude mes={mes} ano={ano} empresa={empresa} onDataLoad={setDadosAbaAtual} />}
        {abaAtiva === "valeTransporte" && <AbaValeTransporte mes={mes} ano={ano} empresa={empresa} onDataLoad={setDadosAbaAtual} />}
        {abaAtiva === "auxCreche" && <AbaAuxilioCreche mes={mes} ano={ano} empresa={empresa} onDataLoad={setDadosAbaAtual} />}
        {abaAtiva === "bonusIndicacao" && <AbaBonusIndicacao mes={mes} ano={ano} empresa={empresa} onDataLoad={setDadosAbaAtual} />}
      </div>
    </div>
  );
}
