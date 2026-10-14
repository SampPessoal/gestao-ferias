/**
 * Registro de Empregado — campos complementares da Ficha de Registro.
 * Os campos vêm da definição única em shared/registroEmpregado.ts.
 */
import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2, Users, Laptop, Check, X } from "lucide-react";
import {
  CAMPOS_REGISTRO, GRUPOS_REGISTRO, PARENTESCOS, rotuloOpcao,
  type CampoRegistro, type Dependente, type GrupoRegistro,
} from "@shared/registroEmpregado";

const AZUL = "oklch(0.35 0.09 255)";
const ABAS: { id: GrupoRegistro | "dependentes"; titulo: string }[] = [
  ...GRUPOS_REGISTRO.map(g => ({ id: g.id, titulo: g.titulo })),
  { id: "dependentes", titulo: "Dependentes" },
];

const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Mensagem legível de um erro do servidor (a validação devolve uma lista em JSON). */
function msgErro(e: { message?: string }, padrao: string): string {
  const m = e.message ?? "";
  if (m.trim().startsWith("[")) {
    try {
      const lista = JSON.parse(m) as { message?: string }[];
      const primeira = lista.find(x => x.message)?.message;
      if (primeira) return primeira;
    } catch { /* usa a mensagem original */ }
  }
  return m || padrao;
}
const fmtCpf = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
const fmtCnpj = (v: string) => {
  const d = soDigitos(v).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};
const dataBR = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");
const moedaBR = (v: string | null | undefined) =>
  v ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
const idade = (iso: string | null) => {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  const h = new Date();
  let i = h.getFullYear() - a;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) i--;
  return i;
};

/** Valor de um campo como texto para leitura. */
function exibir(c: CampoRegistro, v: string | null | undefined): string {
  if (!v) return "";
  if (c.tipo === "opcao") return rotuloOpcao(c, v);
  if (c.tipo === "data") return dataBR(v);
  if (c.tipo === "moeda") return moedaBR(v);
  if (c.tipo === "cpf") return fmtCpf(v);
  if (c.tipo === "cnpj") return fmtCnpj(v);
  return v;
}

// ─── Entrada de um campo ─────────────────────────────────────────────────────

