import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarDays, Flag, MapPin, Globe, RefreshCw } from "lucide-react";

const TIPO_LABELS: Record<string, string> = {
  nacional: "Nacional",
  estadual: "Estadual (BA)",
  municipal: "Municipal",
};

const TIPO_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  nacional:  { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  estadual:  { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  municipal: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
};

const TIPO_ICONS: Record<string, React.ElementType> = {
  nacional: Globe,
  estadual: Flag,
  municipal: MapPin,
};

const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatarData(data: Date | string): string {
  const d = data instanceof Date ? data : new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

function toInputDate(data: Date | string): string {
  const d = data instanceof Date ? data : new Date(data);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const ano = d.getUTCFullYear();
  return `${ano}-${mes}-${dia}`;
}

type Feriado = {
  id: number;
  data: Date | string;
  nome: string;
  tipo: "nacional" | "estadual" | "municipal";
  recorrente: boolean;
  ativo: boolean;
  municipio?: string | null;
  setoresAfetados?: string | null;
};

type FormData = {
  data: string;
  nome: string;
  tipo: "nacional" | "estadual" | "municipal";
  recorrente: boolean;
  ativo: boolean;
  municipio: string;
  setoresAfetados: number[];
};

const FORM_VAZIO: FormData = { data: "", nome: "", tipo: "nacional", recorrente: true, ativo: true, municipio: "", setoresAfetados: [] };

function SetoresSelectorMunicipal({ setoresAfetados, onChange }: { setoresAfetados: number[]; onChange: (ids: number[]) => void }) {
  const { data: setores } = trpc.setores.list.useQuery(undefined);
  if (!setores || setores.length === 0) return null;
  const toggleAll = () => {
    if (setoresAfetados.length === setores.length) onChange([]);
    else onChange(setores.map((s: any) => s.id));
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Setores afetados</Label>
        <button type="button" onClick={toggleAll} className="text-[10px] text-amber-600 hover:text-amber-800 font-medium underline underline-offset-2">
          {setoresAfetados.length === setores.length ? "Desmarcar todos" : "Marcar todos"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto pr-0.5">
        {setores.map((s: any) => (
          <label key={s.id} className="flex items-center gap-1.5 cursor-pointer hover:bg-amber-100/70 rounded px-1.5 py-1 transition-colors">
            <Checkbox
              checked={setoresAfetados.includes(s.id)}
              onCheckedChange={checked => {
                if (checked) onChange([...setoresAfetados, s.id]);
                else onChange(setoresAfetados.filter(id => id !== s.id));
              }}
              className="w-3.5 h-3.5 border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <span className="text-[11px] font-medium text-amber-900 truncate leading-tight">{s.nome}</span>
          </label>
        ))}
      </div>
      {setoresAfetados.length > 0 && (
        <p className="text-[10px] text-amber-600 font-medium">{setoresAfetados.length} de {setores.length} selecionado(s)</p>
      )}
    </div>
  );
}

export default function Feriados() {
  const anoAtual = new Date().getFullYear();
  const [anoFiltro, setAnoFiltro] = useState(anoAtual);
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Feriado | null>(null);
  const [excluindo, setExcluindo] = useState<Feriado | null>(null);
  const [form, setForm] = useState<FormData>(FORM_VAZIO);

  const utils = trpc.useUtils();
  const { data: feriados, isLoading } = trpc.feriados.list.useQuery({ ano: anoFiltro });

  const createMutation = trpc.feriados.create.useMutation({
    onSuccess: () => { utils.feriados.list.invalidate(); toast.success("Feriado cadastrado!"); fecharModal(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.feriados.update.useMutation({
    onSuccess: () => { utils.feriados.list.invalidate(); toast.success("Feriado atualizado!"); fecharModal(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.feriados.delete.useMutation({
    onSuccess: () => { utils.feriados.list.invalidate(); toast.success("Feriado excluído."); setExcluindo(null); },
    onError: (e) => toast.error(e.message),
  });

  function abrirNovo() { setEditando(null); setForm(FORM_VAZIO); setModalAberto(true); }
  function abrirEditar(f: Feriado) {
    setEditando(f);
    let setoresArr: number[] = [];
    try { setoresArr = f.setoresAfetados ? JSON.parse(f.setoresAfetados) : []; } catch { setoresArr = []; }
    setForm({ data: toInputDate(f.data), nome: f.nome, tipo: f.tipo, recorrente: f.recorrente, ativo: f.ativo, municipio: f.municipio ?? "", setoresAfetados: setoresArr });
    setModalAberto(true);
  }
  function fecharModal() { setModalAberto(false); setEditando(null); setForm(FORM_VAZIO); }
  function salvar() {
    if (!form.data || !form.nome.trim()) { toast.error("Preencha a data e o nome do feriado."); return; }
    const setoresJson = form.setoresAfetados.length > 0 ? JSON.stringify(form.setoresAfetados) : null;
    const payload = {
      data: form.data,
      nome: form.nome,
      tipo: form.tipo,
      recorrente: form.recorrente,
      ativo: form.ativo,
      municipio: form.tipo === "municipal" && form.municipio.trim() ? form.municipio.trim() : null,
      setoresAfetados: form.tipo === "municipal" ? setoresJson : null,
    };
    if (editando) { updateMutation.mutate({ id: editando.id, ...payload }); }
    else { createMutation.mutate(payload); }
  }

  const feriadosFiltrados = useMemo(() => {
    if (!feriados) return [];
    return feriados.filter(f => tipoFiltro === "todos" || f.tipo === tipoFiltro);
  }, [feriados, tipoFiltro]);

  const porMes = useMemo(() => {
    const mapa: Record<number, Feriado[]> = {};
    for (const f of feriadosFiltrados) {
      const d = new Date(typeof f.data === 'string' ? f.data + 'T12:00:00Z' : f.data);
      const m = d.getUTCMonth();
      if (!mapa[m]) mapa[m] = [];
      mapa[m].push(f as Feriado);
    }
    return mapa;
  }, [feriadosFiltrados]);

  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - 1 + i);

  const contadores = useMemo(() => {
    if (!feriados) return { nacional: 0, estadual: 0, municipal: 0, total: 0 };
    return feriados.reduce(
      (acc, f) => { acc[f.tipo as keyof typeof acc] = (acc[f.tipo as keyof typeof acc] as number) + 1; acc.total++; return acc; },
      { nacional: 0, estadual: 0, municipal: 0, total: 0 }
    );
  }, [feriados]);

  return (
    <>
      <div className="space-y-6 animate-fade-in-up">

        {/* ── Hero Banner ─────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d1f3c 60%, #0f172a 100%)", minHeight: 140 }}>
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 15% 50%, #3b82f6 0%, transparent 45%), radial-gradient(circle at 85% 20%, #6366f1 0%, transparent 40%)" }} />
          <div className="relative px-7 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
                <CalendarDays className="w-7 h-7" style={{ color: "#60a5fa" }} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}>Feriados</h1>
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Nacionais, estaduais (Bahia) e municipais (Salvador) — usados no cálculo de dias úteis</p>
              </div>
            </div>
            <Button onClick={abrirNovo} className="gap-2 shrink-0 font-bold" style={{ background: "#3b82f6", color: "#fff" }}>
              <Plus className="w-4 h-4" />
              Novo Feriado
            </Button>
          </div>
        </div>

        {/* ── Cards de resumo ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { tipo: "todos",     label: "Total",           count: contadores.total,     icon: CalendarDays, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
            { tipo: "nacional",  label: "Nacionais",       count: contadores.nacional,  icon: Globe,        color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
            { tipo: "estadual",  label: "Estaduais (BA)",  count: contadores.estadual,  icon: Flag,         color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
            { tipo: "municipal", label: "Municipais (SSA)",count: contadores.municipal, icon: MapPin,       color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
          ].map((item) => (
            <div
              key={item.tipo}
              onClick={() => setTipoFiltro(item.tipo)}
              className="rounded-2xl bg-card border cursor-pointer transition-all hover:shadow-md"
              style={{
                borderColor: tipoFiltro === item.tipo ? item.color : "var(--border)",
                boxShadow: tipoFiltro === item.tipo ? `0 0 0 2px ${item.color}33` : "0 1px 8px oklch(0.145 0.03 245 / 0.06)",
              }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  {tipoFiltro === item.tipo && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: item.bg, color: item.color, border: `1px solid ${item.border}` }}>Filtro ativo</span>
                  )}
                </div>
                <p className="text-3xl font-black" style={{ color: item.color, fontFamily: "var(--font-display)" }}>{item.count}</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtro de ano ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border/60 rounded-xl px-4 py-2" style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.05)" }}>
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ano</span>
            <Select value={String(anoFiltro)} onValueChange={v => setAnoFiltro(parseInt(v))}>
              <SelectTrigger className="w-24 border-0 shadow-none h-7 p-0 font-bold text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {tipoFiltro !== "todos" && (
            <button
              onClick={() => setTipoFiltro("todos")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl border border-border/60 bg-card hover:bg-muted/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Limpar filtro
            </button>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando feriados...</p>
          </div>
        )}

        {/* ── Lista por mês ────────────────────────────────────────── */}
        {!isLoading && (
          <div className="space-y-4">
            {MESES_FULL.map((nomeMes, idx) => {
              const lista = porMes[idx];
              if (!lista || lista.length === 0) return null;
              return (
                <div key={idx} className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px oklch(0.145 0.03 245 / 0.06)" }}>
                  {/* Header do mês */}
                  <div className="px-5 py-3 border-b border-border/60 flex items-center gap-3" style={{ background: "oklch(0.97 0.005 245)" }}>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-blue-600">{MESES_SHORT[idx]}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <h3 className="text-sm font-bold text-foreground">{nomeMes}</h3>
                      <span className="text-xs text-muted-foreground">— {lista.length} feriado{lista.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Itens */}
                  <div className="divide-y divide-border/40">
                    {lista.map((f, i) => {
                      const Icon = TIPO_ICONS[f.tipo];
                      const badge = TIPO_BADGE[f.tipo];
                      return (
                        <div
                          key={f.id}
                          className={`flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/20 ${i % 2 !== 0 ? "bg-muted/10" : ""} ${!f.ativo ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: badge.bg, border: `1px solid ${badge.border}` }}>
                              <Icon className="w-4 h-4" style={{ color: badge.text }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{f.nome}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{formatarData(f.data)}</span>
                                {f.tipo === "municipal" && (f as any).municipio && (
                                  <span className="text-xs font-semibold" style={{ color: "#065f46" }}>· {(f as any).municipio}</span>
                                )}
                                {f.recorrente && (
                                  <span className="text-xs font-medium" style={{ color: "#3b82f6" }}>· Recorrente</span>
                                )}
                                {!f.ativo && (
                                  <span className="text-xs font-medium text-destructive">· Inativo</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
                              style={{ background: badge.bg, color: badge.text, borderColor: badge.border }}>
                              <Icon className="w-3 h-3" />
                              {f.tipo === "municipal" && (f as any).municipio
                                ? `Municipal · ${(f as any).municipio}`
                                : TIPO_LABELS[f.tipo]}
                            </span>
                            <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-blue-50 hover:text-blue-700" onClick={() => abrirEditar(f as Feriado)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive hover:bg-red-50" onClick={() => setExcluindo(f as Feriado)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {feriadosFiltrados.length === 0 && (
              <div className="rounded-2xl border border-border/60 bg-card py-20 text-center" style={{ boxShadow: "0 2px 12px oklch(0.145 0.03 245 / 0.06)" }}>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="w-7 h-7 text-blue-400" />
                </div>
                <p className="font-semibold text-foreground">Nenhum feriado encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Tente outro filtro ou cadastre um novo feriado.</p>
                <Button className="mt-5 gap-2" onClick={abrirNovo}>
                  <Plus className="w-4 h-4" /> Cadastrar Feriado
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal cadastro/edição ────────────────────────────────── */}
      <Dialog open={modalAberto} onOpenChange={v => { if (!v) fecharModal(); }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-base">{editando ? "Editar Feriado" : "Novo Feriado"}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{editando ? "Atualize os dados do feriado" : "Preencha os dados do novo feriado"}</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 py-1 overflow-y-auto flex-1 pr-1">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Data *</Label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Nome do Feriado *</Label>
              <Input placeholder="Ex: Independência da Bahia" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as typeof form.tipo }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nacional">Nacional</SelectItem>
                  <SelectItem value="estadual">Estadual (Bahia)</SelectItem>
                  <SelectItem value="municipal">Municipal (outro município)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Campos extras para feriado municipal */}
            {form.tipo === "municipal" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-amber-800">Configuração Municipal</span>
                </div>
                <Input
                  placeholder="Município (ex: Paulo Afonso, Ilhéus...)"
                  value={form.municipio}
                  onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))}
                  className="h-8 text-xs bg-white border-amber-200 focus:border-amber-400 placeholder:text-amber-400"
                />
                <SetoresSelectorMunicipal
                  setoresAfetados={form.setoresAfetados}
                  onChange={ids => setForm(f => ({ ...f, setoresAfetados: ids }))}
                />
              </div>
            )}
            <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/40">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Recorrente todo ano</p>
                  <p className="text-xs text-muted-foreground">Feriados fixos como Natal, Tiradentes</p>
                </div>
                <Switch checked={form.recorrente} onCheckedChange={v => setForm(f => ({ ...f, recorrente: v }))} />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Ativo</p>
                  <p className="text-xs text-muted-foreground">Desativar para ignorar no cálculo</p>
                </div>
                <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button className="gap-2" onClick={salvar} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Spinner className="w-4 h-4" />}
              {editando ? "Salvar Alterações" : "Cadastrar Feriado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de exclusão ──────────────────────────────── */}
      <AlertDialog open={!!excluindo} onOpenChange={v => { if (!v) setExcluindo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir feriado?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{excluindo?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluindo && deleteMutation.mutate({ id: excluindo.id })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
