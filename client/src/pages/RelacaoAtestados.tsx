import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Stethoscope, CalendarDays, Clock, Leaf } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";
import { toast } from "sonner";

// ─── Helpers de data UTC-safe ────────────────────────────────────────────────

function toDateStr(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).split("T")[0] || null;
}

function formatDateBR(val: Date | string | null | undefined): string {
  const iso = toDateStr(val);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

function isoToInput(val: Date | string | null | undefined): string {
  return toDateStr(val) ?? "";
}

function calcDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const [iy, im, id] = inicio.split("-").map(Number);
  const [fy, fm, fd] = fim.split("-").map(Number);
  const ms1 = Date.UTC(iy, im - 1, id);
  const ms2 = Date.UTC(fy, fm - 1, fd);
  return Math.max(1, Math.floor((ms2 - ms1) / 86400000) + 1);
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TIPOS: Record<string, { label: string; color: string }> = {
  medico: { label: "Médico", color: "bg-blue-100 text-blue-800 border-blue-200" },
  odontologico: { label: "Odontológico", color: "bg-purple-100 text-purple-800 border-purple-200" },
  acompanhante: { label: "Acompanhante", color: "bg-blue-100 text-blue-800 border-blue-200" },
  outros: { label: "Outros", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

// ─── Busca de colaborador por digitação ──────────────────────────────────────

function ColaboradorSearch({
  value,
  onChange,
}: {
  value: { id: number; nome: string; empresaId?: number | null; setorId?: number | null } | null;
  onChange: (c: { id: number; nome: string; empresaId?: number | null; setorId?: number | null } | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = trpc.colaboradores.list.useQuery(
    { busca: query, status: "ativo", pageSize: 20 },
    { enabled: query.length >= 2 }
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
        <span className="flex-1 text-sm font-medium">{value.nome}</span>
        <button
          type="button"
          onClick={() => { onChange(null); setQuery(""); }}
          className="text-muted-foreground hover:text-foreground text-xs px-1"
        >✕</button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Digite o nome do colaborador..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="pl-8"
        />
      </div>
      {open && data?.data && data.data.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {data.data.map((c: any) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => {
                onChange({ id: c.id, nome: c.nome, empresaId: c.empresaId, setorId: c.setorId });
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="font-medium">{c.nome}</span>
              {c.empresaNome && <span className="text-muted-foreground ml-2 text-xs">{c.empresaNome} · {c.setorNome ?? ""}</span>}
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && (!data?.data || data.data.length === 0) && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-sm px-3 py-2 text-sm text-muted-foreground">
          Nenhum colaborador encontrado.
        </div>
      )}
    </div>
  );
}

// ─── Formulário de atestado ───────────────────────────────────────────────────

type AtestadoForm = {
  colaborador: { id: number; nome: string; empresaId?: number | null; setorId?: number | null } | null;
  dataInicio: string;
  dataFim: string;
  diasAfastamento: string;
  diasDescontar: string;
  tipoAfastamento: string;
  tipo: string;
  observacao: string;
};
const emptyForm: AtestadoForm = {
  colaborador: null,
  dataInicio: "",
  dataFim: "",
  diasAfastamento: "",
  diasDescontar: "",
  tipoAfastamento: "integral",
  tipo: "medico",
  observacao: "",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RelacaoAtestados() {
  const utils = trpc.useUtils();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todos");
  const [setorFiltro, setSetorFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<AtestadoForm>(emptyForm);
  const { sort: sortAtest, toggle: toggleSortAtest, sortData: sortAtestData } = useTableSort<"colaboradorNome" | "empresaNome" | "setorNome" | "dataInicio" | "dataFim" | "diasAfastamento" | "tipo">("dataInicio", "desc");

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery(
    empresaFiltro !== "todos" ? { empresaId: Number(empresaFiltro) } : undefined
  );

  const { data, isLoading } = trpc.atestados.list.useQuery({
    mes,
    ano,
    empresaId: empresaFiltro !== "todos" ? Number(empresaFiltro) : undefined,
    setorId: setorFiltro !== "todos" ? Number(setorFiltro) : undefined,
    pageSize: 200,
  });

  const anos = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => cur - 4 + i);
  }, []);

  // Filtra por busca local
  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const base = !busca.trim() ? data.data : data.data.filter((r: any) =>
      r.colaboradorNome?.toLowerCase().includes(busca.toLowerCase()) ||
      r.observacao?.toLowerCase().includes(busca.toLowerCase())
    );
    return sortAtestData(base);
  }, [data?.data, busca, sortAtest]);

  // Totais do mês
  const totalAtestados = filtered.length;
  const totalDias = filtered.reduce((s: number, r: any) => s + (r.diasAfastamento ?? 0), 0);

  // ─── Relação Caju: agrupa por colaborador ────────────────────────────────
  const cajuData = useMemo(() => {
    if (!data?.data) return [];
    // Agrupa todos os atestados do mês por colaborador (sem filtro de busca)
    const map = new Map<number, {
      colaboradorId: number;
      colaboradorNome: string;
      empresaNome: string;
      setorNome: string;
      totalDias: number;
      atestados: number;
      detalhes: { dataInicio: any; dataFim: any; dias: number; diasAfastamento: number; tipo: string }[];
    }>();

    for (const r of data.data) {
      const id = r.colaboradorId;
      if (!map.has(id)) {
        map.set(id, {
          colaboradorId: id,
          colaboradorNome: r.colaboradorNome ?? "—",
          empresaNome: r.empresaNome ?? "—",
          setorNome: r.setorNome ?? "—",
          totalDias: 0,
          atestados: 0,
          detalhes: [],
        });
      }
      const entry = map.get(id)!;
      // Usa diasDescontar quando preenchido (ex: observação indica menos dias a descontar)
      const diasEfetivos = (r.diasDescontar != null ? r.diasDescontar : r.diasAfastamento) ?? 0;
      entry.totalDias += diasEfetivos;
      entry.atestados++;
      entry.detalhes.push({
        dataInicio: r.dataInicio,
        dataFim: r.dataFim,
        dias: diasEfetivos,
        diasAfastamento: r.diasAfastamento ?? 0,
        tipo: r.tipo ?? "medico",
      });
    }

    // Ordena por empresa e depois por nome
    return Array.from(map.values()).sort((a, b) => {
      const emp = a.empresaNome.localeCompare(b.empresaNome);
      if (emp !== 0) return emp;
      return a.colaboradorNome.localeCompare(b.colaboradorNome);
    });
  }, [data?.data]);

  const cajuTotalDias = cajuData.reduce((s, r) => s + r.totalDias, 0);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const invalidate = () => {
    utils.atestados.list.invalidate();
    utils.atestados.resumoMensal.invalidate();
  };

  const createMutation = trpc.atestados.create.useMutation({
    onSuccess: () => { toast.success("Atestado registrado!"); invalidate(); fecharModal(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.atestados.update.useMutation({
    onSuccess: () => { toast.success("Atestado atualizado!"); invalidate(); fecharModal(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.atestados.delete.useMutation({
    onSuccess: () => { toast.success("Atestado removido!"); invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });

  // ─── Modal ────────────────────────────────────────────────────────────────

  function abrirNovo() {
    setEditId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function abrirEditar(r: any) {
    setEditId(r.id);
    setForm({
      colaborador: { id: r.colaboradorId, nome: r.colaboradorNome ?? "", empresaId: r.empresaId, setorId: r.setorId },
      dataInicio: isoToInput(r.dataInicio),
      dataFim: isoToInput(r.dataFim),
      diasAfastamento: String(r.diasAfastamento ?? ""),
      diasDescontar: r.diasDescontar != null ? String(r.diasDescontar) : "",
      tipoAfastamento: r.tipoAfastamento ?? "integral",
      tipo: r.tipo ?? "medico",
      observacao: r.observacao ?? "",
    });
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
  }

  function handleDataChange(campo: "dataInicio" | "dataFim", valor: string) {
    setForm(prev => {
      const novo = { ...prev, [campo]: valor };
      const ini = campo === "dataInicio" ? valor : prev.dataInicio;
      const fim = campo === "dataFim" ? valor : prev.dataFim;
      if (ini && fim && fim >= ini) {
        novo.diasAfastamento = String(calcDias(ini, fim));
      }
      return novo;
    });
  }

  function salvar() {
    if (!form.colaborador) { toast.error("Selecione o colaborador."); return; }
    if (!form.dataInicio) { toast.error("Informe a data de início."); return; }
    if (!form.dataFim) { toast.error("Informe a data de fim."); return; }
    if (form.dataFim < form.dataInicio) { toast.error("A data de fim não pode ser anterior ao início."); return; }
    const dias = Number(form.diasAfastamento);
    if (!dias || dias < 1) { toast.error("Informe a quantidade de dias."); return; }

    const payload = {
      colaboradorId: form.colaborador.id,
      empresaId: form.colaborador.empresaId ?? null,
      setorId: form.colaborador.setorId ?? null,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      diasAfastamento: dias,
      diasDescontar: form.diasDescontar !== "" ? Number(form.diasDescontar) : null,
      tipoAfastamento: form.tipoAfastamento as any,
      tipo: form.tipo as any,
      cid: null,
      medico: null,
      observacao: form.observacao || null,
    };

    if (editId) {
      updateMutation.mutate({ id: editId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.22 0.08 250 / 0.18)"
      }}>
        <div className="px-7 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Relação de Atestados</h1>
              <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Registro mensal de atestados médicos e afastamentos</p>
            </div>
          </div>
          <Button onClick={abrirNovo} className="gap-2 shrink-0 font-semibold"
            style={{ background: "oklch(0.48 0.20 252)", color: "oklch(0.13 0.07 254)", border: "none" }}>
            <Plus className="w-4 h-4" /> Novo Atestado
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Empresa</Label>
          <Select value={empresaFiltro} onValueChange={v => { setEmpresaFiltro(v); setSetorFiltro("todos"); }}>
            <SelectTrigger className="w-52 h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {empresas?.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Setor</Label>
          <Select value={setorFiltro} onValueChange={setSetorFiltro} disabled={empresaFiltro === "todos"}>
            <SelectTrigger className="w-52 h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {setores?.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Nome ou observação..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Stethoscope, label: "Total de Atestados", value: totalAtestados, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
          { icon: Clock, label: "Dias de Afastamento", value: totalDias, color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
          { icon: CalendarDays, label: `${MESES[mes - 1]}/${ano}`, value: "Ref.", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
          { icon: Leaf, label: "Colaboradores c/ Atestado", value: cajuData.length, color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
        ].map((item, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
            </div>
            <p className="text-3xl font-black text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Sub-abas: Atestados | Relação Caju */}
      <Tabs defaultValue="atestados">
        <TabsList className="mb-4 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="atestados" className="gap-2 rounded-lg font-semibold">
            <Stethoscope className="w-4 h-4" /> Atestados
          </TabsTrigger>
          <TabsTrigger value="caju" className="gap-2 rounded-lg font-semibold">
            <Leaf className="w-4 h-4" /> Relação Caju
          </TabsTrigger>
        </TabsList>

        {/* Aba: Atestados */}
        <TabsContent value="atestados">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                    <SortableHeader col="colaboradorNome" label="Colaborador" sort={sortAtest} onToggle={toggleSortAtest} />
                    <SortableHeader col="empresaNome" label="Empresa" sort={sortAtest} onToggle={toggleSortAtest} />
                    <SortableHeader col="setorNome" label="Setor" sort={sortAtest} onToggle={toggleSortAtest} />
                    <SortableHeader col="dataInicio" label="Início" sort={sortAtest} onToggle={toggleSortAtest} />
                    <SortableHeader col="dataFim" label="Fim" sort={sortAtest} onToggle={toggleSortAtest} />
                    <SortableHeader col="diasAfastamento" label="Dias" sort={sortAtest} onToggle={toggleSortAtest} align="center" />
                    <SortableHeader col="tipo" label="Tipo" sort={sortAtest} onToggle={toggleSortAtest} />
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Observações</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Registrado por</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <Stethoscope className="w-7 h-7 opacity-30" />
                          </div>
                          <p className="text-sm font-bold text-foreground">Nenhum atestado em {MESES[mes - 1]}/{ano}</p>
                          <Button variant="outline" size="sm" onClick={abrirNovo} className="mt-1 gap-1">
                            <Plus className="w-4 h-4" /> Registrar atestado
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r: any, idx: number) => {

                      const tipoInfo = TIPOS[r.tipo ?? "medico"] ?? TIPOS.medico;
                      return (
                        <tr key={r.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                                {(r.colaboradorNome ?? "?")[0].toUpperCase()}
                              </div>
                              <NomeColaborador nome={r.colaboradorNome ?? "—"} className="font-semibold text-sm" maxChars={26} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{r.empresaNome ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">{r.setorNome ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-sm">{formatDateBR(r.dataInicio)}</td>
                          <td className="px-4 py-3 font-medium text-sm">{formatDateBR(r.dataFim)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 text-orange-700 font-bold text-sm border border-orange-100">
                                {r.diasAfastamento}
                              </span>
                              {r.diasDescontar != null && r.diasDescontar !== r.diasAfastamento && (
                                <span className="text-[10px] text-blue-600 font-semibold" title="Dias a descontar na planilha VR/VT">
                                  ↓{r.diasDescontar}d desc.
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline" className={`text-xs ${tipoInfo.color}`}>
                                {tipoInfo.label}
                              </Badge>
                              {r.tipoAfastamento === "comparecimento" ? (
                                <span className="text-[10px] text-blue-600 font-medium">Comparecimento</span>
                              ) : (
                                <span className="text-[10px] text-blue-600 font-medium">Integral</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px]">
                            {r.observacao ? (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate cursor-help underline decoration-dotted underline-offset-2">{r.observacao}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[320px] whitespace-pre-wrap break-words text-xs leading-relaxed">
                                    {r.observacao}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{r.createdByNome || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600" onClick={() => abrirEditar(r)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteId(r.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t bg-muted/10 text-xs text-muted-foreground flex items-center gap-2">
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">{filtered.length}</span>
                atestado{filtered.length !== 1 ? "s" : ""}
                <span className="mx-1 text-border">·</span>
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 font-bold border border-orange-100">{totalDias}</span>
                dia{totalDias !== 1 ? "s" : ""} de afastamento
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── Aba: Relação Caju ──────────────────────────────────────────── */}
        <TabsContent value="caju">
          <div className="bg-card border rounded-xl overflow-hidden">
            {/* Cabeçalho da relação Caju */}
            <div className="px-5 py-4 border-b bg-blue-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Relação Caju — {MESES[mes - 1]}/{ano}</p>
                  <p className="text-xs text-blue-700">Colaboradores com dias de afastamento a descontar no benefício Caju</p>
                </div>
              </div>
              {cajuData.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-blue-700">Total de dias a descontar</p>
                  <p className="text-2xl font-bold text-emerald-800">{cajuTotalDias}</p>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Colaborador</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Setor</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Atestados no Mês</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Períodos</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-blue-700">Dias a Descontar</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</td></tr>
                  ) : cajuData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Leaf className="w-10 h-10 opacity-30" />
                          <p className="text-sm">Nenhum atestado registrado em {MESES[mes - 1]}/{ano}</p>
                          <p className="text-xs">Não há dias a descontar no Caju neste mês.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cajuData.map((r, idx) => (
                      <tr key={r.colaboradorId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium">{r.colaboradorNome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.empresaNome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.setorNome}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                            {r.atestados}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {r.detalhes.map((d, i) => {
                              const tipoInfo = TIPOS[d.tipo] ?? TIPOS.medico;
                              return (
                                <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${tipoInfo.color}`}>
                                  {formatDateBR(d.dataInicio)}{d.dataFim !== d.dataInicio ? ` – ${formatDateBR(d.dataFim)}` : ""}
                                  {d.dias !== d.diasAfastamento
                                    ? <span title={`Afastamento: ${d.diasAfastamento}d | Descontar: ${d.dias}d`}> ({d.dias}d↓/{d.diasAfastamento}d)</span>
                                    : <span> ({d.dias}d)</span>
                                  }
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 rounded-full bg-blue-100 text-emerald-800 font-bold text-sm border border-blue-200">
                            {r.totalDias}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com total */}
            {cajuData.length > 0 && (
              <div className="px-4 py-3 border-t bg-blue-50 flex items-center justify-between">
                <p className="text-sm text-emerald-800">
                  <span className="font-semibold">{cajuData.length}</span> colaborador{cajuData.length !== 1 ? "es" : ""} com afastamento em {MESES[mes - 1]}/{ano}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-blue-700">Total de dias a descontar no Caju:</p>
                  <span className="px-3 py-1 rounded-full bg-blue-700 text-white font-bold text-sm">
                    {cajuTotalDias} dia{cajuTotalDias !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de novo/editar atestado */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) fecharModal(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Atestado" : "Novo Atestado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Colaborador <span className="text-red-500">*</span></Label>
              <ColaboradorSearch
                value={form.colaborador}
                onChange={c => setForm(prev => ({ ...prev, colaborador: c }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Atestado</Label>
              <Select value={form.tipo} onValueChange={v => setForm(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="odontologico">Odontológico</SelectItem>
                  <SelectItem value="acompanhante">Acompanhante</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold">Tipo de Afastamento <span className="text-red-500">*</span></Label>
              <Select value={form.tipoAfastamento} onValueChange={v => setForm(prev => ({ ...prev, tipoAfastamento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="integral">Afastamento integral — dia(s) inteiro(s) fora</SelectItem>
                  <SelectItem value="comparecimento">Comparecimento — foi por algumas horas e voltou</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-xs mt-1 ${form.tipoAfastamento === "integral" ? "text-blue-600" : "text-blue-600"}`}>
                {form.tipoAfastamento === "integral"
                  ? "⚠️ Será descontado no VR (e VT se houver) na Planilha de Benefícios."
                  : "✅ Não desconta VR/VT — colaborador foi por algumas horas e retornou ao trabalho."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de Início <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.dataInicio} onChange={e => handleDataChange("dataInicio", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Fim <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.dataFim} min={form.dataInicio || undefined} onChange={e => handleDataChange("dataFim", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Dias de Afastamento <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                value={form.diasAfastamento}
                onChange={e => setForm(prev => ({ ...prev, diasAfastamento: e.target.value }))}
                placeholder="Calculado automaticamente"
              />
              {form.dataInicio && form.dataFim && form.dataFim >= form.dataInicio && (
                <p className="text-xs text-muted-foreground">
                  Calculado: {calcDias(form.dataInicio, form.dataFim)} dia(s) (de {formatDateBR(form.dataInicio)} a {formatDateBR(form.dataFim)})
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Dias a Descontar na Planilha VR/VT</Label>
              <Input
                type="number"
                min={0}
                value={form.diasDescontar}
                onChange={e => setForm(prev => ({ ...prev, diasDescontar: e.target.value }))}
                placeholder={form.diasAfastamento ? `Padrão: ${form.diasAfastamento} dia(s)` : "Deixe vazio para usar dias de afastamento"}
              />
              <p className="text-xs text-muted-foreground">
                {form.diasDescontar !== "" && Number(form.diasDescontar) !== Number(form.diasAfastamento)
                  ? <span className="text-blue-600 font-medium">Serão descontados {form.diasDescontar} dia(s) (diferente dos {form.diasAfastamento || "?"} dias de afastamento)</span>
                  : "Deixe vazio para descontar o mesmo número de dias de afastamento. Use quando a observação indica um valor diferente."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Observações adicionais..." value={form.observacao} onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))} rows={5} className="resize-y" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal} disabled={isPending}>Cancelar</Button>
            <Button onClick={salvar} disabled={isPending}>
              {isPending ? "Salvando..." : editId ? "Salvar alterações" : "Registrar atestado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atestado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro do atestado será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