function Segmentado({ campo, valor, onChange }: { campo: CampoRegistro; valor: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={campo.rotulo}
      className="inline-flex flex-wrap gap-1 rounded-lg p-1" style={{ background: "oklch(0.965 0.006 255)" }}>
      {campo.opcoes!.map(o => {
        const ativo = valor === o.valor;
        return (
          <button key={o.valor} type="button" role="radio" aria-checked={ativo}
            onClick={() => onChange(ativo ? "" : o.valor)}
            className="h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={ativo
              ? { background: "white", color: AZUL, boxShadow: "0 1px 2px oklch(0.2 0.03 255 / 0.18)" }
              : { color: "oklch(0.45 0.02 255)" }}>
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

function Entrada({ campo, valor, onChange }: { campo: CampoRegistro; valor: string; onChange: (v: string) => void }) {
  if (campo.tipo === "opcao") {
    if (campo.opcoes!.length <= 5) return <Segmentado campo={campo} valor={valor} onChange={onChange} />;
    return (
      <Select value={valor || "__vazio"} onValueChange={v => onChange(v === "__vazio" ? "" : v)}>
        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent className="max-h-64">
          <SelectItem value="__vazio">Não informado</SelectItem>
          {campo.opcoes!.map(o => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  const comum = { className: "h-9 text-sm", value: valor, placeholder: campo.dica, "aria-label": campo.rotulo };
  switch (campo.tipo) {
    case "data": return <Input type="date" {...comum} onChange={e => onChange(e.target.value)} />;
    case "hora": return <Input type="time" {...comum} onChange={e => onChange(e.target.value)} />;
    case "email": return <Input type="email" {...comum} placeholder="nome@exemplo.com" onChange={e => onChange(e.target.value)} />;
    case "cpf": return <Input inputMode="numeric" {...comum} placeholder="000.000.000-00" onChange={e => onChange(fmtCpf(e.target.value))} />;
    case "cnpj": return <Input inputMode="numeric" {...comum} placeholder="00.000.000/0000-00" onChange={e => onChange(fmtCnpj(e.target.value))} />;
    case "moeda":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
          <Input inputMode="decimal" {...comum} className="h-9 pl-9 text-sm tabular-nums" placeholder="0,00"
            onChange={e => onChange(e.target.value.replace(/[^\d,]/g, ""))} />
        </div>
      );
    default: return <Input {...comum} maxLength={campo.max} onChange={e => onChange(e.target.value)} />;
  }
}

// ─── Grupo de campos (leitura e edição) ──────────────────────────────────────

function GrupoCampos({ grupo, campos, colaboradorId, notebook }: {
  grupo: GrupoRegistro;
  campos: Record<string, string | null>;
  colaboradorId: number;
  notebook: { ativo: boolean; valor: string | null; desde: string | null } | null;
}) {
  const utils = trpc.useUtils();
  const lista = CAMPOS_REGISTRO.filter(c => c.grupo === grupo);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const salvar = trpc.registroEmpregado.salvar.useMutation({
    onSuccess: () => {
      toast.success("Registro de empregado salvo.");
      utils.registroEmpregado.get.invalidate({ colaboradorId });
      setEditando(false);
    },
    onError: e => toast.error(msgErro(e, "Não foi possível salvar.")),
  });

  function iniciar() {
    setForm(Object.fromEntries(lista.map(c => {
      const v = campos[c.chave] ?? "";
      return [c.chave, c.tipo === "moeda" && v ? Number(v).toFixed(2).replace(".", ",")
        : c.tipo === "cpf" ? fmtCpf(v) : c.tipo === "cnpj" ? fmtCnpj(v) : v];
    })));
    setEditando(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{GRUPOS_REGISTRO.find(g => g.id === grupo)?.descricao}</p>
        {editando ? (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={salvar.isPending} className="gap-1.5">
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <Button size="sm" disabled={salvar.isPending} className="gap-1.5"
              onClick={() => salvar.mutate({ colaboradorId, campos: form })}>
              <Check className="h-4 w-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={iniciar} className="shrink-0 gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map(c => {
          const v = exibir(c, campos[c.chave]);
          return (
            <div key={c.chave} className={c.largo ? "sm:col-span-2" : undefined}>
              <dt className="mb-1 text-[13px] text-muted-foreground">{c.rotulo}</dt>
              <dd>
                {editando
                  ? <Entrada campo={c} valor={form[c.chave] ?? ""} onChange={nv => setForm(f => ({ ...f, [c.chave]: nv }))} />
                  : v
                    ? <span className="text-sm font-medium text-foreground">{v}</span>
                    : <span className="text-sm text-muted-foreground/50">Não informado</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      {grupo === "beneficios" && (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-border px-3.5 py-3">
          <Laptop className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm">
            <span className="font-medium">Auxílio notebook: </span>
            {notebook
              ? notebook.ativo
                ? `ativo desde ${dataBR(notebook.desde)}, ${moedaBR(notebook.valor)} por mês`
                : `encerrado em ${dataBR(notebook.desde)}`
              : "sem registro"}
            <span className="text-muted-foreground"> — vem da Movimentação do Mês</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Dependentes ─────────────────────────────────────────────────────────────

const DEP_VAZIO = { nome: "", parentesco: "filho", dataNascimento: "", cpf: "", rg: "", dependenteIR: false };

function DependentesLista({ colaboradorId, dependentes }: { colaboradorId: number; dependentes: Dependente[] }) {
  const utils = trpc.useUtils();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<typeof DEP_VAZIO & { id?: number }>(DEP_VAZIO);
  const [remover, setRemover] = useState<Dependente | null>(null);
  const atualizar = () => utils.registroEmpregado.get.invalidate({ colaboradorId });
  const salvar = trpc.registroEmpregado.salvarDependente.useMutation({
    onSuccess: () => { toast.success(form.id ? "Dependente atualizado." : "Dependente adicionado."); setAberto(false); atualizar(); },
    onError: e => toast.error(msgErro(e, "Não foi possível salvar o dependente.")),
  });
  const excluir = trpc.registroEmpregado.removerDependente.useMutation({
    onSuccess: () => { toast.success("Dependente removido."); setRemover(null); atualizar(); },
    onError: e => toast.error(msgErro(e, "Não foi possível remover.")),
  });

  const abrir = (d?: Dependente) => {
    setForm(d ? { id: d.id, nome: d.nome, parentesco: d.parentesco, dataNascimento: d.dataNascimento ?? "",
      cpf: d.cpf ? fmtCpf(d.cpf) : "", rg: d.rg ?? "", dependenteIR: d.dependenteIR } : DEP_VAZIO);
    setAberto(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cônjuge e filhos saem na Ficha de Registro; quem é dependente para IR marca o campo &quot;Dep. p/ IR&quot;.
        </p>
        <Button size="sm" onClick={() => abrir()} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Adicionar dependente
        </Button>
      </div>

      {dependentes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <Users className="h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm font-medium">Nenhum dependente cadastrado</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Enquanto não houver cadastro, a ficha usa os dependentes do plano de saúde, se existirem.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {dependentes.map(d => {
            const anos = idade(d.dataNascimento);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-medium">{d.nome}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {rotuloOpcao({ opcoes: PARENTESCOS } as CampoRegistro, d.parentesco)}
                    {d.dataNascimento && <> · {dataBR(d.dataNascimento)}{anos !== null && ` (${anos} ${anos === 1 ? "ano" : "anos"})`}</>}
                  </p>
                </div>
                <p className="w-36 text-[13px] tabular-nums text-muted-foreground">{d.cpf ? fmtCpf(d.cpf) : "CPF não informado"}</p>
                {d.dependenteIR && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "oklch(0.95 0.03 255)", color: AZUL }}>
                    Dependente IR
                  </span>
                )}
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Editar ${d.nome}`} onClick={() => abrir(d)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label={`Remover ${d.nome}`} onClick={() => setRemover(d)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar dependente" : "Adicionar dependente"}</DialogTitle>
            <DialogDescription>Os dados aparecem na seção Dependentes da Ficha de Registro.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dep-nome">Nome completo</Label>
              <Input id="dep-nome" value={form.nome} maxLength={200} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Parentesco</Label>
              <Segmentado campo={{ chave: "parentesco", rotulo: "Parentesco", tipo: "opcao", grupo: "pessoal", opcoes: PARENTESCOS }}
                valor={form.parentesco} onChange={v => setForm({ ...form, parentesco: v || form.parentesco })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-nasc">Data de nascimento</Label>
              <Input id="dep-nasc" type="date" value={form.dataNascimento} onChange={e => setForm({ ...form, dataNascimento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-cpf">CPF</Label>
              <Input id="dep-cpf" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: fmtCpf(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-rg">RG</Label>
              <Input id="dep-rg" value={form.rg} maxLength={20} onChange={e => setForm({ ...form, rg: e.target.value })} />
            </div>
            <label className="flex items-center justify-between gap-3 self-end rounded-lg border border-border px-3 py-2">
              <span className="text-sm">Dependente para IR</span>
              <Switch checked={form.dependenteIR} onCheckedChange={v => setForm({ ...form, dependenteIR: v })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={salvar.isPending || form.nome.trim().length < 2}
              onClick={() => salvar.mutate({ ...form, colaboradorId, cpf: form.cpf || null, rg: form.rg || null, dataNascimento: form.dataNascimento || null })}>
              {salvar.isPending ? "Salvando…" : form.id ? "Salvar alterações" : "Adicionar dependente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!remover} onOpenChange={o => !o && setRemover(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover {remover?.nome}?</DialogTitle>
            <DialogDescription>O dependente sai do cadastro e da Ficha de Registro.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemover(null)}>Cancelar</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" disabled={excluir.isPending}
              onClick={() => remover && excluir.mutate({ id: remover.id, colaboradorId })}>
              {excluir.isPending ? "Removendo…" : "Remover dependente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Área principal ──────────────────────────────────────────────────────────

export default function RegistroEmpregado({ colaboradorId }: { colaboradorId: number }) {
  const { data, isLoading, isError, refetch } = trpc.registroEmpregado.get.useQuery({ colaboradorId });
  const [aba, setAba] = useState<GrupoRegistro | "dependentes">("pessoal");

  // Completude por grupo (dependentes contam como preenchido quando há pelo menos um)
  const progresso = useMemo(() => {
    if (!data) return null;
    const porGrupo = GRUPOS_REGISTRO.map(g => {
      const lista = CAMPOS_REGISTRO.filter(c => c.grupo === g.id);
      return { id: g.id, total: lista.length, feitos: lista.filter(c => data.campos[c.chave]).length };
    });
    const total = porGrupo.reduce((s, g) => s + g.total, 0);
    const feitos = porGrupo.reduce((s, g) => s + g.feitos, 0);
    return { porGrupo, total, feitos, pct: Math.round((feitos / total) * 100) };
  }, [data]);

  return (
    <section aria-labelledby="registro-titulo" className="overflow-hidden rounded-xl border border-border/60 bg-card"
      style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.05)" }}>
      <header className="flex flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-5">
        <div>
          <h2 id="registro-titulo" className="text-lg font-semibold tracking-tight">Registro de Empregado</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Dados complementares que preenchem a Ficha de Registro em PDF.</p>
        </div>
        {progresso && (
          <div className="min-w-[16rem] flex-1 sm:max-w-sm">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Ficha completa</span>
              <span className="font-semibold tabular-nums" style={{ color: AZUL }}>
                {progresso.feitos} de {progresso.total} campos
              </span>
            </div>
            {/* Barra dividida por grupo: cada trecho mostra o quanto daquele grupo está preenchido */}
            <div className="flex h-2 gap-1" role="img" aria-label={`${progresso.pct}% da ficha preenchida`}>
              {progresso.porGrupo.map(g => (
                <div key={g.id} className="relative overflow-hidden rounded-full" style={{ flex: g.total, background: "oklch(0.93 0.01 255)" }}
                  title={`${GRUPOS_REGISTRO.find(x => x.id === g.id)?.titulo}: ${g.feitos} de ${g.total}`}>
                  <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{ width: `${(g.feitos / g.total) * 100}%`, background: g.feitos === g.total ? "oklch(0.6 0.13 155)" : AZUL }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-border/60 px-3" role="tablist" aria-label="Grupos do registro">
        {ABAS.map(a => {
          const g = progresso?.porGrupo.find(x => x.id === a.id);
          const ativo = aba === a.id;
          const contador = a.id === "dependentes" ? data?.dependentes.length ?? 0 : g ? `${g.feitos}/${g.total}` : "";
          return (
            <button key={a.id} role="tab" aria-selected={ativo} onClick={() => setAba(a.id)}
              className="relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ color: ativo ? AZUL : "oklch(0.5 0.02 255)" }}>
              {a.titulo}
              <span className="rounded-full px-1.5 text-xs tabular-nums"
                style={{ background: ativo ? "oklch(0.95 0.03 255)" : "oklch(0.96 0.005 255)" }}>{contador}</span>
              {ativo && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: AZUL }} />}
            </button>
          );
        })}
      </nav>

      <div className="p-5" role="tabpanel">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : isError || !data ? (
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
            Não foi possível carregar o registro de empregado.
            <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
          </div>
        ) : aba === "dependentes" ? (
          <DependentesLista colaboradorId={colaboradorId} dependentes={data.dependentes} />
        ) : (
          <GrupoCampos key={aba} grupo={aba} campos={data.campos} colaboradorId={colaboradorId} notebook={data.notebook} />
        )}
      </div>
    </section>
  );
}
