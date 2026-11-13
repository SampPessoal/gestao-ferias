import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { PrivacyValue } from "@/components/PrivacyValue";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { ChevronDown, ChevronRight, Download, Pencil, Plus, Search, Smile, Trash2, Users } from "lucide-react";

const EMPRESAS = ["FREIRE", "JOANES", "SUDOESTE", "SOLAR"] as const;
type Empresa = (typeof EMPRESAS)[number];
const EMPRESA_LABELS: Record<string, string> = { FREIRE: "Freire", JOANES: "Joanes", SUDOESTE: "Sudoeste", SOLAR: "Solar" };
const PARENTESCOS = ["Conjuge", "Filho/Filha", "Agregado"] as const;

type Beneficiario = {
  id: number; empresa: Empresa; numeroOdontoprev: string; nome: string; cpf: string | null;
  tipo: "T" | "D"; parentesco: string; plano: string; titularNumeroOdontoprev: string | null;
  dataInclusao: string | null; valor: number;
};
type Familia = { titular: Beneficiario; dependentes: Beneficiario[]; total: number };

const formatMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatCPF = (c: string | null) => (c && c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : "—");
const formatData = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : "—");
const parentescoLabel = (p: string) => (p === "Conjuge" ? "Cônjuge" : p || "Dependente");

type Form = {
  id?: number; empresa: Empresa; numeroOdontoprev: string; nome: string; cpf: string; tipo: "T" | "D";
  parentesco: string; plano: "Integral DOC" | "Master"; titularNumeroOdontoprev: string; dataInclusao: string; valor: string;
};
const formVazio = (): Form => ({
  empresa: "SUDOESTE", numeroOdontoprev: "", nome: "", cpf: "", tipo: "T",
  parentesco: "Filho/Filha", plano: "Integral DOC", titularNumeroOdontoprev: "", dataInclusao: new Date().toISOString().slice(0, 10), valor: "",
});

