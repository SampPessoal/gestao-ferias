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
import { InputMoeda } from "@/components/InputMoeda";
import { mascaraRg } from "@/lib/mascaras";
import {
  Pencil, Plus, Trash2, Users, Laptop, User, IdCard, Briefcase, Clock, UserCheck, GraduationCap,
  BookOpen, Landmark, Gift, Bus, Utensils, HeartPulse, ShieldCheck, Smile, Dumbbell, Baby, Car, Smartphone,
} from "lucide-react";
import { lerReais, formatarReais } from "@/lib/mascaras";
import {
  CAMPOS_REGISTRO, GRUPOS_REGISTRO, PARENTESCOS, rotuloOpcao, NAO_SE_APLICA, ehNaoSeAplica, aplicarCampo,
  type CampoRegistro, type Dependente, type GrupoRegistro,
} from "@shared/registroEmpregado";

const AZUL = "oklch(0.35 0.09 255)";
const ABAS: { id: GrupoRegistro | "dependentes"; titulo: string }[] = [
  ...GRUPOS_REGISTRO.map(g => ({ id: g.id, titulo: g.titulo })),
  { id: "dependentes", titulo: "Dependentes" },
];

const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Mensagem legível de um erro do servidor (a validação devolve uma lista em JSON). */
export function msgErro(e: { message?: string }, padrao: string): string {
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
export const fmtCpf = (v: string) => {
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
  if (ehNaoSeAplica(v)) return "Não se aplica";
  if (c.tipo === "opcao") return rotuloOpcao(c, v);
  if (c.tipo === "data") return dataBR(v);
  if (c.tipo === "moeda") return moedaBR(v);
  if (c.tipo === "cpf") return fmtCpf(v);
  if (c.tipo === "cnpj") return fmtCnpj(v);
  return v;
}

// ─── Entrada de um campo ─────────────────────────────────────────────────────

export function Segmentado({ campo, valor, onChange }: { campo: CampoRegistro; valor: string; onChange: (v: string) => void }) {
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

export function Entrada({ campo, valor, onChange }: { campo: CampoRegistro; valor: string; onChange: (v: string) => void }) {
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
              <Input id="dep-rg" value={form.rg} maxLength={20} onChange={e => setForm({ ...form, rg: mascaraRg(e.target.value) })} />
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

// ─── Cartões no padrão da ficha do colaborador ───────────────────────────────

/** Mesmo visual dos cartões da ficha (SectionBlock / InfoRow / EditField de ColaboradorDetalhe). */
function Cartao({ titulo, icone: Icone, cor, children }: { titulo: string; icone: React.ElementType; cor: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden self-start" style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.05)" }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60" style={{ background: "oklch(0.975 0.004 245)" }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: cor + "22" }}>
          <Icone className="w-3.5 h-3.5" style={{ color: cor }} />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/70">{titulo}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Linha({ rotulo, valor, icone: Icone }: { rotulo: string; valor?: React.ReactNode; icone: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: "oklch(0.97 0.005 245)" }}>
        <Icone className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{rotulo}</p>
        <p className="text-sm font-medium text-foreground break-words">
          {valor || <span className="text-muted-foreground/40 font-normal">—</span>}
        </p>
      </div>
    </div>
  );
}

function CampoEdicao({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</Label>
      {children}
    </div>
  );
}

/** Entrada no padrão do modo de edição da ficha: seletores e campos de altura h-8. */
/** Campo do registro; com "naoSeAplica" mostra a caixa "Não se aplica" logo abaixo. */
function EntradaFicha(props: { campo: CampoRegistro; valor: string; onChange: (v: string) => void; altura?: string; nome?: string; desabilitado?: boolean }) {
  const { campo, valor, onChange, desabilitado } = props;
  if (!campo.naoSeAplica) return <EntradaBase {...props} />;
  const na = ehNaoSeAplica(valor);
  return (
    <div className="space-y-1.5">
      <EntradaBase {...props} valor={na ? "" : valor} desabilitado={desabilitado || na} />
      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
        <input type="checkbox" className="h-3.5 w-3.5 accent-[oklch(0.35_0.09_255)]" checked={na} disabled={desabilitado}
          onChange={e => onChange(e.target.checked ? NAO_SE_APLICA : "")} />
        Não se aplica
      </label>
    </div>
  );
}

function EntradaBase({ campo, valor, onChange, altura = "h-8", nome, desabilitado }: { campo: CampoRegistro; valor: string; onChange: (v: string) => void; altura?: string; nome?: string; desabilitado?: boolean }) {
  if (campo.tipo === "opcao") {
    return (
      <Select value={valor || "__vazio"} disabled={desabilitado} onValueChange={v => onChange(v === "__vazio" ? "" : v)}>
        <SelectTrigger className={`${altura} w-full text-sm`} aria-label={nome ?? campo.rotulo}><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent className="max-h-64">
          <SelectItem value="__vazio">Não informado</SelectItem>
          {campo.opcoes!.map(o => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  const base = { className: `${altura} text-sm`, value: valor, "aria-label": nome ?? campo.rotulo, disabled: desabilitado };
  switch (campo.tipo) {
    case "data": return <Input type="date" {...base} onChange={e => onChange(e.target.value)} />;
    case "hora": return <Input type="time" {...base} onChange={e => onChange(e.target.value)} />;
    case "email": return <Input type="email" {...base} placeholder="nome@exemplo.com" onChange={e => onChange(e.target.value)} />;
    case "cpf": return <Input inputMode="numeric" {...base} placeholder="000.000.000-00" onChange={e => onChange(fmtCpf(e.target.value))} />;
    case "cnpj": return <Input inputMode="numeric" {...base} placeholder="00.000.000/0000-00" onChange={e => onChange(fmtCnpj(e.target.value))} />;
    case "moeda": return <Input inputMode="decimal" {...base} placeholder="0,00" onChange={e => onChange(e.target.value.replace(/[^\d,]/g, ""))} />;
    default: return <Input {...base} placeholder={campo.dica} maxLength={campo.max} onChange={e => onChange(e.target.value)} />;
  }
}

/** Formulário do modo de edição: campos do registro + benefícios (VR, VT e seguro de vida). */
export type FormRegistro = Record<string, string>;

/** Valores iniciais do formulário a partir do que está gravado. */
export function formRegistroInicial(d: { campos: Record<string, string | null>; beneficios: { valorVR: string | null; valorVT: string | null; temSeguroVida: boolean | null; valorSeguroVida: string | null } }): FormRegistro {
  const f: FormRegistro = {};
  for (const c of CAMPOS_REGISTRO) {
    const v = d.campos[c.chave] ?? "";
    f[c.chave] = c.tipo === "moeda" && v ? Number(v).toFixed(2).replace(".", ",")
      : c.tipo === "cpf" ? fmtCpf(v) : c.tipo === "cnpj" ? fmtCnpj(v) : v;
  }
  const reais = (v: string | null) => (v ? Number(v).toFixed(2).replace(".", ",") : "");
  f.valorVR = reais(d.beneficios.valorVR);
  f.valorVT = reais(d.beneficios.valorVT);
  f.temSeguroVida = d.beneficios.temSeguroVida ? "sim" : d.beneficios.temSeguroVida === false ? "nao" : "";
  f.valorSeguroVida = d.beneficios.valorSeguroVida ?? "";
  return f;
}

/** Converte o formulário no que o servidor espera. */
export function formRegistroParaEnvio(f: FormRegistro) {
  const campos = Object.fromEntries(CAMPOS_REGISTRO.map(c => [c.chave, f[c.chave] ?? ""]));
  return {
    campos,
    beneficios: {
      valorVR: f.valorVR ?? "",
      valorVT: f.valorVT ?? "",
      ...(f.temSeguroVida ? { temSeguroVida: f.temSeguroVida === "sim" } : {}),
      valorSeguroVida: f.temSeguroVida === "sim" ? (f.valorSeguroVida ?? "") : "",
    },
  };
}

const cartoesRegistro: { titulo: string; icone: React.ElementType; cor: string; chaves: string[] }[] = [
  { titulo: "Habilitação e CTPS", icone: IdCard, cor: "#f59e0b", chaves: ["cnhNumero", "cnhCategoria", "cnhValidade", "ctpsUf"] },
  { titulo: "Contrato de Trabalho", icone: Briefcase, cor: "#3b82f6", chaves: ["vinculo", "primeiroTrabalho", "contratoExperiencia", "cbo", "remuneracao"] },
  { titulo: "Jornada", icone: Clock, cor: "#06b6d4", chaves: ["jornadaEntrada", "jornadaSaida", "jornadaIntervalo"] },
  { titulo: "Supervisor", icone: UserCheck, cor: "#6366f1", chaves: ["supervisorNome", "supervisorCpf", "supervisorFuncao"] },
  { titulo: "Formação", icone: GraduationCap, cor: "#a855f7", chaves: ["grauInstrucao", "situacaoCurso", "curso", "semestre", "instituicaoEnsino", "instituicaoCnpj"] },
  { titulo: "Estágio e Empresa Vinculada", icone: BookOpen, cor: "#f97316", chaves: ["periodoEstagio", "empresaEstagio", "apoliceSeguro"] },
  { titulo: "Sindicato", icone: Landmark, cor: "#64748b", chaves: ["sindicato", "contribuicaoSindical"] },
];
const campoPor = (chave: string) => CAMPOS_REGISTRO.find(c => c.chave === chave)!;

/**
 * Cartões do Registro de Empregado na ficha do colaborador. Entram no mesmo
 * "Editar Ficha" da página: em edição, cada linha vira um campo.
 */
export default function RegistroEmpregado({ colaboradorId, editando, form, setForm }: {
  colaboradorId: number;
  editando: boolean;
  form: FormRegistro;
  setForm: (f: FormRegistro) => void;
}) {
  const { data, isLoading, isError, refetch } = trpc.registroEmpregado.get.useQuery({ colaboradorId });
  const muda = (chave: string) => (v: string) => setForm(aplicarCampo(form, chave, v));

  if (isLoading) {
    return <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>;
  }
  if (isError || !data) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-sm">
        Não foi possível carregar o registro de empregado.
        <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }

  const b = data.beneficios;
  const linhaOuCampo = (chave: string, icone: React.ElementType) => {
    const c = campoPor(chave);
    return editando
      ? <CampoEdicao key={chave} rotulo={c.rotulo}><EntradaFicha campo={c} valor={form[chave] ?? ""} onChange={muda(chave)} desabilitado={!!c.dependeDe && ehNaoSeAplica(form[c.dependeDe])} /></CampoEdicao>
      : <Linha key={chave} rotulo={c.rotulo} valor={exibir(c, data.campos[chave])} icone={icone} />;
  };
  const simNao = (v: boolean | null) => (v === true ? "Sim" : v === false ? "Não" : "");
  const nb = data.notebook;

  const cartao = (titulo: string) => {
    const c = cartoesRegistro.find(x => x.titulo === titulo)!;
    return (
      <Cartao key={c.titulo} titulo={c.titulo} icone={c.icone} cor={c.cor}>
        <div className={editando ? "space-y-3" : undefined}>
          {c.chaves.map(ch => linhaOuCampo(ch, c.icone))}
        </div>
      </Cartao>
    );
  };

  // Três colunas empilhadas, como os cartões de cima da ficha (sem espaços vazios entre cartões)
  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div className="space-y-4">
        {cartao("Habilitação e CTPS")}
        {cartao("Jornada")}
        {cartao("Sindicato")}
      </div>
      <div className="space-y-4">
        {cartao("Supervisor")}
        {cartao("Formação")}
        {cartao("Estágio e Empresa Vinculada")}
      </div>
      <div className="space-y-4">
      {cartao("Contrato de Trabalho")}

      {/* Benefícios: VR, VT, plano de saúde, seguro de vida, odontológico, TotalPass e notebook */}
      <Cartao titulo="Benefícios" icone={Gift} cor="#10b981">
        {editando ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <CampoEdicao rotulo="VR (R$ por dia)">
                <Input inputMode="decimal" aria-label="VR (R$ por dia)" className="h-8 text-sm" placeholder="0,00" value={form.valorVR ?? ""}
                  onChange={e => muda("valorVR")(e.target.value.replace(/[^\d,]/g, ""))} />
              </CampoEdicao>
              <CampoEdicao rotulo="VT (R$ por dia)">
                <Input inputMode="decimal" aria-label="VT (R$ por dia)" className="h-8 text-sm" placeholder="0,00" value={form.valorVT ?? ""}
                  onChange={e => muda("valorVT")(e.target.value.replace(/[^\d,]/g, ""))} />
              </CampoEdicao>
            </div>
            {["motivoSemVT", "descontoVT"].map(ch => linhaOuCampo(ch, Bus))}
            <div className="grid grid-cols-2 gap-2">
              <CampoEdicao rotulo="Seguro de vida">
                <Select value={form.temSeguroVida || "__vazio"} onValueChange={v => muda("temSeguroVida")(v === "__vazio" ? "" : v)}>
                  <SelectTrigger className="h-8 w-full text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__vazio">Não informado</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </CampoEdicao>
              <CampoEdicao rotulo="Valor do seguro">
                <InputMoeda formato="virgula" onValorChange={v => muda("valorSeguroVida")(v)} aria-label="Valor do seguro" className="h-8 text-sm" placeholder="0,00" disabled={form.temSeguroVida !== "sim"} value={form.valorSeguroVida ?? ""}
                   />
              </CampoEdicao>
            </div>
            {["planoOdontologico", "totalpass"].map(ch => linhaOuCampo(ch, HeartPulse))}
            <p className="text-[11px] text-muted-foreground">
              Plano de saúde e auxílio notebook são controlados nas telas Plano de Saúde e Movimentação do Mês.
            </p>
          </div>
        ) : (
          <div>
            <Linha rotulo="Vale-refeição (por dia)" valor={moedaBR(b.valorVR)} icone={Utensils} />
            <Linha rotulo="Vale-transporte (por dia)" valor={moedaBR(b.valorVT)} icone={Bus} />
            <Linha rotulo="Sem vale-transporte por" valor={exibir(campoPor("motivoSemVT"), data.campos.motivoSemVT)} icone={Bus} />
            <Linha rotulo="Desconto de vale-transporte" valor={exibir(campoPor("descontoVT"), data.campos.descontoVT)} icone={Bus} />
            <Linha rotulo="Plano de saúde" icone={HeartPulse}
              valor={b.planoSaude ? `Sim — ${b.planoSaude.plano} (competência ${b.planoSaude.competencia})` : "Não"} />
            <Linha rotulo="Seguro de vida" icone={ShieldCheck}
              valor={b.temSeguroVida ? `Sim${b.valorSeguroVida ? ` — R$ ${b.valorSeguroVida}` : ""}` : simNao(b.temSeguroVida)} />
            <Linha rotulo="Plano odontológico" valor={exibir(campoPor("planoOdontologico"), data.campos.planoOdontologico)} icone={Smile} />
            <Linha rotulo="TotalPass / ginástica laboral" valor={exibir(campoPor("totalpass"), data.campos.totalpass)} icone={Dumbbell} />
            <Linha rotulo="Auxílio notebook" icone={Laptop}
              valor={nb ? (nb.ativo ? `Ativo desde ${dataBR(nb.desde)} — ${moedaBR(nb.valor)} por mês` : `Encerrado em ${dataBR(nb.desde)}`) : ""} />
          </div>
        )}
      </Cartao>
      </div>
    </div>

      {/* Dependentes: lista própria, com incluir, editar e remover */}
      <Cartao titulo="Dependentes" icone={Users} cor="#ec4899">
        <DependentesLista colaboradorId={colaboradorId} dependentes={data.dependentes} />
      </Cartao>
    </div>
  );
}

// ─── Peças usadas no cadastro de colaborador novo ────────────────────────────

/** Campos de todos os grupos do Registro de Empregado, editáveis, para o cadastro novo. */
export function CamposRegistroNovo({ form, onChange }: {
  form: Record<string, string>;
  onChange: (chave: string, valor: string) => void;
}) {
  return (
    <div className="space-y-6">
      {GRUPOS_REGISTRO.map(g => (
        <section key={g.id} aria-label={g.titulo}>
          <h3 className="text-sm font-semibold">{g.titulo}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{g.descricao}</p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {CAMPOS_REGISTRO.filter(c => c.grupo === g.id).map(c => (
              <div key={c.chave} className={c.largo || (c.tipo === "opcao" && (c.opcoes?.length ?? 0) > 3 && (c.opcoes?.length ?? 0) <= 5) ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label className="text-xs font-medium text-foreground/70">{c.rotulo}</Label>
                <Entrada campo={c} valor={form[c.chave] ?? ""} onChange={v => onChange(c.chave, v)} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Um campo do Registro de Empregado no cadastro novo, no visual dos demais campos do cadastro. */
export function CampoRegistroNovo({ chave, form, onChange, rotulo, className }: {
  chave: string;
  form: Record<string, string>;
  onChange: (chave: string, valor: string) => void;
  rotulo?: string;
  className?: string;
}) {
  const c = CAMPOS_REGISTRO.find(x => x.chave === chave);
  if (!c) return null;
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-foreground/70">{rotulo ?? c.rotulo}</Label>
      <EntradaFicha campo={c} valor={form[chave] ?? ""} onChange={v => onChange(chave, v)} altura="h-9" nome={rotulo ?? c.rotulo}
        desabilitado={!!c.dependeDe && ehNaoSeAplica(form[c.dependeDe])} />
    </div>
  );
}

export type DependenteRascunho = {
  nome: string; parentesco: string; dataNascimento: string; cpf: string; rg: string; dependenteIR: boolean;
};

/** Lista de dependentes do cadastro novo (gravada junto com o colaborador). */
export function DependentesNovo({ lista, onChange }: { lista: DependenteRascunho[]; onChange: (l: DependenteRascunho[]) => void }) {
  const [form, setForm] = useState<DependenteRascunho>(DEP_VAZIO);
  const nomeParentesco = (v: string) => PARENTESCOS.find(p => p.valor === v)?.rotulo ?? v;
  return (
    <section aria-label="Dependentes">
      <h3 className="text-sm font-semibold">Dependentes</h3>
      <p className="mb-3 text-xs text-muted-foreground">Cônjuge e filhos saem na Ficha de Registro; marque quem é dependente para IR.</p>

      {lista.length > 0 && (
        <ul className="mb-3 divide-y divide-border/60 rounded-lg border border-border/60">
          {lista.map((d, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {nomeParentesco(d.parentesco)}{d.dataNascimento && ` · ${dataBR(d.dataNascimento)}`}{d.cpf && ` · ${d.cpf}`}
                  {d.dependenteIR && " · Dependente IR"}
                </p>
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700"
                aria-label={`Remover ${d.nome}`} onClick={() => onChange(lista.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium text-foreground/70" htmlFor="novo-dep-nome">Nome completo</Label>
          <Input id="novo-dep-nome" className="h-9" value={form.nome} maxLength={200} onChange={e => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium text-foreground/70">Parentesco</Label>
          <Segmentado campo={{ chave: "parentesco", rotulo: "Parentesco", tipo: "opcao", grupo: "pessoal", opcoes: PARENTESCOS }}
            valor={form.parentesco} onChange={v => setForm({ ...form, parentesco: v || form.parentesco })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground/70" htmlFor="novo-dep-nasc">Data de nascimento</Label>
          <Input id="novo-dep-nasc" type="date" className="h-9" value={form.dataNascimento} onChange={e => setForm({ ...form, dataNascimento: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground/70" htmlFor="novo-dep-cpf">CPF</Label>
          <Input id="novo-dep-cpf" inputMode="numeric" className="h-9" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: fmtCpf(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground/70" htmlFor="novo-dep-rg">RG</Label>
          <Input id="novo-dep-rg" className="h-9" value={form.rg} maxLength={20} onChange={e => setForm({ ...form, rg: mascaraRg(e.target.value) })} />
        </div>
        <label className="flex items-center justify-between gap-3 self-end rounded-lg border border-border px-3 py-1.5">
          <span className="text-sm">Dependente para IR</span>
          <Switch checked={form.dependenteIR} onCheckedChange={v => setForm({ ...form, dependenteIR: v })} />
        </label>
        <div className="sm:col-span-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={form.nome.trim().length < 2}
            onClick={() => { onChange([...lista, { ...form, nome: form.nome.trim() }]); setForm(DEP_VAZIO); }}>
            <Plus className="h-4 w-4" /> Incluir dependente
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Monta o registro para enviar no cadastro; undefined quando nada foi preenchido. */
export function registroParaEnvio(campos: Record<string, string>, deps: DependenteRascunho[], complementos: Record<string, string> = {}) {
  const preenchidos = Object.fromEntries(Object.entries(campos).filter(([, v]) => v && v.trim()));
  const comp: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(complementos)) {
    if (!v || !v.trim()) continue;
    if (k === "temSeguroVida") comp.temSeguroVida = v === "sim";
    else comp[k] = v.trim();
  }
  if (comp.temSeguroVida !== true) delete comp.valorSeguroVida;
  if (!Object.keys(preenchidos).length && !deps.length && !Object.keys(comp).length) return undefined;
  return {
    complementos: comp,
    campos: preenchidos,
    dependentes: deps.map(d => ({
      nome: d.nome, parentesco: d.parentesco, dataNascimento: d.dataNascimento || null,
      cpf: d.cpf || null, rg: d.rg || null, dependenteIR: d.dependenteIR,
    })),
  };
}

// ─── Aba "Benefícios" da ficha: resumo rápido ────────────────────────────────

type SituacaoBeneficio = "ativo" | "nao" | "info";
type ItemResumo = { nome: string; icone: React.ElementType; situacao: SituacaoBeneficio; valor?: string; detalhe?: string };

const reais = (v: string | number | null | undefined) => {
  const n = lerReais(v);
  return n && n > 0 ? `R$ ${formatarReais(n)}` : null;
};
const simNaoNa = (v: string | null | undefined): SituacaoBeneficio => (v === "sim" ? "ativo" : v ? "nao" : "info");

const ESTILO_SITUACAO: Record<SituacaoBeneficio, { rotulo: string; pill: string }> = {
  ativo: { rotulo: "Ativo", pill: "bg-[#e2f4e8] text-[#155d33]" },
  nao: { rotulo: "Não possui", pill: "bg-muted text-muted-foreground" },
  info: { rotulo: "Não informado", pill: "border border-dashed border-muted-foreground/40 text-muted-foreground" },
};

/** Resumo dos benefícios do colaborador, em quadros, a partir do que está gravado. */
export function ResumoBeneficios({ colaboradorId }: { colaboradorId: number }) {
  const { data, isLoading, isError, refetch } = trpc.registroEmpregado.get.useQuery({ colaboradorId });
  if (isLoading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  if (isError || !data) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-sm">
        Não foi possível carregar os benefícios.
        <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar de novo</Button>
      </div>
    );
  }
  const b = data.beneficios;
  const r = data.campos;
  const nb = data.notebook;
  const vr = reais(b.valorVR);
  const vt = reais(b.valorVT);
  const seguro = reais(b.valorSeguroVida);
  const veiculo = reais(b.auxilioVeiculoFolha) ?? reais(b.auxilioVeiculo);
  const celular = reais(b.auxilioCelularFolha);
  const nbValor = nb?.ativo ? reais(nb.valor) : null;
  const creche = b.creche;
  const deps = b.planoSaude?.dependentes ?? 0;
  const itens: ItemResumo[] = [
    { nome: "Vale-refeição", icone: Utensils, situacao: vr ? "ativo" : "nao", valor: vr ?? undefined, detalhe: "por dia" },
    { nome: "Vale-transporte", icone: Bus, situacao: vt ? "ativo" : "nao", valor: vt ?? undefined,
      detalhe: vt ? "por dia" : r.motivoSemVT ? rotuloOpcao(CAMPOS_REGISTRO.find(c => c.chave === "motivoSemVT"), r.motivoSemVT) : undefined },
    { nome: "Plano de saúde", icone: HeartPulse, situacao: b.planoSaude ? "ativo" : "nao", valor: b.planoSaude?.plano,
      detalhe: b.planoSaude ? `titular${deps ? ` · ${deps} dependente${deps > 1 ? "s" : ""}` : ""}` : undefined },
    { nome: "Plano odontológico", icone: Smile, situacao: simNaoNa(r.planoOdontologico) },
    { nome: "Seguro de vida", icone: ShieldCheck, situacao: b.temSeguroVida ? "ativo" : b.temSeguroVida === false ? "nao" : "info",
      valor: b.temSeguroVida ? seguro ?? undefined : undefined, detalhe: b.temSeguroVida && seguro ? "por mês" : undefined },
    { nome: "TotalPass", icone: Dumbbell, situacao: simNaoNa(r.totalpass) },
    { nome: "Auxílio notebook", icone: Laptop, situacao: nb?.ativo ? "ativo" : "nao", valor: nbValor ?? undefined, detalhe: nbValor ? "por mês" : undefined },
    { nome: "Auxílio creche", icone: Baby, situacao: creche?.ativo ? "ativo" : "nao", valor: creche?.ativo ? reais(creche.valor) ?? undefined : undefined,
      detalhe: creche?.ativo ? `${creche.filhos} filho${creche.filhos > 1 ? "s" : ""}` : undefined },
    { nome: "Auxílio veículo", icone: Car, situacao: veiculo ? "ativo" : "nao", valor: veiculo ?? undefined, detalhe: veiculo ? "por mês" : undefined },
    { nome: "Auxílio celular", icone: Smartphone, situacao: celular ? "ativo" : "nao", valor: celular ?? undefined, detalhe: celular ? "por mês" : undefined },
  ];
  const ativos = itens.filter(i => i.situacao === "ativo").length;
  return (
    <section aria-labelledby="resumo-beneficios" className="rounded-xl border border-border/60 overflow-hidden" style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.05)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border/60" style={{ background: "oklch(0.975 0.004 245)" }}>
        <h2 id="resumo-beneficios" className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wide text-foreground/70">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: "#10b98122" }}><Gift className="h-3.5 w-3.5" style={{ color: "#10b981" }} /></span>
          Resumo de Benefícios
        </h2>
        <span className="text-sm text-foreground/70"><strong className="text-[15px] text-[#155d33]">{ativos}</strong> de {itens.length} benefícios ativos</span>
      </div>
      <ul className="grid gap-3 p-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))" }}>
        {itens.map(it => {
          const ativo = it.situacao === "ativo";
          const est = ESTILO_SITUACAO[it.situacao];
          const Icone = it.icone;
          return (
            <li key={it.nome} className={`flex flex-col gap-2.5 rounded-xl border p-3.5 ${ativo ? "border-[#cfe7d8] bg-[#f6fbf8]" : "border-border/60 bg-card"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ativo ? "bg-[#d9efe1]" : "bg-muted"}`}>
                  <Icone className={`h-4 w-4 ${ativo ? "text-[#155d33]" : "text-muted-foreground"}`} />
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${est.pill}`}>{est.rotulo}</span>
              </div>
              <p className="text-xs font-semibold text-foreground/75">{it.nome}</p>
              <p className="flex flex-wrap items-baseline gap-1.5">
                <span className={`font-bold tabular-nums ${ativo ? "text-lg text-foreground" : "text-[15px] text-muted-foreground"}`}>{it.valor ?? "—"}</span>
                {it.detalhe && <span className="text-xs text-muted-foreground">{it.detalhe}</span>}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
