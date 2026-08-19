import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PrivacyValue } from "@/components/PrivacyValue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Laptop, Baby, Award, Search, CheckCircle, Clock, XCircle,
  AlertTriangle, Bell, DollarSign, Users, Gift, Edit2, Pencil,
} from "lucide-react";

const EMPRESAS = ["FREIRE", "JOANES", "SUDOESTE", "SOLAR"] as const;
const SALARIO_BASE_CRECHE = 1685.93;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateNasc(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return new Date(d);
  const s = String(d);
  return new Date(s.includes("T") ? s : s + "T12:00:00");
}
function calcAnosCompletos(d: Date | string | null | undefined): number | null {
  const dt = toDateNasc(d);
  if (!dt || isNaN(dt.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - dt.getFullYear();
  const m = hoje.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dt.getDate())) anos--;
  return anos;
}
function calcValorCreche(d: Date | string | null | undefined): number | null {
  const anos = calcAnosCompletos(d);
  if (anos === null || anos > 5) return null;
  return anos >= 2
    ? Math.round(SALARIO_BASE_CRECHE * 0.20 * 100) / 100
    : Math.round(SALARIO_BASE_CRECHE * 0.30 * 100) / 100;
}
function labelFaixaCreche(d: Date | string | null | undefined): string {
  const anos = calcAnosCompletos(d);
  if (anos === null) return "";
  if (anos > 5) return "Fora da faixa (>5 anos)";
  return anos >= 2 ? "20% — 2a1d a 5 anos" : "30% — 0 a 2 anos";
}
function calcIdade(d: Date | string | null | undefined): number | null {
  const dt = toDateNasc(d);
  if (!dt || isNaN(dt.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - dt.getFullYear();
  const m = hoje.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dt.getDate())) idade--;
  return idade;
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = toDateNasc(d);
  if (!dt || isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}
function fmtMoeda(v: number | string | null | undefined) {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function Initials({ nome }: { nome: string }) {
  const parts = (nome ?? "?").trim().split(" ");
  const ini = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0][0];
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))" }}
    >
      {ini.toUpperCase()}
    </div>
  );
}
function EmpresaBadge({ empresa }: { empresa: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap"
      style={{ background: "oklch(0.97 0.02 245)", color: "oklch(0.4 0.1 245)" }}
    >
      {empresa}
    </span>
  );
}
type AbaId = "notebook" | "creche" | "bonus";