export default function PlanoOdontologico() {
  const utils = trpc.useUtils();
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Form | null>(null);
  const [excluir, setExcluir] = useState<Beneficiario | null>(null);

  const listaQ = trpc.planoOdontologico.list.useQuery(
    { empresa: empresaFiltro !== "todas" ? (empresaFiltro as Empresa) : undefined, busca: busca.trim() || undefined },
    { retry: false },
  );
  const todosQ = trpc.planoOdontologico.list.useQuery(undefined, { retry: false });
  const tabelaAusente = (listaQ.error?.message || "").includes("TABELA_ODONTO_AUSENTE");
  const lista = (listaQ.data ?? []) as Beneficiario[];
  const todos = (todosQ.data ?? []) as Beneficiario[];

  const invalidar = () => { utils.planoOdontologico.list.invalidate(); };
  const createM = trpc.planoOdontologico.create.useMutation({
    onSuccess: () => { toast.success("Beneficiário incluído"); setForm(null); invalidar(); },
    onError: (e) => toast.error(e.message),
  });
  const updateM = trpc.planoOdontologico.update.useMutation({
    onSuccess: () => { toast.success("Beneficiário atualizado"); setForm(null); invalidar(); },
    onError: (e) => toast.error(e.message),
  });
  const excluirM = trpc.planoOdontologico.excluir.useMutation({
    onSuccess: (r) => { toast.success(r.excluidos.length > 1 ? `Removidos do plano: ${r.excluidos.join(", ")}` : `${r.excluidos[0]} removido(a) do plano`); setExcluir(null); invalidar(); },
    onError: (e) => toast.error(e.message),
  });

  // Agrupa por empresa → famílias (titular + dependentes)
  const porEmpresa = useMemo(() => {
    const mapa = new Map<string, Familia[]>();
    const titulares = lista.filter((b) => b.tipo === "T");
    const usados = new Set<number>();
    for (const t of titulares) {
      const deps = lista.filter((d) => d.tipo === "D" && d.titularNumeroOdontoprev === t.numeroOdontoprev);
      deps.forEach((d) => usados.add(d.id));
      const fam: Familia = { titular: t, dependentes: deps, total: t.valor + deps.reduce((a, d) => a + d.valor, 0) };
      mapa.set(t.empresa, [...(mapa.get(t.empresa) ?? []), fam]);
    }
    // Dependente cujo titular não aparece (ex.: filtro de busca) vira linha própria
    for (const d of lista.filter((b) => b.tipo === "D" && !usados.has(b.id))) {
      mapa.set(d.empresa, [...(mapa.get(d.empresa) ?? []), { titular: d, dependentes: [], total: d.valor }]);
    }
    return EMPRESAS.filter((e) => mapa.has(e)).map((e) => ({ empresa: e, familias: mapa.get(e)! }));
  }, [lista]);

  const resumo = useMemo(() => EMPRESAS.map((e) => {
    const b = todos.filter((x) => x.empresa === e);
    return { empresa: e, titulares: b.filter((x) => x.tipo === "T").length, dependentes: b.filter((x) => x.tipo === "D").length, total: b.reduce((a, x) => a + x.valor, 0) };
  }), [todos]);
  const totalGeral = resumo.reduce((a, r) => a + r.total, 0);

  const titularesDaEmpresa = (empresa: Empresa) => todos.filter((b) => b.tipo === "T" && b.empresa === empresa);

  const salvar = () => {
    if (!form) return;
    const valor = Number(form.valor.replace(/\./g, "").replace(",", "."));
    if (!form.numeroOdontoprev.trim() || !form.nome.trim()) return toast.error("Preencha o número OdontoPrev e o nome");
    if (!(valor >= 0)) return toast.error("Valor inválido");
    if (form.tipo === "D" && !form.titularNumeroOdontoprev) return toast.error("Escolha o titular do dependente");
    const dados = {
      empresa: form.empresa, numeroOdontoprev: form.numeroOdontoprev.trim(), nome: form.nome.trim(),
      cpf: form.cpf || null, tipo: form.tipo, parentesco: form.tipo === "D" ? form.parentesco : "", plano: form.plano,
      titularNumeroOdontoprev: form.tipo === "D" ? form.titularNumeroOdontoprev : null,
      dataInclusao: form.dataInclusao || null, valor,
    };
    if (form.id) updateM.mutate({ id: form.id, ...dados }); else createM.mutate(dados);
  };

  const editar = (b: Beneficiario) => setForm({
    id: b.id, empresa: b.empresa, numeroOdontoprev: b.numeroOdontoprev, nome: b.nome, cpf: b.cpf || "",
    tipo: b.tipo, parentesco: b.parentesco || "Filho/Filha", plano: b.plano === "Master" ? "Master" : "Integral DOC", titularNumeroOdontoprev: b.titularNumeroOdontoprev || "",
    dataInclusao: b.dataInclusao || "", valor: b.valor.toFixed(2).replace(".", ","),
  });

  const exportar = () => {
    const linhas = porEmpresa.flatMap(({ empresa, familias }) => familias.flatMap((f) => [f.titular, ...f.dependentes].map((b) => ({
      Empresa: EMPRESA_LABELS[empresa], "Nº OdontoPrev": b.numeroOdontoprev, Nome: b.nome, CPF: formatCPF(b.cpf),
      Tipo: b.tipo === "T" ? "Titular" : parentescoLabel(b.parentesco), Plano: b.plano,
      Titular: b.tipo === "D" ? f.titular.nome : "", Dependentes: b.tipo === "T" ? f.dependentes.length : "",
      "Data de inclusão": formatData(b.dataInclusao), "Valor (R$)": b.valor, "Total família (R$)": b.tipo === "T" ? f.total : "",
    }))));
    const ws = XLSX.utils.json_to_sheet(linhas); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plano Odontológico");
    XLSX.writeFile(wb, `plano_odontologico_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const alternar = (k: string) => setAbertas((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const Acoes = ({ b }: { b: Beneficiario }) => (
    <TableCell className="text-center whitespace-nowrap">
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={(e) => { e.stopPropagation(); editar(b); }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" title="Remover do plano"
        onClick={(e) => { e.stopPropagation(); setExcluir(b); }}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </TableCell>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)", boxShadow: "0 4px 24px oklch(0.22 0.08 250 / 0.18)",
      }}>
        <div className="px-7 py-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{
            background: "linear-gradient(135deg, oklch(0.55 0.15 200), oklch(0.48 0.16 215))", boxShadow: "0 4px 12px oklch(0.45 0.15 210 / 0.30)",
          }}>
            <Smile className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Plano Odontológico</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>OdontoPrev — titulares, dependentes e valores das 4 empresas</p>
          </div>
        </div>
      </div>

      {tabelaAusente ? (
        <Card><CardContent className="py-10 text-center space-y-2">
          <p className="font-semibold">A aba Plano Odontológico ainda está sendo preparada.</p>
          <p className="text-sm text-muted-foreground">Falta criar a tabela no banco de dados (migração <code>20261113_plano_odontologico.sql</code>). Assim que ela for aplicada, esta tela passa a funcionar.</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {resumo.map((r) => (
              <Card key={r.empresa}><CardContent className="p-4">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{EMPRESA_LABELS[r.empresa]}</p>
                <p className="text-2xl font-bold mt-1">{r.titulares + r.dependentes}</p>
                <p className="text-xs text-muted-foreground">{r.titulares} tit. · {r.dependentes} dep.</p>
                <p className="text-sm font-semibold mt-1"><PrivacyValue value={formatMoeda(r.total)} /></p>
              </CardContent></Card>
            ))}
          </div>

          <div className="rounded-xl px-5 py-4 flex items-center justify-between" style={{ background: "oklch(0.14 0.03 250)" }}>
            <div className="flex items-center gap-2 text-white text-sm">
              <Users className="w-4 h-4" />
              <span className="font-semibold">{todos.length}</span> beneficiários ·
              <span className="font-semibold">{todos.filter((b) => b.tipo === "T").length}</span> titulares ·
              <span className="font-semibold">{todos.filter((b) => b.tipo === "D").length}</span> dependentes
            </div>
            <div className="text-right">
              <p className="text-[11px]" style={{ color: "oklch(0.65 0.008 240)" }}>Total mensal</p>
              <p className="text-xl font-bold" style={{ color: "oklch(0.70 0.15 210)" }}><PrivacyValue value={formatMoeda(totalGeral)} /></p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome, nº OdontoPrev ou CPF..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{EMPRESA_LABELS[e]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportar} disabled={!lista.length}><Download className="w-4 h-4 mr-1" />Exportar Excel</Button>
            <Button size="sm" onClick={() => setForm(formVazio())}><Plus className="w-4 h-4 mr-1" />Novo Beneficiário</Button>
          </div>

          {listaQ.isLoading ? <Skeleton className="h-40 w-full" /> : porEmpresa.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {busca || empresaFiltro !== "todas" ? "Nenhum beneficiário encontrado." : "Nenhum beneficiário cadastrado ainda. Use “Novo Beneficiário” para incluir."}
            </CardContent></Card>
          ) : porEmpresa.map(({ empresa, familias }) => {
            const nTit = familias.filter((f) => f.titular.tipo === "T").length;
            const nDep = familias.reduce((a, f) => a + f.dependentes.length + (f.titular.tipo === "D" ? 1 : 0), 0);
            const total = familias.reduce((a, f) => a + f.total, 0);
            return (
              <Card key={empresa} className="overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between bg-muted/50 border-b">
                  <p className="font-semibold">{EMPRESA_LABELS[empresa]}</p>
                  <p className="text-sm text-muted-foreground">{nTit} titulares · {nDep} dep. · <span className="font-semibold text-amber-700"><PrivacyValue value={formatMoeda(total)} /></span></p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Nº OdontoPrev</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden md:table-cell">CPF</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-center">Dependentes</TableHead>
                        <TableHead>Data de inclusão</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Total família</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {familias.map((f) => {
                        const k = `${empresa}-${f.titular.id}`; const aberta = abertas.has(k); const temDep = f.dependentes.length > 0;
                        return [
                          <TableRow key={k} className={temDep ? "cursor-pointer" : ""} onClick={() => temDep && alternar(k)}>
                            <TableCell>{temDep ? (aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}</TableCell>
                            <TableCell className="font-mono text-xs">{f.titular.numeroOdontoprev}</TableCell>
                            <TableCell className="font-medium whitespace-normal break-words">{f.titular.nome}</TableCell>
                            <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground whitespace-nowrap">{formatCPF(f.titular.cpf)}</TableCell>
                            <TableCell className="text-center">
                              {f.titular.tipo === "T"
                                ? <Badge className="text-xs border-0" style={{ background: "oklch(0.20 0.08 252)", color: "white" }}>Titular</Badge>
                                : <Badge variant="outline" className="text-xs">{parentescoLabel(f.titular.parentesco)}</Badge>}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{f.titular.plano}</TableCell>
                            <TableCell className="text-center">{f.titular.tipo === "T" ? (temDep ? <Badge variant="secondary">{f.dependentes.length}</Badge> : "0") : "—"}</TableCell>
                            <TableCell className="text-sm">{formatData(f.titular.dataInclusao)}</TableCell>
                            <TableCell className="text-right font-semibold text-sm"><PrivacyValue value={formatMoeda(f.titular.valor)} /></TableCell>
                            <TableCell className="text-right text-sm font-semibold text-amber-700"><PrivacyValue value={formatMoeda(f.total)} /></TableCell>
                            <Acoes b={f.titular} />
                          </TableRow>,
                          ...(aberta ? f.dependentes.map((d) => (
                            <TableRow key={`d-${d.id}`} className="bg-muted/30">
                              <TableCell />
                              <TableCell className="font-mono text-xs pl-6">{d.numeroOdontoprev}</TableCell>
                              <TableCell className="text-sm pl-6 whitespace-normal break-words">{d.nome}</TableCell>
                              <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground whitespace-nowrap">{formatCPF(d.cpf)}</TableCell>
                              <TableCell className="text-center"><Badge variant="outline" className="text-xs">{parentescoLabel(d.parentesco)}</Badge></TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{d.plano}</TableCell>
                              <TableCell className="text-center text-muted-foreground">—</TableCell>
                              <TableCell className="text-sm">{formatData(d.dataInclusao)}</TableCell>
                              <TableCell className="text-right font-semibold text-sm"><PrivacyValue value={formatMoeda(d.valor)} /></TableCell>
                              <TableCell />
                              <Acoes b={d} />
                            </TableRow>
                          )) : []),
                        ];
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            );
          })}
        </>
      )}

      <Dialog open={form !== null} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Editar beneficiário" : "Novo beneficiário"} — Plano Odontológico</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Empresa</Label>
                <Select value={form.empresa} onValueChange={(v) => setForm({ ...form, empresa: v as Empresa, titularNumeroOdontoprev: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map((e) => <SelectItem key={e} value={e}>{EMPRESA_LABELS[e]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as "T" | "D" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="T">Titular</SelectItem><SelectItem value="D">Dependente</SelectItem></SelectContent>
                </Select>
              </div>
              {form.tipo === "D" && (<>
                <div className="space-y-1 col-span-2">
                  <Label>Titular</Label>
                  <Select value={form.titularNumeroOdontoprev} onValueChange={(v) => setForm({ ...form, titularNumeroOdontoprev: v })}>
                    <SelectTrigger><SelectValue placeholder="Escolha o titular" /></SelectTrigger>
                    <SelectContent>
                      {titularesDaEmpresa(form.empresa).map((t) => <SelectItem key={t.id} value={t.numeroOdontoprev}>{t.nome} — {t.numeroOdontoprev}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Parentesco</Label>
                  <Select value={form.parentesco} onValueChange={(v) => setForm({ ...form, parentesco: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PARENTESCOS.map((p) => <SelectItem key={p} value={p}>{parentescoLabel(p)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>)}
              <div className="space-y-1 col-span-2">
                <Label>Plano</Label>
                <Select value={form.plano} onValueChange={(v) => setForm({ ...form, plano: v as "Integral DOC" | "Master" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Integral DOC">Integral DOC</SelectItem><SelectItem value="Master">Master</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Nº OdontoPrev</Label>
                <Input value={form.numeroOdontoprev} onChange={(e) => setForm({ ...form, numeroOdontoprev: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Nome completo</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data de inclusão</Label>
                <Input type="date" value={form.dataInclusao} onChange={(e) => setForm({ ...form, dataInclusao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" inputMode="decimal" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={createM.isPending || updateM.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={excluir !== null} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do plano odontológico?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.tipo === "T"
                ? <>O titular <strong>{excluir?.nome}</strong> sai do plano junto com os dependentes dele. O histórico fica guardado.</>
                : <>O dependente <strong>{excluir?.nome}</strong> sai do plano; o titular continua. O histórico fica guardado.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={excluirM.isPending}
              onClick={() => excluir && excluirM.mutate({ id: excluir.id })}>Remover do plano</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
