import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { contemTexto } from "@/lib/busca";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { CalendarCheck, Download, Pencil, Plus, Search, Trash2 } from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
type Tipo = "compensatoria" | "normal" | "outros";
type Folga = {
  id: number; colaboradorId: number; tipo: Tipo; titulo: string | null; dataInicio: string; dataFim: string; dias: number;
  motivo: string | null; registradoPor: string | null; colaboradorNome: string | null;
  empresaId: number | null; empresaNome: string | null; setorId: number | null; setorNome: string | null;
};
const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const brCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const periodo = (f: Folga) => f.dataInicio === f.dataFim ? brCurto(f.dataInicio) : `${brCurto(f.dataInicio)} a ${brCurto(f.dataFim)}`;
const rotuloTipo = (f: Pick<Folga, "tipo" | "titulo">) => f.tipo === "compensatoria" ? "Compensatória" : f.tipo === "normal" ? "Normal" : (f.titulo || "Outros");

function EtiquetaTipo({ f }: { f: Pick<Folga, "tipo" | "titulo"> }) {
  const cls = f.tipo === "compensatoria"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
    : f.tipo === "normal"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return <Badge variant="secondary" className={`border-0 font-medium ${cls}`}>{rotuloTipo(f)}</Badge>;
}

type Form = { id?: number; colaboradorId: number | null; colaboradorNome: string; tipo: Tipo; titulo: string; dataInicio: string; dataFim: string; motivo: string };
const hojeISO = () => new Date().toISOString().slice(0, 10);
const formVazio = (): Form => ({ colaboradorId: null, colaboradorNome: "", tipo: "compensatoria", titulo: "", dataInicio: hojeISO(), dataFim: hojeISO(), motivo: "" });