// ─── Aba Auxílio Notebook ─────────────────────────────────────────────────────
function AbaNotebook({ empresa, busca }: { empresa: string; busca: string }) {
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    nomeColaborador: "", empresa: "", tipo: "incluir" as "incluir" | "excluir",
    dataInicio: "", valor: "150.00",
  });
  const utils = trpc.useUtils();
  const editar = trpc.auxiliosBonus.updateNotebook.useMutation({
    onSuccess: () => { utils.auxiliosBonus.notebookAtivos.invalidate(); toast.success("Registro atualizado!"); setEditItem(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const openEdit = (r: any) => {
    setEditItem(r);
    const di = r.dataInicio
      ? (typeof r.dataInicio === "string" ? r.dataInicio.slice(0, 10) : new Date(r.dataInicio).toISOString().slice(0, 10))
      : "";
    setEditForm({ nomeColaborador: r.nomeColaborador ?? "", empresa: r.empresa, tipo: r.tipo ?? "incluir", dataInicio: di, valor: String(r.valor ?? "150.00") });
  };
  const { data, isLoading } = trpc.auxiliosBonus.notebookAtivos.useQuery({
    empresa: empresa || undefined,
    busca: busca || undefined,
  });
  const total = data?.length ?? 0;
  const totalValor = data?.reduce((a, r) => a + Number(r.valor ?? 150), 0) ?? 0;
  // Agrupar por empresa
  const porEmpresa = data ? (() => {
    const map = new Map<string, typeof data>();
    for (const r of data) {
      const key = r.empresa;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })() : [];
  return (
    <div className="space-y-5">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-black text-foreground">{total}</p>
          <p className="text-xs font-medium text-muted-foreground mt-1">Beneficiários</p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-black text-foreground leading-tight"><PrivacyValue value={fmtMoeda(totalValor)} iconSize={14} /></p>
          <p className="text-xs font-medium text-muted-foreground mt-1">Total Mensal</p>
        </div>
      </div>
      {/* Tabela */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Laptop className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-foreground">
            Colaboradores com Auxílio Notebook {data ? `(${data.length})` : ""}
          </span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Laptop className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-base font-bold text-foreground">Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Colaborador</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Empresa</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Valor Mensal</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {porEmpresa.map(([emp, rows]) => {
                  const subtotal = rows.reduce((a, r) => a + Number(r.valor ?? 150), 0);
                  return (
                    <>
                      {/* Linha de cabeçalho da empresa */}
                      <tr key={`emp-${emp}`} style={{ background: "oklch(0.94 0.01 245)" }}>
                        <td colSpan={4} className="px-5 py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                              <span className="text-xs font-bold uppercase tracking-wider text-foreground">{emp}</span>
                              <span className="text-xs text-muted-foreground">({rows.length} {rows.length === 1 ? "colaborador" : "colaboradores"})</span>
                            </div>
                            <PrivacyValue value={fmtMoeda(subtotal)} className="text-xs font-bold text-blue-700 font-mono whitespace-nowrap" iconSize={11} />
                          </div>
                        </td>
                      </tr>
                      {/* Linhas dos colaboradores */}
                      {rows.map((r, i) => (
                        <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                          <td className="px-5 py-3.5 pl-8">
                            <div className="flex items-center gap-3">
                              <Initials nome={r.nomeColaborador ?? "?"} />
                              <span className="font-semibold text-foreground">{r.nomeColaborador ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5"><EmpresaBadge empresa={r.empresa} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-emerald-100 font-mono whitespace-nowrap">
                              {fmtMoeda(r.valor ?? 150)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Button size="icon" variant="ghost" className="w-8 h-8 hover:bg-blue-50 hover:text-blue-600" title="Editar" onClick={() => openEdit(r)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal Editar */}
      <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" /> Editar — Auxílio Notebook
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do Colaborador</label>
              <Input value={editForm.nomeColaborador} onChange={e => setEditForm(f => ({ ...f, nomeColaborador: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
                <Select value={editForm.empresa} onValueChange={v => setEditForm(f => ({ ...f, empresa: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
                <Input type="number" step="0.01" value={editForm.valor} onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button size="sm"
              onClick={() => editItem && editar.mutate({
                id: editItem.id,
                nomeColaborador: editForm.nomeColaborador,
                empresa: editForm.empresa as any,
                tipo: editForm.tipo,
                dataInicio: editForm.dataInicio,
                valor: parseFloat(editForm.valor) || 150,
              })}
              disabled={editar.isPending}
            >
              {editar.isPending && <Spinner className="w-3 h-3 mr-1" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Aba Auxílio Creche ───────────────────────────────────────────────────────
function AbaCreche({ empresa, busca }: { empresa: string; busca: string }) {
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    nomeColaborador: "", empresa: "", tipo: "incluir" as "incluir" | "excluir",
    nomeFilho: "", dataNascimentoFilho: "", valor: "",
  });
  const utils = trpc.useUtils();
  const editar = trpc.auxiliosBonus.updateCreche.useMutation({
    onSuccess: () => { utils.auxiliosBonus.crecheAtivos.invalidate(); toast.success("Registro atualizado!"); setEditItem(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const openEditCreche = (r: any) => {
    setEditItem(r);
    const dn = r.dataNascimentoFilho
      ? (typeof r.dataNascimentoFilho === "string" ? r.dataNascimentoFilho.slice(0, 10) : new Date(r.dataNascimentoFilho).toISOString().slice(0, 10))
      : "";
    setEditForm({
      nomeColaborador: r.nomeColaborador ?? "", empresa: r.empresa,
      tipo: r.tipo ?? "incluir", nomeFilho: r.nomeFilho ?? "", dataNascimentoFilho: dn, valor: String(r.valor ?? ""),
    });
  };
  const { data, isLoading } = trpc.auxiliosBonus.crecheAtivos.useQuery({
    empresa: empresa || undefined,
    busca: busca || undefined,
  });
  const total = data?.length ?? 0;
  const totalValor = data?.reduce((a, r) => {
    const v = calcValorCreche(r.dataNascimentoFilho as any);
    return a + (v ?? 0);
  }, 0) ?? 0;
  // Agrupar por empresa
  const porEmpresaCreche = data ? (() => {
    const map = new Map<string, typeof data>();
    for (const r of data) {
      const key = r.empresa;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })() : [];
  return (
    <div className="space-y-5">
      {/* Regra visual */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex flex-wrap gap-6">
        <span className="text-xs text-blue-700">
          <strong>0 a 2 anos:</strong> 30% × R$ 1.685,93 = <span className="font-mono font-bold">R$ 505,78</span>
        </span>
        <span className="text-xs text-blue-700">
          <strong>2a1d a 5 anos:</strong> 20% × R$ 1.685,93 = <span className="font-mono font-bold">R$ 337,19</span>
        </span>
      </div>
      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#fdf4ff", border: "1px solid #e9d5ff" }}>
            <Baby className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-foreground">{total}</p>
          <p className="text-xs font-medium text-muted-foreground mt-1">Beneficiários</p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-black text-foreground leading-tight"><PrivacyValue value={fmtMoeda(totalValor)} iconSize={14} /></p>
          <p className="text-xs font-medium text-muted-foreground mt-1">Total Mensal</p>
        </div>
      </div>
      {/* Tabela */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Baby className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-bold text-foreground">
            Colaboradores com Auxílio Creche {data ? `(${data.length})` : ""}
          </span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Baby className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-base font-bold text-foreground">Nenhum colaborador encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Colaborador</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Filho(a)</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Idade</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Nasc.</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Valor Mensal</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {porEmpresaCreche.map(([emp, rows]) => {
                  const subtotal = rows.reduce((a, r) => a + (calcValorCreche(r.dataNascimentoFilho as any) ?? 0), 0);
                  return (
                    <>
                      {/* Linha de cabeçalho da empresa */}
                      <tr key={`emp-creche-${emp}`} style={{ background: "oklch(0.94 0.01 245)" }}>
                        <td colSpan={7} className="px-5 py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                              <span className="text-xs font-bold uppercase tracking-wider text-foreground">{emp}</span>
                              <span className="text-xs text-muted-foreground">({rows.length} {rows.length === 1 ? "colaborador" : "colaboradores"})</span>
                            </div>
                            <PrivacyValue value={fmtMoeda(subtotal)} className="text-xs font-bold text-blue-700 font-mono whitespace-nowrap" iconSize={11} />
                          </div>
                        </td>
                      </tr>
                      {rows.map((r, i) => {
                        const idade = calcIdade(r.dataNascimentoFilho);
                        const valorCalc = calcValorCreche(r.dataNascimentoFilho as any);
                        const faixa = labelFaixaCreche(r.dataNascimentoFilho as any);
                        return (
                          <tr key={r.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                            <td className="px-5 py-3.5 pl-8">
                              <div className="flex items-center gap-3">
                                <Initials nome={r.nomeColaborador ?? "?"} />
                                <span className="font-semibold text-foreground">{r.nomeColaborador ?? "—"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5"><EmpresaBadge empresa={r.empresa} /></td>
                            <td className="px-4 py-3.5 font-medium text-foreground">{r.nomeFilho}</td>
                            <td className="px-4 py-3.5 text-center">
                              {idade !== null ? (
                                <Badge className={`text-xs ${idade >= 5 ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border"}`}>
                                  {idade} {idade === 1 ? "ano" : "anos"}
                                </Badge>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3.5 text-muted-foreground text-xs">{fmtDate(r.dataNascimentoFilho)}</td>
                            <td className="px-5 py-3.5 text-right">
                              {valorCalc !== null ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="font-bold text-foreground font-mono whitespace-nowrap">{fmtMoeda(valorCalc)}</span>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{faixa}</span>
                                </div>
                              ) : r.dataNascimentoFilho ? (
                                <span className="text-[10px] text-blue-600 font-medium">Fora da faixa (&gt;5 anos)</span>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">Sem data nasc.</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <Button size="icon" variant="ghost" className="w-8 h-8 hover:bg-purple-50 hover:text-purple-600" title="Editar" onClick={() => openEditCreche(r)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal Editar Creche */}
      <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" /> Editar — Auxílio Creche
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do Colaborador</label>
              <Input value={editForm.nomeColaborador} onChange={e => setEditForm(f => ({ ...f, nomeColaborador: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
              <Select value={editForm.empresa} onValueChange={v => setEditForm(f => ({ ...f, empresa: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do Filho</label>
              <Input value={editForm.nomeFilho} onChange={e => setEditForm(f => ({ ...f, nomeFilho: e.target.value }))} placeholder="Nome completo do filho" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de Nascimento</label>
                <Input type="date" value={editForm.dataNascimentoFilho} onChange={e => {
                  const dn = e.target.value;
                  const valorAuto = dn ? calcValorCreche(dn) : null;
                  setEditForm(f => ({ ...f, dataNascimentoFilho: dn, valor: valorAuto != null ? String(valorAuto) : f.valor }));
                }} />
                {editForm.dataNascimentoFilho && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {calcIdade(editForm.dataNascimentoFilho)} anos — {labelFaixaCreche(editForm.dataNascimentoFilho)}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Valor <span className="text-[10px] text-blue-600">auto</span>
                </label>
                <Input type="number" step="0.01" value={editForm.valor} onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button size="sm"
              onClick={() => {
                if (!editItem) return;
                const valorCalc = editForm.dataNascimentoFilho ? calcValorCreche(editForm.dataNascimentoFilho) : null;
                const valorFinal = editForm.valor ? parseFloat(editForm.valor) : valorCalc;
                editar.mutate({
                  id: editItem.id,
                  nomeColaborador: editForm.nomeColaborador,
                  empresa: editForm.empresa as any,
                  tipo: editForm.tipo,
                  nomeFilho: editForm.nomeFilho,
                  dataNascimentoFilho: editForm.dataNascimentoFilho || undefined,
                  valor: valorFinal ?? undefined,
                });
              }}
              disabled={editar.isPending}
            >
              {editar.isPending && <Spinner className="w-3 h-3 mr-1" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Aba Bônus por Indicação ──────────────────────────────────────────────────
const STATUS_TABS = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Pendentes" },
  { key: "pago", label: "Pagos" },
  { key: "cancelado", label: "Cancelados" },
];
function AbaBonus({ empresa, busca }: { empresa: string; busca: string }) {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    nomeIndicador: "", nomeIndicado: "", empresa: "",
    dataAdmissaoIndicado: "", valorBonus: "1000.00", observacao: "",
  });
  const [modalPagar, setModalPagar] = useState<any | null>(null);
  const [formPagar, setFormPagar] = useState({ dataPagamentoEfetivo: "", observacao: "" });
  const utils = trpc.useUtils();
  const editarBonus = trpc.auxiliosBonus.updateBonus.useMutation({
    onSuccess: () => { utils.auxiliosBonus.bonusPanel.invalidate(); toast.success("Bônus atualizado!"); setEditItem(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const pagar = trpc.auxiliosBonus.updateBonusStatus.useMutation({
    onSuccess: () => { utils.auxiliosBonus.bonusPanel.invalidate(); toast.success("Pagamento confirmado!"); setModalPagar(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const { data, isLoading } = trpc.auxiliosBonus.bonusPanel.useQuery({
    empresa: empresa || undefined,
    status: filtroStatus === "todos" ? undefined : filtroStatus,
    busca: busca || undefined,
  });
  const prontos = data?.filter((r: any) => r.prontoParaPagar && r.status === "pendente").length ?? 0;
  const totalPendente = data?.filter((r: any) => r.status === "pendente").reduce((a: number, r: any) => a + Number(r.valorBonus ?? 0), 0) ?? 0;
  const openEditBonus = (r: any) => {
    setEditItem(r);
    const da = r.dataAdmissaoIndicado
      ? (typeof r.dataAdmissaoIndicado === "string" ? r.dataAdmissaoIndicado.slice(0, 10) : new Date(r.dataAdmissaoIndicado).toISOString().slice(0, 10))
      : "";
    setEditForm({ nomeIndicador: r.nomeIndicador ?? "", nomeIndicado: r.nomeIndicado ?? "", empresa: r.empresa, dataAdmissaoIndicado: da, valorBonus: String(r.valorBonus ?? "1000.00"), observacao: r.observacao ?? "" });
  };
  return (
    <div className="space-y-5">
      {/* Alerta prontos */}
      {prontos > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <Bell className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-700">
            <strong>{prontos}</strong> {prontos === 1 ? "bônus está pronto" : "bônus estão prontos"} para pagamento (3 meses de empresa cumpridos).
          </p>
        </div>
      )}
      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <p className={`text-3xl font-black ${prontos > 0 ? "text-blue-600" : "text-foreground"}`}>{prontos}</p>
          <p className="text-xs font-medium text-muted-foreground mt-1">Prontos para Pagar</p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-black text-foreground leading-tight"><PrivacyValue value={fmtMoeda(totalPendente)} iconSize={14} /></p>
          <p className="text-xs font-medium text-muted-foreground mt-1">Total Pendente</p>
        </div>
        <div className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <Gift className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-black text-foreground">{data?.length ?? 0}</p>
          <p className="text-xs font-medium text-muted-foreground mt-1">Total Registros</p>
        </div>
      </div>
      {/* Filtro status */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {STATUS_TABS.map(s => (
          <button
            key={s.key}
            onClick={() => setFiltroStatus(s.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${filtroStatus === s.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {/* Tabela */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-2">
          <Award className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-foreground">
            Bônus por Indicação {data ? `(${data.length})` : ""}
          </span>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-base font-bold text-foreground">Nenhum bônus encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Indicador</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Indicado</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Admissão</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Pgto. Previsto</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Situação</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Valor</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: any, i: number) => {
                  const isPronto = r.prontoParaPagar;
                  const isPago = r.status === "pago";
                  const isCancelado = r.status === "cancelado";
                  return (
                    <tr key={r.id} className={`border-b border-border/40 last:border-0 transition-colors ${isPago ? "opacity-60" : ""} ${isPronto && !isPago ? "bg-blue-50/40" : i % 2 !== 0 ? "bg-muted/10" : ""} hover:bg-muted/20`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Initials nome={r.nomeIndicador ?? "?"} />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-semibold text-foreground max-w-[140px] truncate block cursor-default">{r.nomeIndicador ?? "—"}</span>
                              </TooltipTrigger>
                              <TooltipContent>{r.nomeIndicador}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-foreground max-w-[140px] truncate block cursor-default">{r.nomeIndicado ?? "—"}</span>
                            </TooltipTrigger>
                            <TooltipContent>{r.nomeIndicado}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-4 py-3.5"><EmpresaBadge empresa={r.empresa} /></td>
                      <td className="px-4 py-3.5 text-muted-foreground">{fmtDate(r.dataAdmissaoIndicado)}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{fmtDate(r.dataPagamentoPrevisto)}</td>
                      <td className="px-4 py-3.5 text-center">
                        {isPago ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Pago</Badge>
                        ) : isCancelado ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Cancelado</Badge>
                        ) : isPronto ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Pronto
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Aguardando
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-bold text-foreground font-mono whitespace-nowrap">{fmtMoeda(r.valorBonus)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isPago ? (
                          <span className="text-xs text-muted-foreground">{fmtDate(r.dataPagamentoEfetivo)}</span>
                        ) : isCancelado ? (
                          <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                            onClick={() => { setModalPagar(r); setFormPagar({ dataPagamentoEfetivo: new Date().toISOString().slice(0, 10), observacao: "" }); }}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Pagar
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Button size="icon" variant="ghost" className="w-8 h-8 hover:bg-blue-50 hover:text-blue-600" title="Editar" onClick={() => openEditBonus(r)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal Editar Bônus */}
      <Dialog open={editItem !== null} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" /> Editar — Bônus por Indicação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Indicador</label>
                <Input value={editForm.nomeIndicador} onChange={e => setEditForm(f => ({ ...f, nomeIndicador: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Indicado</label>
                <Input value={editForm.nomeIndicado} onChange={e => setEditForm(f => ({ ...f, nomeIndicado: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
                <Select value={editForm.empresa} onValueChange={v => setEditForm(f => ({ ...f, empresa: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de Admissão</label>
                <Input type="date" value={editForm.dataAdmissaoIndicado} onChange={e => setEditForm(f => ({ ...f, dataAdmissaoIndicado: e.target.value }))} />
              </div>
            </div>
            {editForm.dataAdmissaoIndicado && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Pagamento previsto: {(() => {
                  const [y, m, d] = editForm.dataAdmissaoIndicado.split("-").map(Number);
                  const dt = new Date(Date.UTC(y, m - 1 + 3, d));
                  return dt.toLocaleDateString("pt-BR");
                })()} (3 meses após admissão)
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor do Bônus (R$)</label>
              <Input type="number" step="0.01" value={editForm.valorBonus} onChange={e => setEditForm(f => ({ ...f, valorBonus: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação</label>
              <Input value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button size="sm"
              onClick={() => editItem && editarBonus.mutate({
                id: editItem.id,
                nomeIndicador: editForm.nomeIndicador,
                nomeIndicado: editForm.nomeIndicado,
                empresa: editForm.empresa as any,
                dataAdmissaoIndicado: editForm.dataAdmissaoIndicado,
                valorBonus: parseFloat(editForm.valorBonus) || 1000,
                observacao: editForm.observacao || undefined,
              })}
              disabled={editarBonus.isPending}
            >
              {editarBonus.isPending && <Spinner className="w-3 h-3 mr-1" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal pagar */}
      <Dialog open={modalPagar !== null} onOpenChange={() => setModalPagar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" /> Confirmar Pagamento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirmar pagamento do bônus de <strong className="text-foreground">{modalPagar?.nomeIndicado}</strong>?
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data do Pagamento</label>
              <Input type="date" value={formPagar.dataPagamentoEfetivo} onChange={e => setFormPagar(f => ({ ...f, dataPagamentoEfetivo: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação</label>
              <Input value={formPagar.observacao} onChange={e => setFormPagar(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional..." />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setModalPagar(null)}>Cancelar</Button>
            <Button size="sm"
              onClick={() => modalPagar && pagar.mutate({ id: modalPagar.id, status: "pago", ...formPagar })}
              disabled={pagar.isPending}
            >
              {pagar.isPending ? <Spinner className="w-3 h-3 mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
              Confirmar Pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AuxiliosBonusPanel() {
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("notebook");
  const [empresa, setEmpresa] = useState("");
  const [busca, setBusca] = useState("");
  const ABAS: { id: AbaId; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "notebook", label: "Auxílio Notebook", icon: <Laptop className="w-4 h-4" />, color: "text-blue-600" },
    { id: "creche", label: "Auxílio Creche", icon: <Baby className="w-4 h-4" />, color: "text-purple-600" },
    { id: "bonus", label: "Bônus por Indicação", icon: <Award className="w-4 h-4" />, color: "text-blue-600" },
  ];
  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="px-6 pt-6 pb-0">
        <div className="rounded-2xl overflow-hidden" style={{
          background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
          border: "1px solid oklch(0.25 0.09 252)",
          boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)",
        }}>
          <div className="px-7 py-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white leading-none tracking-tight">Auxílios & Bônus</h1>
              <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>
                Visão consolidada de beneficiários e bônus por indicação
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Filtros globais */}
      <div className="px-6 pt-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador..." className="pl-9" />
          </div>
          <Select value={empresa || "todas"} onValueChange={v => setEmpresa(v === "todas" ? "" : v)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Tabs */}
      <div className="px-6 pt-5">
        <div className="flex gap-1 border-b border-border">
          {ABAS.map(aba => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                abaAtiva === aba.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <span className={abaAtiva === aba.id ? aba.color : ""}>{aba.icon}</span>
              {aba.label}
            </button>
          ))}
        </div>
      </div>
      {/* Conteúdo */}
      <div className="px-6 py-6">
        {abaAtiva === "notebook" && <AbaNotebook empresa={empresa} busca={busca} />}
        {abaAtiva === "creche" && <AbaCreche empresa={empresa} busca={busca} />}
        {abaAtiva === "bonus" && <AbaBonus empresa={empresa} busca={busca} />}
      </div>
    </div>
  );
}
