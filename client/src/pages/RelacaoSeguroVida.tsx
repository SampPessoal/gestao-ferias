import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PrivacyValue } from "@/components/PrivacyValue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, ShieldOff, Search, Edit2, X, Trash2, Plus } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";
import { toast } from "sonner";
import { formatDate, toDateStr } from "@/lib/ferias";

export default function RelacaoSeguroVida() {
  const utils = trpc.useUtils();
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [empresaId, setEmpresaId] = useState<number | undefined>();
  const [setorId, setSetorId] = useState<number | undefined>();
  const [seguro, setSeguro] = useState<"com" | "sem" | "todos">("todos");

  // Debounce busca
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function handleBusca(v: string) {
    setBusca(v);
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => setBuscaDebounced(v), 300));
  }

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery(empresaId ? { empresaId } : undefined);
  const { data, isLoading } = trpc.seguroVida.list.useQuery({
    busca: buscaDebounced || undefined,
    empresaId,
    setorId,
    seguro,
  });

  // Modal de edição
  const { sort: sortSeg, toggle: toggleSortSeg, sortData: sortSegData } = useTableSort<"nome" | "cpf" | "dataNascimento" | "empresaNome" | "setorNome" | "valorSeguroVida">("nome", "asc");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ temSeguroVida: false, valorSeguroVida: "" });

  // Confirmação de remoção
  const [removeItem, setRemoveItem] = useState<any | null>(null);

  const updateMutation = trpc.seguroVida.update.useMutation({
    onSuccess: () => {
      toast.success("Seguro de vida atualizado!");
      utils.seguroVida.list.invalidate();
      setEditItem(null);
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const removeMutation = trpc.seguroVida.remove.useMutation({
    onSuccess: () => {
      toast.success("Seguro de vida removido!");
      utils.seguroVida.list.invalidate();
      setRemoveItem(null);
    },
    onError: () => toast.error("Erro ao remover."),
  });

  function openEdit(item: any) {
    setEditItem(item);
    setEditForm({
      temSeguroVida: item.temSeguroVida ?? false,
      valorSeguroVida: item.valorSeguroVida ?? "",
    });
  }

  function saveEdit() {
    if (!editItem) return;
    updateMutation.mutate({
      id: editItem.id,
      temSeguroVida: editForm.temSeguroVida,
      valorSeguroVida: editForm.temSeguroVida ? (editForm.valorSeguroVida || null) : null,
    });
  }

  function confirmRemove() {
    if (!removeItem) return;
    removeMutation.mutate({ id: removeItem.id });
  }

  const totalComSeguro = data?.filter((r) => r.temSeguroVida).length ?? 0;
  const totalSemSeguro = (data?.length ?? 0) - totalComSeguro;
  const totalMensalSeguro = data?.filter((r) => r.temSeguroVida && r.valorSeguroVida)
    .reduce((acc, r) => acc + parseFloat(String(r.valorSeguroVida ?? 0)), 0) ?? 0;
  const fmtMoedaSV = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Modal de novo seguro
  const [novoModal, setNovoModal] = useState(false);
  const [novoForm, setNovoForm] = useState({ colaboradorId: "", temSeguroVida: true, valorSeguroVida: "" });
  const [novoColabBusca, setNovoColabBusca] = useState("");
  const [novoColabSelecionado, setNovoColabSelecionado] = useState<{ empresaNome?: string | null; valorSeguroVidaEmpresa?: string | null } | null>(null);
  const { data: colaboradoresBuscaData } = trpc.colaboradores.list.useQuery(
    { busca: novoColabBusca || undefined, status: "ativo" },
    { enabled: novoColabBusca.length >= 2 }
  );
  const colaboradoresBusca = colaboradoresBuscaData?.data;

  function saveNovo() {
    if (!novoForm.colaboradorId) return;
    updateMutation.mutate({
      id: Number(novoForm.colaboradorId),
      temSeguroVida: novoForm.temSeguroVida,
      valorSeguroVida: novoForm.temSeguroVida ? (novoForm.valorSeguroVida || null) : null,
    }, {
      onSuccess: () => {
        toast.success("Seguro de vida cadastrado!");
        utils.seguroVida.list.invalidate();
        setNovoModal(false);
        setNovoForm({ colaboradorId: "", temSeguroVida: true, valorSeguroVida: "" });
        setNovoColabBusca("");
        setNovoColabSelecionado(null);
      },
    });
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d1f3c 60%, #0f172a 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 40%)" }} />
        <div className="relative px-7 py-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
            <ShieldCheck className="w-7 h-7" style={{ color: "#60a5fa" }} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}>Relação de Seguro de Vida</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Gerencie o seguro de vida dos colaboradores ativos</p>
          </div>
          <Button
            onClick={() => setNovoModal(true)}
            className="shrink-0 font-semibold gap-2"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            <Plus className="w-4 h-4" /> Novo Seguro de Vida
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { icon: ShieldCheck, label: "Total de Colaboradores", value: data?.length ?? "—", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", isMonetary: false },
          { icon: ShieldCheck, label: "Com Seguro de Vida", value: totalComSeguro, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", isMonetary: false },
          { icon: ShieldOff, label: "Sem Seguro de Vida", value: totalSemSeguro, color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", isMonetary: false },
          { icon: ShieldCheck, label: "Total Mensal (Folha)", value: fmtMoedaSV(totalMensalSeguro), color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", isMonetary: true },
        ].map((item, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
            </div>
            {item.isMonetary
              ? <p className="text-xl font-black text-foreground leading-tight" style={{ fontFamily: "var(--font-display)" }}><PrivacyValue value={String(item.value)} iconSize={14} /></p>
              : <p className="text-3xl font-black text-foreground" style={{ fontFamily: "var(--font-display)" }}>{item.value}</p>
            }
            <p className="text-xs font-medium text-muted-foreground mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <Card>
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
            <Select
              value={seguro}
              onValueChange={v => setSeguro(v as "com" | "sem" | "todos")}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Seguro de Vida" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com Seguro de Vida</SelectItem>
                <SelectItem value="sem">Sem Seguro de Vida</SelectItem>
              </SelectContent>
            </Select>
            {(busca || empresaId || setorId || seguro !== "todos") && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setBuscaDebounced(""); setEmpresaId(undefined); setSetorId(undefined); setSeguro("todos"); }}>
                <X className="w-4 h-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="px-5 py-4 border-b border-border/60">
          <span className="text-sm font-bold text-foreground">Colaboradores {data ? `(${data.length})` : ""}</span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <ShieldOff className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-base font-bold text-foreground">Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                  <SortableHeader col="nome" label="Nome" sort={sortSeg} onToggle={toggleSortSeg} />
                  <SortableHeader col="cpf" label="CPF" sort={sortSeg} onToggle={toggleSortSeg} />
                  <SortableHeader col="dataNascimento" label="Nascimento" sort={sortSeg} onToggle={toggleSortSeg} />
                  <SortableHeader col="empresaNome" label="Empresa" sort={sortSeg} onToggle={toggleSortSeg} />
                  <SortableHeader col="setorNome" label="Setor" sort={sortSeg} onToggle={toggleSortSeg} />
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Seguro de Vida</th>
                  <SortableHeader col="valorSeguroVida" label="Valor (Folha)" sort={sortSeg} onToggle={toggleSortSeg} align="right" />
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortSegData(data).map((row, idx) => (
                  <tr key={row.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #0f172a)" }}>
                          {row.nome[0].toUpperCase()}
                        </div>
                        <NomeColaborador nome={row.nome} className="font-semibold" maxChars={26} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{row.cpf || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(toDateStr(row.dataNascimento as any)) || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.empresaNome || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.setorNome || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {row.temSeguroVida ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          <ShieldCheck className="w-3.5 h-3.5" /> Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-100">
                          <ShieldOff className="w-3.5 h-3.5" /> Não
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {row.temSeguroVida && row.valorSeguroVida
                        ? <span className="text-blue-700">{`R$ ${row.valorSeguroVida}`}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="w-8 h-8 hover:bg-blue-50 hover:text-blue-600" title="Editar" onClick={() => openEdit(row)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {row.temSeguroVida && (
                          <Button size="icon" variant="ghost" className="w-8 h-8 hover:bg-red-50 hover:text-red-600" title="Remover seguro de vida" onClick={() => setRemoveItem(row)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edição */}
      <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Seguro de Vida
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-5 py-2">
              <div>
                <p className="font-semibold text-foreground">{editItem.nome}</p>
                <p className="text-sm text-muted-foreground">{editItem.cpf || "CPF não informado"}</p>
              </div>

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
                <div>
                  <Label className="text-sm font-medium">Possui seguro de vida?</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Ativar ou desativar o seguro</p>
                </div>
                <Switch
                  checked={editForm.temSeguroVida}
                  onCheckedChange={v => setEditForm({ ...editForm, temSeguroVida: v, valorSeguroVida: v ? editForm.valorSeguroVida : "" })}
                />
              </div>

              {editForm.temSeguroVida && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Valor descontado na folha (R$)</Label>
                  <Input
                    value={editForm.valorSeguroVida}
                    onChange={e => setEditForm({ ...editForm, valorSeguroVida: e.target.value })}
                    placeholder="Ex: 11,90"
                  />
                  <p className="text-xs text-muted-foreground">Digite o valor exato que é descontado mensalmente.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de novo seguro */}
      <Dialog open={novoModal} onOpenChange={open => { if (!open) { setNovoModal(false); setNovoForm({ colaboradorId: "", temSeguroVida: true, valorSeguroVida: "" }); setNovoColabBusca(""); setNovoColabSelecionado(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Novo Seguro de Vida
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Buscar Colaborador</Label>
              <Input
                placeholder="Digite o nome do colaborador..."
                value={novoColabBusca}
                onChange={e => { setNovoColabBusca(e.target.value); setNovoForm(f => ({ ...f, colaboradorId: "" })); setNovoColabSelecionado(null); }}
              />
              {novoColabBusca.length >= 2 && colaboradoresBusca && colaboradoresBusca.length > 0 && !novoForm.colaboradorId && (
                <div className="border rounded-lg overflow-hidden mt-1 max-h-48 overflow-y-auto">
                  {colaboradoresBusca.map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b last:border-0"
                      onClick={() => {
                        const valorEmpresa = c.valorSeguroVidaEmpresa ?? "";
                        setNovoForm(f => ({ ...f, colaboradorId: String(c.id), valorSeguroVida: valorEmpresa }));
                        setNovoColabBusca(c.nome);
                        setNovoColabSelecionado({ empresaNome: c.empresaNome, valorSeguroVidaEmpresa: c.valorSeguroVidaEmpresa });
                      }}
                    >
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{c.empresaNome || ""}</span>
                    </button>
                  ))}
                </div>
              )}
              {novoForm.colaboradorId && novoColabSelecionado && (
                <div className="mt-2 p-3 rounded-lg border border-blue-100 bg-blue-50/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Empresa</span>
                    <span className="text-xs font-bold text-foreground">{novoColabSelecionado.empresaNome || "—"}</span>
                  </div>
                  {novoColabSelecionado.valorSeguroVidaEmpresa && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Valor cobrado pela empresa</span>
                      <span className="text-xs font-bold text-blue-700">R$ {novoColabSelecionado.valorSeguroVidaEmpresa}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
              <div>
                <Label className="text-sm font-medium">Possui seguro de vida?</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Ativar ou desativar o seguro</p>
              </div>
              <Switch
                checked={novoForm.temSeguroVida}
                onCheckedChange={v => setNovoForm(f => ({ ...f, temSeguroVida: v, valorSeguroVida: v ? f.valorSeguroVida : "" }))}
              />
            </div>

            {novoForm.temSeguroVida && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Valor descontado na folha (R$)</Label>
                <Input
                  value={novoForm.valorSeguroVida}
                  onChange={e => setNovoForm(f => ({ ...f, valorSeguroVida: e.target.value }))}
                  placeholder="Ex: 11,90"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNovoModal(false); setNovoForm({ colaboradorId: "", temSeguroVida: true, valorSeguroVida: "" }); setNovoColabBusca(""); }}>Cancelar</Button>
            <Button onClick={saveNovo} disabled={!novoForm.colaboradorId || updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <AlertDialog open={!!removeItem} onOpenChange={open => { if (!open) setRemoveItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover seguro de vida?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover o seguro de vida de <strong>{removeItem?.nome}</strong>, zerando o valor e marcando como "Sem seguro". Esta ação pode ser desfeita editando o colaborador novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmRemove}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
