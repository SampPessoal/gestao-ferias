import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Search, Edit2, X, Wallet, Bus, Car, Plus } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";
import { toast } from "sonner";

function fmtMoeda(val: string | null | undefined): string {
  if (!val || val === "0.00" || val === "0") return "Não recebe";
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "Não recebe";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtAuxilio(val: string | null | undefined): string {
  if (!val || val === "0.00" || val === "0") return "—";
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RelacaoBeneficios() {
  const utils = trpc.useUtils();
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [empresaId, setEmpresaId] = useState<number | undefined>();
  const [setorId, setSetorId] = useState<number | undefined>();
  const [filtroCaju, setFiltroCaju] = useState<string>("todos");

  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function handleBusca(v: string) {
    setBusca(v);
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => setBuscaDebounced(v), 300));
  }

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery(empresaId ? { empresaId } : undefined);
  const { data, isLoading } = trpc.beneficios.list.useQuery({
    busca: buscaDebounced || undefined,
    empresaId,
    setorId,
  });

  // Modal de edição
  const { sort: sortBenef, toggle: toggleSortBenef, sortData: sortBenefData } = useTableSort<"nome" | "empresaNome" | "setorNome" | "valorVR" | "valorVT" | "auxilioVeiculo">("nome", "asc");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    valorVR: "",
    valorVT: "",
    auxilioVeiculo: "",
    auxilioVeiculoFolha: "",
    auxilioCelularFolha: "",
    setorBeneficio: "",
    valorFixoQuinzenal: "",
    tipoRecebimentoCaju: "normal" as string,
  });

  const updateMutation = trpc.beneficios.update.useMutation({
    onSuccess: () => {
      toast.success("Benefícios atualizados!");
      utils.beneficios.list.invalidate();
      setEditItem(null);
    },
    onError: () => toast.error("Erro ao atualizar benefícios."),
  });

  function openEdit(item: any) {
    setEditItem(item);
    const toInput = (v: string | null | undefined) => {
      if (!v || v === "0.00") return "";
      const n = parseFloat(v);
      return isNaN(n) ? "" : String(n);
    };
    setEditForm({
      valorVR: toInput(item.valorVR),
      valorVT: toInput(item.valorVT),
      auxilioVeiculo: toInput(item.auxilioVeiculo),
      auxilioVeiculoFolha: toInput(item.auxilioVeiculoFolha),
      auxilioCelularFolha: toInput(item.auxilioCelularFolha),
      setorBeneficio: item.setorBeneficio ?? "",
      valorFixoQuinzenal: toInput(item.valorFixoQuinzenal),
      tipoRecebimentoCaju: (item as any).tipoRecebimentoCaju ?? "normal",
    });
  }

  function saveEdit() {
    if (!editItem) return;
    const toDecimalStr = (v: string) => {
      if (!v.trim()) return null;
      const n = parseFloat(v.replace(",", "."));
      return isNaN(n) ? null : n.toFixed(2);
    };
    updateMutation.mutate({
      id: editItem.id,
      valorVR: toDecimalStr(editForm.valorVR),
      valorVT: toDecimalStr(editForm.valorVT),
      auxilioVeiculo: toDecimalStr(editForm.auxilioVeiculo),
      auxilioVeiculoFolha: toDecimalStr(editForm.auxilioVeiculoFolha),
      auxilioCelularFolha: toDecimalStr(editForm.auxilioCelularFolha),
      setorBeneficio: editForm.setorBeneficio.trim() || null,
      valorFixoQuinzenal: toDecimalStr(editForm.valorFixoQuinzenal),
      tipoRecebimentoCaju: (editForm.tipoRecebimentoCaju === "normal" ? null : editForm.tipoRecebimentoCaju) as any,
    });
  }

  const totalComVR = data?.filter(r => r.valorVR && parseFloat(r.valorVR) > 0).length ?? 0;
  const totalComVT = data?.filter(r => r.valorVT && parseFloat(r.valorVT) > 0).length ?? 0;
  const totalComAuxilio = data?.filter(r => r.auxilioVeiculo && parseFloat(r.auxilioVeiculo) > 0).length ?? 0;

  // Filtragem por tipo Caju/benefício
  const dadosFiltrados = useMemo(() => {
    if (!data) return [];
    if (filtroCaju === "todos") return data;
    return data.filter(row => {
      const tipo = row.tipoRecebimentoCaju;
      const auxVeiculoFolha = (row as any).auxilioVeiculoFolha ? parseFloat((row as any).auxilioVeiculoFolha) : 0;
      const auxCelularFolha = (row as any).auxilioCelularFolha ? parseFloat((row as any).auxilioCelularFolha) : 0;
      if (filtroCaju === "vt_saldo_livre") return tipo === "vt_saldo_livre";
      if (filtroCaju === "vr_saldo_livre") return tipo === "vr_saldo_livre";
      if (filtroCaju === "auxilio_veiculo_caju") return tipo === "auxilio_veiculo";
      if (filtroCaju === "auxilio_veiculo_folha") return auxVeiculoFolha > 0;
      if (filtroCaju === "auxilio_celular_folha") return auxCelularFolha > 0;
      if (filtroCaju === "normal") return !tipo || tipo === "normal";
      return true;
    });
  }, [data, filtroCaju]);

  // Modal de novo benefício
  const [novoModal, setNovoModal] = useState(false);
  const [novoColabBusca, setNovoColabBusca] = useState("");
  const [novoForm, setNovoForm] = useState({ colaboradorId: "", valorVR: "", valorVT: "", auxilioVeiculo: "", auxilioVeiculoFolha: "", auxilioCelularFolha: "", setorBeneficio: "", valorFixoQuinzenal: "", tipoRecebimentoCaju: "normal" });
  const { data: colaboradoresBuscaData } = trpc.colaboradores.list.useQuery(
    { busca: novoColabBusca || undefined, status: "ativo" },
    { enabled: novoColabBusca.length >= 2 }
  );
  const colaboradoresBusca = colaboradoresBuscaData?.data;

  function saveNovo() {
    if (!novoForm.colaboradorId) return;
    const toDecimalStr = (v: string) => {
      if (!v.trim()) return null;
      const n = parseFloat(v.replace(",", "."));
      return isNaN(n) ? null : n.toFixed(2);
    };
    updateMutation.mutate({
      id: Number(novoForm.colaboradorId),
      valorVR: toDecimalStr(novoForm.valorVR),
      valorVT: toDecimalStr(novoForm.valorVT),
      auxilioVeiculo: toDecimalStr(novoForm.auxilioVeiculo),
      auxilioVeiculoFolha: toDecimalStr(novoForm.auxilioVeiculoFolha),
      auxilioCelularFolha: toDecimalStr(novoForm.auxilioCelularFolha),
      setorBeneficio: novoForm.setorBeneficio.trim() || null,
      valorFixoQuinzenal: toDecimalStr(novoForm.valorFixoQuinzenal),
      tipoRecebimentoCaju: (novoForm.tipoRecebimentoCaju === "normal" ? null : novoForm.tipoRecebimentoCaju) as any,
    }, {
      onSuccess: () => {
        toast.success("Benefício cadastrado!");
        utils.beneficios.list.invalidate();
        setNovoModal(false);
        setNovoForm({ colaboradorId: "", valorVR: "", valorVT: "", auxilioVeiculo: "", auxilioVeiculoFolha: "", auxilioCelularFolha: "", setorBeneficio: "", valorFixoQuinzenal: "", tipoRecebimentoCaju: "normal" });
        setNovoColabBusca("");
      },
    });
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)"
      }}>
        <div className="px-7 py-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Relação de Benefícios</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Vale Refeição (VR), Vale Transporte (VT) e Auxílio Veículo Comercial dos colaboradores ativos</p>
          </div>
          <Button
            onClick={() => setNovoModal(true)}
            className="shrink-0 font-semibold gap-2"
            style={{ background: "oklch(0.48 0.20 252)", color: "oklch(0.13 0.07 254)", border: "none" }}
          >
            <Plus className="w-4 h-4" /> Novo Benefício
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Colaboradores", value: data?.length ?? "—", icon: Gift, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
          { label: "Com VR", value: totalComVR, icon: Wallet, color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
          { label: "Com VT", value: totalComVT, icon: Bus, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
          { label: "Com Auxílio Veículo", value: totalComAuxilio, icon: Car, color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
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

      {/* Filtros */}
      <Card className="border border-border/60 rounded-xl">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar colaborador..."
                value={busca}
                onChange={e => handleBusca(e.target.value)}
              />
            </div>
            <Select
              value={empresaId ? String(empresaId) : "all"}
              onValueChange={v => { setEmpresaId(v === "all" ? undefined : Number(v)); setSetorId(undefined); }}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={setorId ? String(setorId) : "all"}
              onValueChange={v => setSetorId(v === "all" ? undefined : Number(v))}
              disabled={!empresaId}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {setores?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {(busca || empresaId || setorId) && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setBuscaDebounced(""); setEmpresaId(undefined); setSetorId(undefined); }}>
                <X className="w-4 h-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legenda + Filtros por tipo */}
      <div className="rounded-xl border border-border/60 bg-card px-5 py-4" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mr-1">Filtrar por tipo:</span>

          {/* Todos */}
          <button
            onClick={() => setFiltroCaju("todos")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroCaju === "todos"
                ? "bg-slate-700 border-slate-500 text-white shadow-sm"
                : "bg-card border-border text-muted-foreground hover:bg-muted/60"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
            Todos
          </button>

          {/* VT Saldo Livre */}
          <button
            onClick={() => setFiltroCaju(filtroCaju === "vt_saldo_livre" ? "todos" : "vt_saldo_livre")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroCaju === "vt_saldo_livre"
                ? "bg-emerald-100 border-emerald-400 text-emerald-800 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:bg-emerald-50 hover:border-emerald-300"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399', border: '1px solid #10b981' }}></div>
            VT Saldo Livre (Caju)
          </button>

          {/* VR Saldo Livre */}
          <button
            onClick={() => setFiltroCaju(filtroCaju === "vr_saldo_livre" ? "todos" : "vr_saldo_livre")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroCaju === "vr_saldo_livre"
                ? "bg-red-100 border-red-400 text-red-800 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:bg-red-50 hover:border-red-300"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f87171', border: '1px solid #ef4444' }}></div>
            VR Saldo Livre (Caju)
          </button>

          {/* Auxílio Veículo Caju */}
          <button
            onClick={() => setFiltroCaju(filtroCaju === "auxilio_veiculo_caju" ? "todos" : "auxilio_veiculo_caju")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroCaju === "auxilio_veiculo_caju"
                ? "bg-yellow-100 border-yellow-400 text-yellow-800 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:bg-yellow-50 hover:border-yellow-300"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fbbf24', border: '1px solid #f59e0b' }}></div>
            Auxílio Veículo (Caju)
          </button>

          {/* Auxílio Veículo Folha */}
          <button
            onClick={() => setFiltroCaju(filtroCaju === "auxilio_veiculo_folha" ? "todos" : "auxilio_veiculo_folha")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroCaju === "auxilio_veiculo_folha"
                ? "bg-purple-100 border-purple-400 text-purple-800 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:bg-purple-50 hover:border-purple-300"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#a855f7', border: '1px solid #9333ea' }}></div>
            Auxílio Veículo — Folha
          </button>

          {/* Auxílio Celular Folha */}
          <button
            onClick={() => setFiltroCaju(filtroCaju === "auxilio_celular_folha" ? "todos" : "auxilio_celular_folha")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroCaju === "auxilio_celular_folha"
                ? "bg-indigo-100 border-indigo-400 text-indigo-800 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:bg-indigo-50 hover:border-indigo-300"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#6366f1', border: '1px solid #4f46e5' }}></div>
            Auxílio Celular — Folha
          </button>

          {/* Normal */}
          <button
            onClick={() => setFiltroCaju(filtroCaju === "normal" ? "todos" : "normal")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filtroCaju === "normal"
                ? "bg-slate-200 border-slate-400 text-slate-700 shadow-sm"
                : "bg-card border-border text-muted-foreground hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#d1d5db', border: '1px solid #9ca3af' }}></div>
            Normal (sem destaque)
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-foreground">Colaboradores {dadosFiltrados.length > 0 ? `(${dadosFiltrados.length}${filtroCaju !== 'todos' ? ' filtrados' : ''})` : data ? '(0)' : ''}</span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data || dadosFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-base font-bold text-foreground">Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                  <SortableHeader col="nome" label="Nome" sort={sortBenef} onToggle={toggleSortBenef} />
                  <SortableHeader col="empresaNome" label="Empresa" sort={sortBenef} onToggle={toggleSortBenef} />
                  <SortableHeader col="setorNome" label="Setor" sort={sortBenef} onToggle={toggleSortBenef} />
                  <SortableHeader col="valorVR" label="VR" sort={sortBenef} onToggle={toggleSortBenef} align="right" />
                  <SortableHeader col="valorVT" label="VT" sort={sortBenef} onToggle={toggleSortBenef} align="right" />
                  <SortableHeader col="auxilioVeiculo" label="Aux. Veículo (Caju)" sort={sortBenef} onToggle={toggleSortBenef} align="right" />
                  <th className="text-right px-3 py-3 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9333ea' }}>Aux. Veículo<br/>Folha</th>
                  <th className="text-right px-3 py-3 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#4f46e5' }}>Aux. Celular<br/>Folha</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortBenefData(dadosFiltrados).map((row, idx) => {
                  const vrVal = row.valorVR ? parseFloat(row.valorVR) : 0;
                  const vtVal = row.valorVT ? parseFloat(row.valorVT) : 0;
                  const auxVal = row.auxilioVeiculo ? parseFloat(row.auxilioVeiculo) : 0;
                  const auxVeiculoFolha = (row as any).auxilioVeiculoFolha ? parseFloat((row as any).auxilioVeiculoFolha) : 0;
                  const auxCelularFolha = (row as any).auxilioCelularFolha ? parseFloat((row as any).auxilioCelularFolha) : 0;
                  const cajuTipo = row.tipoRecebimentoCaju;
                  const cajuStyle: React.CSSProperties = auxCelularFolha > 0
                    ? { background: 'rgba(238,242,255,0.7)', borderLeft: '4px solid #6366f1' }
                    : auxVeiculoFolha > 0
                    ? { background: 'rgba(250,245,255,0.7)', borderLeft: '4px solid #a855f7' }
                    : cajuTipo === 'vt_saldo_livre'
                    ? { background: 'rgba(236,253,245,0.85)', borderLeft: '4px solid #34d399' }
                    : cajuTipo === 'vr_saldo_livre'
                    ? { background: 'rgba(254,242,242,0.85)', borderLeft: '4px solid #f87171' }
                    : cajuTipo === 'auxilio_veiculo'
                    ? { background: 'rgba(255,251,235,0.85)', borderLeft: '4px solid #fbbf24' }
                    : idx % 2 !== 0 ? { background: 'rgba(0,0,0,0.02)' } : {};
                  return (
                    <tr key={row.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors" style={cajuStyle}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                            {row.nome[0].toUpperCase()}
                          </div>
                          <div>
                            <NomeColaborador nome={row.nome} className="font-semibold" maxChars={26} />
                            {cajuTipo && cajuTipo !== 'normal' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5" style={
                                cajuTipo === 'vt_saldo_livre' ? { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }
                                : cajuTipo === 'vr_saldo_livre' ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }
                                : { background: '#fef9c3', color: '#a16207', border: '1px solid #fde047' }
                              }>
                                🌿 {cajuTipo === 'vt_saldo_livre' ? 'VT Saldo Livre' : cajuTipo === 'vr_saldo_livre' ? 'VR Saldo Livre' : 'Aux. Veículo'} (Caju)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ background: "oklch(0.97 0.02 245)", color: "oklch(0.4 0.1 245)" }}>
                          {row.empresaNome || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">{row.setorBeneficio || row.setorNome || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {vrVal > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-emerald-100 font-mono">
                            {fmtMoeda(row.valorVR)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não recebe</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {vtVal > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 font-mono">
                            {fmtMoeda(row.valorVT)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não recebe</span>
                          )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {auxVal > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 font-mono">
                            {fmtAuxilio(row.auxilioVeiculo)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não recebe</span>
                        )}
                      </td>
                      {/* Auxílio Veículo Folha */}
                      <td className="px-4 py-3 text-right">
                        {auxVeiculoFolha > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border font-mono" style={{ background: '#faf5ff', color: '#7e22ce', borderColor: '#d8b4fe' }}>
                            {auxVeiculoFolha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            <span className="text-[9px] font-semibold opacity-70">FOLHA</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não recebe</span>
                        )}
                      </td>
                      {/* Auxílio Celular Folha */}
                      <td className="px-4 py-3 text-right">
                        {auxCelularFolha > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border font-mono" style={{ background: '#eef2ff', color: '#3730a3', borderColor: '#a5b4fc' }}>
                            {auxCelularFolha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            <span className="text-[9px] font-semibold opacity-70">FOLHA</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não recebe</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <Button size="icon" variant="ghost" className="w-8 h-8 hover:bg-blue-50 hover:text-blue-600" title="Editar" onClick={() => openEdit(row)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edição */}
      <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Gift className="w-4 h-4 text-primary" />
              Editar Benefícios
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="py-1">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{editItem.nome}</p>
                  <p className="text-xs text-muted-foreground">{editItem.empresaNome || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {/* VR */}
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <Wallet className="w-3 h-3 text-blue-600" /> VR — R$
                  </Label>
                  <Input className="h-7 text-xs" value={editForm.valorVR} onChange={e => setEditForm({ ...editForm, valorVR: e.target.value })} placeholder="39.52" />
                </div>

                {/* VT */}
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <Bus className="w-3 h-3 text-blue-600" /> VT — R$
                  </Label>
                  <Input className="h-7 text-xs" value={editForm.valorVT} onChange={e => setEditForm({ ...editForm, valorVT: e.target.value })} placeholder="150.00" />
                </div>

                {/* Aux Veículo Caju */}
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <Car className="w-3 h-3 text-blue-600" /> Aux. Veículo Caju — R$
                  </Label>
                  <Input className="h-7 text-xs" value={editForm.auxilioVeiculo} onChange={e => setEditForm({ ...editForm, auxilioVeiculo: e.target.value })} placeholder="1000.00" />
                </div>

                {/* Valor Fixo Quinzenal */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">📌 Val. Fixo Quinzenal — R$</Label>
                  <Input className="h-7 text-xs" value={editForm.valorFixoQuinzenal} onChange={e => setEditForm({ ...editForm, valorFixoQuinzenal: e.target.value })} placeholder="632.00" />
                </div>

                {/* Aux Veículo Folha */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#7e22ce' }}>🚗 Aux. Veículo Folha — R$</Label>
                  <Input className="h-7 text-xs" value={editForm.auxilioVeiculoFolha} onChange={e => setEditForm({ ...editForm, auxilioVeiculoFolha: e.target.value })} placeholder="400.00" style={{ borderColor: '#d8b4fe' }} />
                  <p className="text-[9px]" style={{ color: '#9333ea' }}>Direto na folha</p>
                </div>

                {/* Aux Celular Folha */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#3730a3' }}>📱 Aux. Celular Folha — R$</Label>
                  <Input className="h-7 text-xs" value={editForm.auxilioCelularFolha} onChange={e => setEditForm({ ...editForm, auxilioCelularFolha: e.target.value })} placeholder="200.00" style={{ borderColor: '#a5b4fc' }} />
                  <p className="text-[9px]" style={{ color: '#4f46e5' }}>Direto na folha</p>
                </div>

                {/* Setor — full width */}
                <div className="col-span-2 space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Setor (benefícios)</Label>
                  <Input className="h-7 text-xs" value={editForm.setorBeneficio} onChange={e => setEditForm({ ...editForm, setorBeneficio: e.target.value })} placeholder="Setor conforme planilha" />
                </div>
                {/* Tipo Recebimento Caju — full width */}
                <div className="col-span-2 space-y-0.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#0ea5e9' }}>🍃 Tipo Recebimento Caju</Label>
                  <Select value={editForm.tipoRecebimentoCaju} onValueChange={v => setEditForm({ ...editForm, tipoRecebimentoCaju: v })}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal (sem Caju)</SelectItem>
                      <SelectItem value="vt_saldo_livre">🟢 VT — Saldo Livre (Caju)</SelectItem>
                      <SelectItem value="vr_saldo_livre">🔴 VR — Saldo Livre (Caju)</SelectItem>
                      <SelectItem value="auxilio_veiculo">🟡 Auxílio Veículo (Caju)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button size="sm" variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de novo benefício */}
      <Dialog open={novoModal} onOpenChange={open => { if (!open) { setNovoModal(false); setNovoForm({ colaboradorId: "", valorVR: "", valorVT: "", auxilioVeiculo: "", auxilioVeiculoFolha: "", auxilioCelularFolha: "", setorBeneficio: "", valorFixoQuinzenal: "", tipoRecebimentoCaju: "normal" }); setNovoColabBusca(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Gift className="w-4 h-4 text-blue-500" />
              Novo Benefício
            </DialogTitle>
          </DialogHeader>
          <div className="py-1">
            {/* Busca de colaborador */}
            <div className="space-y-0.5 mb-3">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Buscar Colaborador</Label>
              <Input
                className="h-7 text-xs"
                placeholder="Digite o nome..."
                value={novoColabBusca}
                onChange={e => { setNovoColabBusca(e.target.value); setNovoForm(f => ({ ...f, colaboradorId: "" })); }}
              />
              {novoColabBusca.length >= 2 && colaboradoresBusca && colaboradoresBusca.length > 0 && !novoForm.colaboradorId && (
                <div className="border rounded-md overflow-hidden mt-1 max-h-36 overflow-y-auto">
                  {colaboradoresBusca.map((c: any) => (
                    <button key={c.id} className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors border-b last:border-0" onClick={() => { setNovoForm(f => ({ ...f, colaboradorId: String(c.id) })); setNovoColabBusca(c.nome); }}>
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-muted-foreground ml-2">{c.empresaNome || ""}</span>
                    </button>
                  ))}
                </div>
              )}
              {novoForm.colaboradorId && <p className="text-[10px] text-blue-600 font-medium">✓ Colaborador selecionado</p>}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {/* VR */}
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                  <Wallet className="w-3 h-3 text-blue-600" /> VR — R$
                </Label>
                <Input className="h-7 text-xs" value={novoForm.valorVR} onChange={e => setNovoForm(f => ({ ...f, valorVR: e.target.value }))} placeholder="39.52" />
              </div>

              {/* VT */}
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                  <Bus className="w-3 h-3 text-blue-600" /> VT — R$
                </Label>
                <Input className="h-7 text-xs" value={novoForm.valorVT} onChange={e => setNovoForm(f => ({ ...f, valorVT: e.target.value }))} placeholder="150.00" />
              </div>

              {/* Aux Veículo Caju */}
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                  <Car className="w-3 h-3 text-blue-600" /> Aux. Veículo Caju — R$
                </Label>
                <Input className="h-7 text-xs" value={novoForm.auxilioVeiculo} onChange={e => setNovoForm(f => ({ ...f, auxilioVeiculo: e.target.value }))} placeholder="1000.00" />
              </div>

              {/* Valor Fixo Quinzenal */}
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">📌 Val. Fixo Quinzenal — R$</Label>
                <Input className="h-7 text-xs" value={novoForm.valorFixoQuinzenal} onChange={e => setNovoForm(f => ({ ...f, valorFixoQuinzenal: e.target.value }))} placeholder="632.00" />
              </div>

              {/* Aux Veículo Folha */}
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#7e22ce' }}>🚗 Aux. Veículo Folha — R$</Label>
                <Input className="h-7 text-xs" value={novoForm.auxilioVeiculoFolha} onChange={e => setNovoForm(f => ({ ...f, auxilioVeiculoFolha: e.target.value }))} placeholder="400.00" style={{ borderColor: '#d8b4fe' }} />
                <p className="text-[9px]" style={{ color: '#9333ea' }}>Direto na folha</p>
              </div>

              {/* Aux Celular Folha */}
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#3730a3' }}>📱 Aux. Celular Folha — R$</Label>
                <Input className="h-7 text-xs" value={novoForm.auxilioCelularFolha} onChange={e => setNovoForm(f => ({ ...f, auxilioCelularFolha: e.target.value }))} placeholder="200.00" style={{ borderColor: '#a5b4fc' }} />
                <p className="text-[9px]" style={{ color: '#4f46e5' }}>Direto na folha</p>
              </div>

              {/* Setor — full width */}
              <div className="col-span-2 space-y-0.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Setor (benefícios)</Label>
                <Input className="h-7 text-xs" value={novoForm.setorBeneficio} onChange={e => setNovoForm(f => ({ ...f, setorBeneficio: e.target.value }))} placeholder="Setor conforme planilha" />
              </div>
              {/* Tipo Recebimento Caju — full width */}
              <div className="col-span-2 space-y-0.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#0ea5e9' }}>🍃 Tipo Recebimento Caju</Label>
                <Select value={novoForm.tipoRecebimentoCaju} onValueChange={v => setNovoForm(f => ({ ...f, tipoRecebimentoCaju: v }))}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal (sem Caju)</SelectItem>
                    <SelectItem value="vt_saldo_livre">🟢 VT — Saldo Livre (Caju)</SelectItem>
                    <SelectItem value="vr_saldo_livre">🔴 VR — Saldo Livre (Caju)</SelectItem>
                    <SelectItem value="auxilio_veiculo">🟡 Auxílio Veículo (Caju)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button size="sm" variant="outline" onClick={() => { setNovoModal(false); setNovoForm({ colaboradorId: "", valorVR: "", valorVT: "", auxilioVeiculo: "", auxilioVeiculoFolha: "", auxilioCelularFolha: "", setorBeneficio: "", valorFixoQuinzenal: "", tipoRecebimentoCaju: "normal" }); setNovoColabBusca(""); }}>Cancelar</Button>
            <Button size="sm" onClick={saveNovo} disabled={!novoForm.colaboradorId || updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