export default function RelacaoFolgas() {
  const hoje = new Date();
  const utils = trpc.useUtils();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [empresaId, setEmpresaId] = useState("all");
  const [setorId, setSetorId] = useState("all");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [buscaColab, setBuscaColab] = useState("");
  const [excluir, setExcluir] = useState<Folga | null>(null);

  const buscando = busca.trim().length > 0;
  // Buscando um nome: ano inteiro (todas as folgas da pessoa); senão, só o mês escolhido
  const listaQ = trpc.folgas.list.useQuery(
    { ano: Number(ano), mes: buscando || mes === "all" ? undefined : Number(mes) },
    { retry: false },
  );
  const tabelaAusente = (listaQ.error?.message || "").includes("TABELA_FOLGAS_AUSENTE");
  const { data: empresas = [] } = trpc.empresas.list.useQuery();
  const { data: setores = [] } = trpc.setores.list.useQuery(empresaId !== "all" ? { empresaId: Number(empresaId) } : undefined);
  const { data: ativos = [] } = trpc.colaboradores.listAtivos.useQuery(undefined);

  const lista = useMemo(() => ((listaQ.data ?? []) as Folga[]).filter((f) =>
    (empresaId === "all" || f.empresaId === Number(empresaId)) &&
    (setorId === "all" || f.setorId === Number(setorId)) &&
    (!buscando || contemTexto(f.colaboradorNome ?? "", busca))), [listaQ.data, empresaId, setorId, busca, buscando]);

  // Agrupa por mês de início (visão da pessoa / ano inteiro)
  const porMes = useMemo(() => {
    const m = new Map<number, Folga[]>();
    for (const f of lista) { const k = Number(f.dataInicio.slice(5, 7)); m.set(k, [...(m.get(k) ?? []), f]); }
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [lista]);
  const totalDias = lista.reduce((a, f) => a + f.dias, 0);
  const contaTipo = (t: Tipo) => lista.filter((f) => f.tipo === t).length;

  const invalidar = () => utils.folgas.list.invalidate();
  const createM = trpc.folgas.create.useMutation({ onSuccess: () => { toast.success("Folga registrada"); setForm(null); invalidar(); }, onError: (e) => toast.error(e.message) });
  const updateM = trpc.folgas.update.useMutation({ onSuccess: () => { toast.success("Folga atualizada"); setForm(null); invalidar(); }, onError: (e) => toast.error(e.message) });
  const deleteM = trpc.folgas.delete.useMutation({ onSuccess: () => { toast.success("Folga excluída"); setExcluir(null); invalidar(); }, onError: (e) => toast.error(e.message) });

  const salvar = () => {
    if (!form) return;
    if (!form.colaboradorId) return toast.error("Escolha o colaborador");
    if (form.tipo === "outros" && !form.titulo.trim()) return toast.error("Informe o título da folga");
    if (form.dataFim < form.dataInicio) return toast.error("A data final não pode ser antes da inicial");
    const dados = { colaboradorId: form.colaboradorId, tipo: form.tipo, titulo: form.tipo === "outros" ? form.titulo : null, dataInicio: form.dataInicio, dataFim: form.dataFim, motivo: form.motivo || null };
    if (form.id) updateM.mutate({ id: form.id, dados }); else createM.mutate(dados);
  };
  const editar = (f: Folga) => { setForm({ id: f.id, colaboradorId: f.colaboradorId, colaboradorNome: f.colaboradorNome ?? "", tipo: f.tipo, titulo: f.titulo ?? "", dataInicio: f.dataInicio, dataFim: f.dataFim, motivo: f.motivo ?? "" }); setBuscaColab(""); };

  const exportar = () => {
    const linhas = lista.map((f) => ({
      Colaborador: f.colaboradorNome, Empresa: f.empresaNome, Setor: f.setorNome,
      Início: br(f.dataInicio), Fim: br(f.dataFim), Dias: f.dias, Tipo: rotuloTipo(f), Motivo: f.motivo ?? "", "Registrado por": f.registradoPor ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(linhas); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Folgas");
    XLSX.writeFile(wb, buscando ? `folgas_${busca.trim().replace(/\s+/g, "_").toLowerCase()}_${ano}.xlsx` : `folgas_${mes === "all" ? "ano" : MESES[Number(mes) - 1].toLowerCase()}_${ano}.xlsx`);
  };

  const Cab = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) =>
    <TableHead className={`text-xs font-bold uppercase tracking-wide ${className}`}>{children}</TableHead>;
  const Acoes = ({ f }: { f: Folga }) => (
    <TableCell className="text-right pr-5 whitespace-nowrap">
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => editar(f)}><Pencil className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" title="Excluir" onClick={() => setExcluir(f)}><Trash2 className="h-3.5 w-3.5" /></Button>
    </TableCell>
  );
  const anos = Array.from({ length: 4 }, (_, i) => String(hoje.getFullYear() - 2 + i));
  const pessoas = new Set(lista.map((f) => f.colaboradorId));

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)", boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)",
      }}>
        <div className="px-7 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
              <CalendarCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Relação de Folgas</h1>
              <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Folgas registradas por mês — controle do setor (não altera VR/VT)</p>
            </div>
          </div>
          <Button onClick={() => { setForm(formVazio()); setBuscaColab(""); }} disabled={tabelaAusente} className="gap-2 shrink-0 font-semibold"
            style={{ background: "oklch(0.48 0.20 252)", color: "oklch(0.13 0.07 254)", border: "none" }}>
            <Plus className="w-4 h-4" />Registrar Folga
          </Button>
        </div>
      </div>

      {tabelaAusente ? (
        <Card><CardContent className="py-10 text-center space-y-2">
          <p className="font-semibold">A aba Relação de Folgas ainda está sendo preparada.</p>
          <p className="text-sm text-muted-foreground">Falta criar a tabela no banco de dados (migração <code>20261119_folgas.sql</code>). Assim que ela for aplicada, esta tela passa a funcionar.</p>
        </CardContent></Card>
      ) : (<>
        <Card><CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Ano</Label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select value={mes} onValueChange={setMes} disabled={buscando}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Select value={empresaId} onValueChange={(v) => { setEmpresaId(v); setSetorId("all"); }}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(empresas as { id: number; nome: string }[]).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Setor</Label>
              <Select value={setorId} onValueChange={setSetorId}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(setores as { id: number; nome: string }[]).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Buscar colaborador</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Digite o nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <Button variant="outline" onClick={exportar} disabled={!lista.length} className="gap-2"><Download className="w-4 h-4" />Exportar Excel</Button>
          </div>
        </CardContent></Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[["Folgas", String(lista.length)], ["Compensatórias", String(contaTipo("compensatoria"))], ["Normais", String(contaTipo("normal"))], ["Outros", String(contaTipo("outros"))]].map(([l, v]) => (
            <Card key={l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold mt-1">{v}</p></CardContent></Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/40 text-sm text-muted-foreground">
            {buscando
              ? `Buscando “${busca.trim()}” em ${ano} · ${pessoas.size} colaborador${pessoas.size !== 1 ? "es" : ""} · ${lista.length} folga${lista.length !== 1 ? "s" : ""} · ${totalDias} dia${totalDias !== 1 ? "s" : ""}`
              : `${mes === "all" ? `Ano de ${ano}` : `${MESES[Number(mes) - 1]} de ${ano}`} · ${lista.length} folga${lista.length !== 1 ? "s" : ""} · ${totalDias} dia${totalDias !== 1 ? "s" : ""}`}
          </div>
          {listaQ.isLoading ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> : lista.length === 0 ? (
            <CardContent className="py-10 text-center text-muted-foreground">Nenhuma folga {buscando ? "encontrada para essa busca" : "registrada neste período"}.</CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <Cab className="pl-5 min-w-[200px]">Colaborador</Cab>
                    <Cab>Empresa</Cab>
                    <Cab>Setor</Cab>
                    <Cab>Data</Cab>
                    <Cab className="text-center">Dias</Cab>
                    <Cab>Tipo</Cab>
                    <Cab>Motivo</Cab>
                    <Cab>Registrado por</Cab>
                    <Cab className="text-right pr-5">Ações</Cab>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(buscando || mes === "all" ? porMes : [[0, lista] as [number, Folga[]]]).map(([m, fs]) => [
                    ...(m ? [<TableRow key={`m${m}`} className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={9} className="pl-5 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{MESES[m - 1]}</TableCell></TableRow>] : []),
                    ...fs.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="pl-5 font-medium">{f.colaboradorNome}</TableCell>
                        <TableCell>{f.empresaNome ?? "—"}</TableCell>
                        <TableCell>{f.setorNome ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{periodo(f)}</TableCell>
                        <TableCell className="text-center">{f.dias}</TableCell>
                        <TableCell><EtiquetaTipo f={f} /></TableCell>
                        <TableCell className="max-w-[260px] whitespace-normal break-words text-sm text-muted-foreground">{f.motivo || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.registradoPor ?? "—"}</TableCell>
                        <Acoes f={f} />
                      </TableRow>
                    )),
                  ])}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </>)}

      <Dialog open={form !== null} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Editar folga" : "Registrar folga"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1 relative">
                <Label>Colaborador</Label>
                {form.colaboradorId ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">{form.colaboradorNome}</span>
                    <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, colaboradorId: null, colaboradorNome: "" })}>Trocar</Button>
                  </div>
                ) : (<>
                  <Input placeholder="Digite o nome do colaborador..." value={buscaColab} onChange={(e) => setBuscaColab(e.target.value)} autoFocus />
                  {buscaColab.trim().length >= 1 && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md">
                      {(ativos as { id: number; nome: string }[]).filter((c) => contemTexto(c.nome, buscaColab)).slice(0, 30).map((c) => (
                        <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => { setForm({ ...form, colaboradorId: c.id, colaboradorNome: c.nome }); setBuscaColab(""); }}>{c.nome}</button>
                      ))}
                      {(ativos as { nome: string }[]).filter((c) => contemTexto(c.nome, buscaColab)).length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum colaborador encontrado</p>}
                    </div>
                  )}
                </>)}
              </div>
              <div className="space-y-1">
                <Label>Tipo de folga</Label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                  {([["compensatoria", "Compensatória"], ["normal", "Normal"], ["outros", "Outros"]] as [Tipo, string][]).map(([v, l]) => (
                    <Button key={v} type="button" role="radio" aria-checked={form.tipo === v} variant={form.tipo === v ? "default" : "outline"} onClick={() => setForm({ ...form, tipo: v })}>{l}</Button>
                  ))}
                </div>
              </div>
              {form.tipo === "outros" && (
                <div className="space-y-1">
                  <Label>Título da folga</Label>
                  <Input placeholder="Ex.: Prêmio, aniversário, doação de sangue…" maxLength={100} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>De</Label><Input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value, dataFim: form.dataFim < e.target.value ? e.target.value : form.dataFim })} /></div>
                <div className="space-y-1"><Label>Até</Label><Input type="date" value={form.dataFim} min={form.dataInicio} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <Label>Motivo / observação (opcional)</Label>
                <Textarea rows={2} placeholder="Ex.: compensação do sábado 08/11" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={createM.isPending || updateM.isPending}>Salvar folga</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={excluir !== null} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta folga?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir && <>Folga de <strong>{excluir.colaboradorNome}</strong> em {periodo(excluir)} ({rotuloTipo(excluir)}). Essa ação não pode ser desfeita.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={deleteM.isPending} onClick={() => excluir && deleteM.mutate({ id: excluir.id })}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
