import { useState, useMemo, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { PrivacyValue } from "@/components/PrivacyValue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Search,
  Download,
  Heart,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Receipt,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const EMPRESAS = ["FREIRE", "JOANES", "SUDOESTE", "SOLAR"] as const;
const EMPRESA_LABELS: Record<string, string> = {
  FREIRE: "Freire",
  JOANES: "Joanes",
  SUDOESTE: "Sudoeste",
  SOLAR: "Solar",
};

const MESES_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TIPO_LABELS: Record<string, string> = {
  T: "Titular",
  D: "Dependente",
};

const DEP_LABELS: Record<string, string> = {
  "Filho/Filha": "Filho/Filha",
  Conjuge: "Cônjuge",
  Agregado: "Agregado",
  "": "",
};

function formatCPF(cpf: string): string {
  if (!cpf || cpf.length !== 11) return cpf || "—";
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function formatMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mapa de código numérico → nome amigável do plano
const PLANO_CODIGO_NOME: Record<string, string> = {
  "963730": "AMIL S750",
  "967067": "Prata QC",
  "967068": "Prata QP",
  "967077": "Ouro QC",
  "967078": "Ouro QP",
};

function formatPlano(plano: string): string {
  if (!plano) return "—";
  // Se for código numérico, retorna o nome do mapa
  if (PLANO_CODIGO_NOME[plano]) return PLANO_CODIGO_NOME[plano];
  // Fallback: substituições de nome longo → nome curto
  return plano
    .replace("PRATA QC COPART TP", "Prata QC")
    .replace("PRATA QP COPART TP", "Prata QP")
    .replace("OURO QC R COPART TP", "Ouro QC")
    .replace("OURO QP R COPART TP", "Ouro QP")
    .replace("AMIL S750 R1 QP NAC COPART TP PJ_PME", "AMIL S750")
    .replace("AMIL S750 R1 QP NAC COPART", "AMIL S750");
}

function faixaLabel(inicio: number, fim: number): string {
  if (fim >= 999) return `59 anos ou mais`;
  if (inicio === 0) return `Até 18 anos`;
  return `${inicio} a ${fim} anos`;
}

type Beneficiario = {
  id: number;
  empresa: string;
  numeroBeneficiario: string;
  nome: string;
  matriculaFuncional: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  plano: string;
  tipo: "T" | "D";
  idade: number;
  tipoDepend: string;
  mensalidade: number;
  totalFamilia: number | null;
  titularNumeroBeneficiario: string | null;
};

type Familia = {
  titular: Beneficiario;
  dependentes: Beneficiario[];
  totalFamilia: number;
};

type FaixaPreco = {
  id: number;
  empresa: string;
  codigoPlano: string;
  nomePlano: string;
  faixaInicio: number;
  faixaFim: number;
  valorTitular: number;
  valorDependente: number;
};

type Coparticipacao = {
  id: number;
  numeroBeneficiario: string;
  empresa: string;
  nomeBeneficiario: string;
  tipoBeneficiario: "T" | "D";
  mes: number;
  ano: number;
  valor: number;
  observacao: string | null;
  createdByNome: string | null;
};

function agruparFamilias(beneficiarios: Beneficiario[]): Familia[] {
  const titularMap = new Map<string, Familia>();
  const titularOrder: string[] = [];

  for (const b of beneficiarios) {
    if (b.tipo === "T") {
      titularMap.set(b.numeroBeneficiario, {
        titular: b,
        dependentes: [],
        totalFamilia: b.totalFamilia ?? b.mensalidade,
      });
      titularOrder.push(b.numeroBeneficiario);
    }
  }

  for (const b of beneficiarios) {
    if (b.tipo === "D" && b.titularNumeroBeneficiario) {
      const familia = titularMap.get(b.titularNumeroBeneficiario);
      if (familia) {
        familia.dependentes.push(b);
      }
    }
  }

  return titularOrder.map((nb) => titularMap.get(nb)!).filter(Boolean);
}

// ─── Sub-aba: Simulador de Plano ─────────────────────────────────────────────
function Simulador() {
  const [empresa, setEmpresa] = useState<string>("");
  const [plano, setPlano] = useState<string>("");
  const [categoria, setCategoria] = useState<"titular" | "dependente">("titular");
  const [dataNasc, setDataNasc] = useState<string>("");
  const [nomeColab, setNomeColab] = useState<string>("");
  const [nomeBusca, setNomeBusca] = useState<string>("");
  const [nomeBuscaDebounced, setNomeBuscaDebounced] = useState<string>("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const { data: precos = [] } = trpc.tabelaPrecos.list.useQuery({ empresa: undefined });
  const { data: todosColabs = [] } = trpc.colaboradores.listAtivos.useQuery(undefined);
  const PLANO_BASE = "967067"; // Prata QC — base do subsídio

  // Debounce da busca por nome
  useEffect(() => {
    const t = setTimeout(() => setNomeBuscaDebounced(nomeBusca), 300);
    return () => clearTimeout(t);
  }, [nomeBusca]);

  // Filtrar colaboradores pela busca
  const colabsFiltrados = useMemo(() => {
    if (nomeBuscaDebounced.length < 2) return [];
    const q = nomeBuscaDebounced.toLowerCase();
    return (todosColabs as any[]).filter((c: any) => c.nome.toLowerCase().includes(q)).slice(0, 8);
  }, [todosColabs, nomeBuscaDebounced]);

  // Selecionar colaborador da busca
  function selecionarColab(c: any) {
    setNomeColab(c.nome);
    setNomeBusca(c.nome);
    setMostrarSugestoes(false);
    // Preencher empresa automaticamente
    const emp = (c.empresaNome as string || "").toUpperCase();
    if (["FREIRE", "JOANES", "SUDOESTE", "SOLAR"].includes(emp)) {
      setEmpresa(emp);
      setPlano("");
    }
    // Preencher data de nascimento automaticamente
    if (c.dataNascimento) {
      const dt = c.dataNascimento instanceof Date
        ? c.dataNascimento.toISOString().slice(0, 10)
        : String(c.dataNascimento).slice(0, 10);
      setDataNasc(dt);
    }
  }

  const idade = useMemo(() => {
    if (!dataNasc) return null;
    const dt = new Date(dataNasc + "T12:00:00");
    const hoje = new Date();
    let anos = hoje.getFullYear() - dt.getFullYear();
    const m = hoje.getMonth() - dt.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < dt.getDate())) anos--;
    return anos >= 0 ? anos : null;
  }, [dataNasc]);

  const planosDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    (precos as any[]).forEach(p => {
      if (p.empresa === empresa) map.set(p.codigoPlano, p.nomePlano);
    });
    return Array.from(map.entries()).map(([codigo, nome]) => ({ codigo, nome }));
  }, [precos, empresa]);

  const resultado = useMemo(() => {
    if (!empresa || !plano || !dataNasc || idade === null) return null;
    const faixaPlano = (precos as any[]).find(
      p => p.empresa === empresa && p.codigoPlano === plano &&
        p.faixaInicio <= idade && p.faixaFim >= idade
    );
    if (!faixaPlano) return null;
    const valorPlano = categoria === "titular" ? Number(faixaPlano.valorTitular) : Number(faixaPlano.valorDependente);
    const faixaPrata = (precos as any[]).find(
      p => p.empresa === empresa && p.codigoPlano === PLANO_BASE &&
        p.faixaInicio <= idade && p.faixaFim >= idade
    );
    const valorPrata = faixaPrata ? (categoria === "titular" ? Number(faixaPrata.valorTitular) : Number(faixaPrata.valorDependente)) : 0;
    const subsidio = valorPrata * 0.7;
    const isPrata = plano === PLANO_BASE;
    const valorColaborador = Math.max(0, valorPlano - subsidio);
    return { valorPlano, subsidio, valorColaborador, isPrata, faixaLbl: faixaLabel(faixaPlano.faixaInicio, faixaPlano.faixaFim) };
  }, [precos, empresa, plano, categoria, idade]);

  return (
    <div className="w-full space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Simulador de Plano de Saúde</h2>
          <p className="text-sm text-muted-foreground mt-1">Calcule o valor que o colaborador vai pagar com base na regra de subsídio de 70% sobre o Prata QC.</p>
        </div>
        {resultado && (
          <Badge className="text-sm px-3 py-1.5 font-semibold" style={{ background: "oklch(0.20 0.08 252)", color: "white" }}>
            {categoria === "titular" ? "Titular" : "Dependente"} · {resultado.faixaLbl}
          </Badge>
        )}
      </div>

      {/* Layout principal: formulário + resultado lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* Formulário (2/5) */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6 space-y-5" style={{ boxShadow: "0 2px 16px oklch(0.145 0.03 245 / 0.08)" }}>
          <div className="flex items-center gap-2 pb-3 border-b border-border/40">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.20 0.08 252)" }}>
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Dados da Simulação</span>
          </div>

          {/* Busca por colaborador */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Colaborador</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome (opcional)..."
                value={nomeBusca}
                onChange={e => { setNomeBusca(e.target.value); setMostrarSugestoes(true); if (!e.target.value) { setNomeColab(""); } }}
                onFocus={() => setMostrarSugestoes(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
              />
              {mostrarSugestoes && colabsFiltrados.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-xl border border-border/60 bg-popover shadow-xl overflow-hidden">
                  {colabsFiltrados.map((c: any) => (
                    <button key={c.id} type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/30 last:border-0"
                      onMouseDown={() => selecionarColab(c)}>
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-xs text-muted-foreground">{c.empresaNome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {nomeColab && <p className="text-xs text-green-600 font-medium">✓ {nomeColab}</p>}
          </div>

          {/* Empresa + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</Label>
              <Select value={empresa} onValueChange={v => { setEmpresa(v); setPlano(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map(e => <SelectItem key={e} value={e}>{EMPRESA_LABELS[e]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria</Label>
              <Select value={categoria} onValueChange={v => setCategoria(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="titular">Titular</SelectItem>
                  <SelectItem value="dependente">Dependente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Plano */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Plano {empresa && <span className="normal-case font-normal text-blue-500">({EMPRESA_LABELS[empresa]})</span>}
            </Label>
            {empresa ? (
              <Select value={plano} onValueChange={setPlano}>
                <SelectTrigger><SelectValue placeholder="Selecione o plano..." /></SelectTrigger>
                <SelectContent>
                  {planosDisponiveis.map(p => (
                    <SelectItem key={p.codigo} value={p.codigo}>{formatPlano(p.nome)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-9 rounded-md border border-border/60 bg-muted/20 flex items-center px-3">
                <span className="text-sm text-muted-foreground">Selecione a empresa primeiro</span>
              </div>
            )}
          </div>

          {/* Data de Nascimento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data de Nascimento</Label>
            <Input type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)} />
            {idade !== null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.92 0.06 250)", color: "oklch(0.30 0.12 250)" }}>
                  {idade} anos
                </span>
                {resultado && <span className="text-xs text-muted-foreground">{resultado.faixaLbl}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Resultado (3/5) */}
        <div className="lg:col-span-3">
          {resultado ? (
            <div className="rounded-2xl overflow-hidden border border-border/60" style={{ boxShadow: "0 2px 16px oklch(0.145 0.03 245 / 0.08)" }}>
              <div className="px-6 py-4 border-b border-border/40" style={{ background: "oklch(0.20 0.08 252)" }}>
                <p className="text-white font-bold text-base">{nomeColab || "Colaborador"} · {formatPlano(plano)}</p>
                <p className="text-white/70 text-xs mt-0.5">{EMPRESA_LABELS[empresa]} · {resultado.faixaLbl} · {categoria === "titular" ? "Titular" : "Dependente"}</p>
              </div>
              <div className="bg-card p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl p-4 text-center border border-border/40" style={{ background: "oklch(0.97 0.005 150)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.50 0.06 150)" }}>Valor do Plano</p>
                    <p className="text-2xl font-bold" style={{ color: "oklch(0.22 0.10 150)" }}>{formatMoeda(resultado.valorPlano)}</p>
                    <p className="text-[11px] mt-1.5 font-medium" style={{ color: "oklch(0.55 0.05 150)" }}>Total cobrado pela AMIL</p>
                  </div>
                  <div className="rounded-xl p-4 text-center border border-border/40" style={{ background: "oklch(0.96 0.02 250)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.40 0.10 250)" }}>Empresa Paga</p>
                    <p className="text-2xl font-bold" style={{ color: "oklch(0.22 0.12 250)" }}>{formatMoeda(resultado.subsidio)}</p>
                    <p className="text-[11px] mt-1.5 font-medium" style={{ color: "oklch(0.50 0.08 250)" }}>70% do Prata QC</p>
                  </div>
                  <div className="rounded-xl p-4 text-center border-2" style={{ background: "oklch(0.96 0.03 30)", borderColor: "oklch(0.75 0.12 30)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "oklch(0.45 0.10 30)" }}>Colaborador Paga</p>
                    <p className="text-2xl font-bold" style={{ color: "oklch(0.28 0.14 30)" }}>{formatMoeda(resultado.valorColaborador)}</p>
                    <p className="text-[11px] mt-1.5 font-medium" style={{ color: "oklch(0.50 0.08 30)" }}>Desconto em folha</p>
                  </div>
                </div>
                {!resultado.isPrata ? (
                  <div className="rounded-xl px-4 py-3 border border-border/40" style={{ background: "oklch(0.97 0.005 245)" }}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Como foi calculado</p>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="font-semibold">{formatMoeda(resultado.valorPlano)}</span>
                      <span className="text-muted-foreground">valor do plano</span>
                      <span className="text-muted-foreground">−</span>
                      <span className="font-semibold" style={{ color: "oklch(0.35 0.10 250)" }}>{formatMoeda(resultado.subsidio)}</span>
                      <span className="text-muted-foreground">subsídio empresa</span>
                      <span className="text-muted-foreground">=</span>
                      <span className="font-bold text-base" style={{ color: "oklch(0.28 0.14 30)" }}>{formatMoeda(resultado.valorColaborador)}</span>
                      <span className="text-muted-foreground">a pagar</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl px-4 py-3 border border-border/40" style={{ background: "oklch(0.97 0.005 245)" }}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Plano base — Prata QC</p>
                    <p className="text-sm text-muted-foreground">A empresa subsidia <strong>70%</strong> do valor total. O colaborador paga os <strong>30%</strong> restantes.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 flex flex-col items-center justify-center p-12 text-center min-h-[320px]">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "oklch(0.93 0.03 245)" }}>
                <Heart className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-muted-foreground">Preencha os dados ao lado</p>
              <p className="text-sm text-muted-foreground/70 mt-1">O resultado aparecerá aqui automaticamente</p>
              {empresa && plano && dataNasc && idade !== null && (
                <p className="text-sm text-amber-600 mt-3 font-medium">Faixa etária não encontrada na tabela de preços.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-aba: Tabela de Valores ───────────────────────────────────────────────
function TabelaValores() {
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");

  const { data: precos = [], isLoading } = trpc.tabelaPrecos.list.useQuery({
    empresa: empresaFiltro !== "todas" ? empresaFiltro : undefined,
  });

  const porEmpresaPlano = useMemo(() => {
    const map: Record<string, Record<string, FaixaPreco[]>> = {};
    for (const row of precos as FaixaPreco[]) {
      if (!map[row.empresa]) map[row.empresa] = {};
      if (!map[row.empresa][row.codigoPlano]) map[row.empresa][row.codigoPlano] = [];
      map[row.empresa][row.codigoPlano].push(row);
    }
    return map;
  }, [precos]);

  const empresasExibir = empresaFiltro !== "todas" ? [empresaFiltro] : EMPRESAS;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {EMPRESAS.map((emp) => (
              <SelectItem key={emp} value={emp}>
                {EMPRESA_LABELS[emp]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">Vigência: Abril/2026</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {empresasExibir.map((emp) => {
            const planos = porEmpresaPlano[emp];
            if (!planos || Object.keys(planos).length === 0) return null;
            return (
              <div key={emp}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: "oklch(0.48 0.20 252)" }} />
                  <h3 className="text-base font-semibold">{EMPRESA_LABELS[emp]}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Object.entries(planos).map(([codigo, faixas]) => {
                    const nomePlano = faixas[0]?.nomePlano ?? codigo;
                    return (
                      <Card key={codigo} className="overflow-hidden border border-border/60">
                        <CardHeader className="py-3 px-4 border-b" style={{ background: "oklch(0.97 0.003 240)" }}>
                          <CardTitle className="text-sm font-semibold text-foreground">
                            {formatPlano(nomePlano)}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">Cód. {codigo}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow style={{ background: "oklch(0.985 0.002 240)" }}>
                                <TableHead className="text-xs py-2">Faixa Etária</TableHead>
                                <TableHead className="text-right text-xs py-2">Titular</TableHead>
                                <TableHead className="text-right text-xs py-2">Dependente</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {faixas.sort((a, b) => a.faixaInicio - b.faixaInicio).map((f) => (
                                <TableRow key={f.id} className="text-sm hover:bg-muted/30">
                                  <TableCell className="py-1.5 text-xs">{faixaLabel(f.faixaInicio, f.faixaFim)}</TableCell>
                                  <TableCell className="py-1.5 text-right font-medium text-xs">{formatMoeda(f.valorTitular)}</TableCell>
                                  <TableCell className="py-1.5 text-right text-xs text-muted-foreground">{formatMoeda(f.valorDependente)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-aba: Coparticipação ──────────────────────────────────────────────────
function Coparticipacao() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  // Modal de lançamento/edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Coparticipacao | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state
  const [formNumeroBeneficiario, setFormNumeroBeneficiario] = useState("");
  const [formEmpresa, setFormEmpresa] = useState<string>("");
  const [formNome, setFormNome] = useState("");
  const [formTipo, setFormTipo] = useState<"T" | "D">("T");
  const [formValor, setFormValor] = useState("");
  const [formObs, setFormObs] = useState("");

  // Busca de beneficiário no formulário
  const [buscaBenef, setBuscaBenef] = useState("");
  const [buscaBenefDebounced, setBuscaBenefDebounced] = useState("");

  const handleBuscaBenef = useCallback((val: string) => {
    setBuscaBenef(val);
    clearTimeout((handleBuscaBenef as any)._t);
    (handleBuscaBenef as any)._t = setTimeout(() => setBuscaBenefDebounced(val), 300);
  }, []);

  const { data: beneficiariosBusca = [] } = trpc.planoSaude.list.useQuery(
    {
      busca: buscaBenefDebounced || undefined,
      empresa: formEmpresa && formEmpresa !== "todas" ? formEmpresa : undefined,
      mesReferencia: 7,
      anoReferencia: 2026,
    },
    { enabled: buscaBenefDebounced.length >= 2 }
  );

  const anos = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => cur - 2 + i);
  }, []);

  const utils = trpc.useUtils();

  const { data: lancamentos = [], isLoading } = trpc.coparticipacao.list.useQuery({
    empresa: empresaFiltro !== "todas" ? empresaFiltro : undefined,
    mes,
    ano,
  });

  const { data: resumo = [] } = trpc.coparticipacao.resumo.useQuery({ mes, ano });

  const createMutation = trpc.coparticipacao.create.useMutation({
    onSuccess: () => {
      utils.coparticipacao.list.invalidate();
      utils.coparticipacao.resumo.invalidate();
      toast.success("Coparticipação registrada com sucesso.");
      fecharModal();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const updateMutation = trpc.coparticipacao.update.useMutation({
    onSuccess: () => {
      utils.coparticipacao.list.invalidate();
      utils.coparticipacao.resumo.invalidate();
      toast.success("Coparticipação atualizada.");
      fecharModal();
    },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteMutation = trpc.coparticipacao.delete.useMutation({
    onSuccess: () => {
      utils.coparticipacao.list.invalidate();
      utils.coparticipacao.resumo.invalidate();
      toast.success("Lançamento removido.");
      setDeleteId(null);
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function abrirNovo() {
    setEditItem(null);
    setFormNumeroBeneficiario("");
    setFormEmpresa("");
    setFormNome("");
    setFormTipo("T");
    setFormValor("");
    setFormObs("");
    setBuscaBenef("");
    setBuscaBenefDebounced("");
    setModalOpen(true);
  }

  function abrirEditar(item: Coparticipacao) {
    setEditItem(item);
    setFormNumeroBeneficiario(item.numeroBeneficiario);
    setFormEmpresa(item.empresa);
    setFormNome(item.nomeBeneficiario);
    setFormTipo(item.tipoBeneficiario);
    setFormValor(String(item.valor));
    setFormObs(item.observacao ?? "");
    setBuscaBenef(item.nomeBeneficiario);
    setBuscaBenefDebounced("");
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setEditItem(null);
  }

  function selecionarBeneficiario(b: Beneficiario) {
    setFormNumeroBeneficiario(b.numeroBeneficiario);
    setFormEmpresa(b.empresa);
    setFormNome(b.nome);
    setFormTipo(b.tipo);
    setBuscaBenef(b.nome);
    setBuscaBenefDebounced("");
  }

  function salvar() {
    const valor = parseFloat(formValor.replace(",", "."));
    if (!formNumeroBeneficiario) { toast.error("Selecione um beneficiário."); return; }
    if (!formEmpresa) { toast.error("Empresa não identificada."); return; }
    if (isNaN(valor) || valor < 0) { toast.error("Informe um valor válido."); return; }

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, valor, observacao: formObs || undefined });
    } else {
      createMutation.mutate({
        numeroBeneficiario: formNumeroBeneficiario,
        empresa: formEmpresa,
        nomeBeneficiario: formNome,
        tipoBeneficiario: formTipo,
        mes,
        ano,
        valor,
        observacao: formObs || undefined,
      });
    }
  }

  // Filtro local por busca
  const filtered = useMemo(() => {
    const base = lancamentos as Coparticipacao[];
    if (!busca.trim()) return base;
    const q = busca.toLowerCase();
    return base.filter(
      (r) =>
        r.nomeBeneficiario.toLowerCase().includes(q) ||
        r.numeroBeneficiario.toLowerCase().includes(q) ||
        (r.observacao ?? "").toLowerCase().includes(q)
    );
  }, [lancamentos, busca]);

  // Totais por empresa (do resumo)
  const totalGeral = useMemo(() => {
    return (resumo as any[]).reduce((acc, r) => acc + (r.totalValor ?? 0), 0);
  }, [resumo]);

  const totalPorEmpresa = useMemo(() => {
    const map: Record<string, { totalValor: number; totalLancamentos: number }> = {};
    for (const emp of EMPRESAS) {
      const r = (resumo as any[]).find((x) => x.empresa === emp);
      map[emp] = { totalValor: r?.totalValor ?? 0, totalLancamentos: r?.totalLancamentos ?? 0 };
    }
    return map;
  }, [resumo]);

  const exportarExcel = () => {
    const dados = filtered.map((r) => ({
      Empresa: EMPRESA_LABELS[r.empresa] ?? r.empresa,
      "Nº Beneficiário": r.numeroBeneficiario,
      Nome: r.nomeBeneficiario,
      Tipo: r.tipoBeneficiario === "T" ? "Titular" : "Dependente",
      "Mês/Ano": `${String(r.mes).padStart(2, "0")}/${r.ano}`,
      "Valor (R$)": r.valor,
      Observação: r.observacao ?? "",
      "Registrado por": r.createdByNome ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coparticipação");
    XLSX.writeFile(wb, `coparticipacao_${String(mes).padStart(2, "0")}_${ano}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Seletor de competência */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium shrink-0">Competência:</Label>
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES_LABELS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={abrirNovo} className="gap-2" style={{ background: "oklch(0.20 0.08 252)", color: "white" }}>
            <Plus className="h-4 w-4" />
            Novo lançamento
          </Button>
        </div>
      </div>

      {/* Cards de resumo por empresa */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {EMPRESAS.map((emp) => {
          const t = totalPorEmpresa[emp];
          const isActive = empresaFiltro === emp;
          return (
            <button
              key={emp}
              onClick={() => setEmpresaFiltro(isActive ? "todas" : emp)}
              className="text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: isActive ? "oklch(0.97 0.018 68)" : "white",
                border: `1px solid ${isActive ? "oklch(0.48 0.20 252)" : "oklch(0.885 0.006 240)"}`,
                boxShadow: isActive
                  ? "0 4px 16px oklch(0.45 0.18 250 / 0.18), 0 0 0 2px oklch(0.45 0.18 250 / 0.15)"
                  : "0 1px 4px oklch(0.22 0.08 250 / 0.06)",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: isActive ? "oklch(0.55 0.13 68)" : "oklch(0.52 0.012 240)" }}>
                {EMPRESA_LABELS[emp]}
              </p>
              <p className="text-2xl font-black leading-none tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: isActive ? "oklch(0.40 0.10 68)" : "oklch(0.13 0.07 254)" }}>
                <PrivacyValue value={formatMoeda(t.totalValor)} iconSize={12} />
              </p>
              <p className="text-xs mt-1 font-medium"
                style={{ color: isActive ? "oklch(0.55 0.13 68)" : "oklch(0.60 0.010 240)" }}>
                {t.totalLancamentos} lançamento{t.totalLancamentos !== 1 ? "s" : ""}
              </p>
            </button>
          );
        })}
      </div>

      {/* Card total geral */}
      <div
        className="rounded-xl px-5 py-3.5 flex flex-wrap gap-6 items-center"
        style={{ background: "oklch(0.14 0.016 240)", border: "1px solid oklch(0.25 0.09 252)" }}
      >
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4" style={{ color: "oklch(0.48 0.20 252)" }} />
          <span className="text-sm font-medium text-white">
            <span className="text-lg font-bold">{(resumo as any[]).reduce((a, r) => a + (r.totalLancamentos ?? 0), 0)}</span> lançamentos no mês
          </span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs" style={{ color: "oklch(0.60 0.008 240)" }}>Total coparticipação</div>
          <div className="text-xl font-bold" style={{ color: "oklch(0.48 0.20 252)" }}>
            <PrivacyValue value={formatMoeda(totalGeral)} iconSize={14} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou nº beneficiário..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {EMPRESAS.map((emp) => (
              <SelectItem key={emp} value={emp}>{EMPRESA_LABELS[emp]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportarExcel} className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Tabela de lançamentos */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : (
        <Card className="overflow-hidden border border-border/60">
          <CardHeader className="pb-3 pt-3 px-5"
            style={{ background: "oklch(0.97 0.003 240)", borderBottom: "1px solid oklch(0.90 0.006 240)" }}>
            <CardTitle className="text-base font-semibold">
              Lançamentos — {MESES_LABELS[mes - 1]}/{ano}
              {empresaFiltro !== "todas" && ` · ${EMPRESA_LABELS[empresaFiltro]}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow style={{ background: "oklch(0.985 0.002 240)" }}>
                  <TableHead>Nº Beneficiário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Empresa</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="hidden lg:table-cell">Observação</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs text-muted-foreground">Registrado por</TableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt className="h-8 w-8 opacity-30" />
                        <span>Nenhum lançamento encontrado para {MESES_LABELS[mes - 1]}/{ano}</span>
                        <Button size="sm" variant="outline" onClick={abrirNovo} className="mt-1 gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          Novo lançamento
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{item.numeroBeneficiario}</TableCell>
                      <TableCell className="font-medium">
                        <span className="truncate max-w-[180px] block" title={item.nomeBeneficiario}>
                          {item.nomeBeneficiario}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {EMPRESA_LABELS[item.empresa] ?? item.empresa}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className="text-xs border-0 font-medium"
                          style={
                            item.tipoBeneficiario === "T"
                              ? { background: "oklch(0.20 0.08 252)", color: "white" }
                              : { background: "oklch(0.95 0.005 240)", color: "oklch(0.35 0.012 240)", border: "1px solid oklch(0.80 0.008 240)" }
                          }
                        >
                          {item.tipoBeneficiario === "T" ? "Titular" : "Dependente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold" style={{ color: "oklch(0.50 0.12 68)" }}>
                        {formatMoeda(item.valor)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.observacao || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {item.createdByNome || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => abrirEditar(item)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteId(item.id)}
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t flex items-center justify-between"
                style={{ background: "oklch(0.97 0.003 240)" }}>
                <span className="text-sm text-muted-foreground">
                  {filtered.length} lançamento{filtered.length !== 1 ? "s" : ""}
                </span>
                <span className="text-sm font-bold" style={{ color: "oklch(0.50 0.12 68)" }}>
                  Total: {formatMoeda(filtered.reduce((a, r) => a + r.valor, 0))}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de novo/editar lançamento */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) fecharModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Coparticipação" : "Novo Lançamento de Coparticipação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Competência (somente visualização no modal) */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ background: "oklch(0.97 0.003 240)", border: "1px solid oklch(0.90 0.006 240)" }}>
              <span className="text-muted-foreground">Competência:</span>
              <span className="font-semibold">{MESES_LABELS[mes - 1]}/{ano}</span>
            </div>

            {/* Busca de beneficiário (somente no novo lançamento) */}
            {!editItem && (
              <div className="space-y-1.5">
                <Label>Beneficiário <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o nome ou nº beneficiário..."
                    className="pl-9"
                    value={buscaBenef}
                    onChange={(e) => handleBuscaBenef(e.target.value)}
                  />
                </div>
                {buscaBenefDebounced.length >= 2 && (beneficiariosBusca as Beneficiario[]).length > 0 && (
                  <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto"
                    style={{ borderColor: "oklch(0.88 0.006 240)" }}>
                    {(beneficiariosBusca as Beneficiario[]).slice(0, 10).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 border-b last:border-0"
                        style={{ borderColor: "oklch(0.92 0.004 240)" }}
                        onClick={() => selecionarBeneficiario(b)}
                      >
                        <div>
                          <span className="font-medium">{b.nome}</span>
                          <span className="text-xs text-muted-foreground ml-2">Nº {b.numeroBeneficiario}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">{EMPRESA_LABELS[b.empresa]}</span>
                          <Badge className="text-xs border-0 font-medium"
                            style={b.tipo === "T"
                              ? { background: "oklch(0.20 0.08 252)", color: "white" }
                              : { background: "oklch(0.95 0.005 240)", color: "oklch(0.35 0.012 240)", border: "1px solid oklch(0.80 0.008 240)" }
                            }>
                            {b.tipo === "T" ? "Titular" : "Dep."}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {formNumeroBeneficiario && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ background: "oklch(0.97 0.018 68)", border: "1px solid oklch(0.85 0.08 68)" }}>
                    <span className="font-medium" style={{ color: "oklch(0.40 0.10 68)" }}>{formNome}</span>
                    <span className="text-xs" style={{ color: "oklch(0.55 0.13 68)" }}>
                      Nº {formNumeroBeneficiario} · {EMPRESA_LABELS[formEmpresa] ?? formEmpresa}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Beneficiário (somente visualização na edição) */}
            {editItem && (
              <div className="space-y-1.5">
                <Label>Beneficiário</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                  style={{ background: "oklch(0.97 0.003 240)", border: "1px solid oklch(0.90 0.006 240)" }}>
                  <span className="font-medium">{formNome}</span>
                  <span className="text-xs text-muted-foreground">
                    Nº {formNumeroBeneficiario} · {EMPRESA_LABELS[formEmpresa] ?? formEmpresa}
                  </span>
                </div>
              </div>
            )}

            {/* Valor */}
            <div className="space-y-1.5">
              <Label>Valor da Coparticipação (R$) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
              />
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Input
                placeholder="Ex: Consulta cardiologista, exame laboratorial..."
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal} disabled={isPending}>Cancelar</Button>
            <Button onClick={salvar} disabled={isPending}
              style={{ background: "oklch(0.20 0.08 252)", color: "white" }}>
              {isPending ? "Salvando..." : editItem ? "Salvar alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O registro de coparticipação será excluído permanentemente.
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

// ─── Sub-aba: Beneficiários ───────────────────────────────────────────────────
function Beneficiarios() {
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  // Modal Novo Beneficiário
  const [novoModal, setNovoModal] = useState(false);
  const [nEmpresa, setNEmpresa] = useState<"FREIRE"|"JOANES"|"SUDOESTE"|"SOLAR">("FREIRE");
  const [nNome, setNNome] = useState("");
  const [nCpf, setNCpf] = useState("");
  const [nDataNasc, setNDataNasc] = useState("");
  const [nMatricula, setNMatricula] = useState("");
  const [nTipo, setNTipo] = useState<"T"|"D">("T");
  const [nTipoDepend, setNTipoDepend] = useState<"Filho/Filha"|"Conjuge"|"Agregado"|"">("Filho/Filha");
  const [nPlano, setNPlano] = useState("");
  const [nMensalidade, setNMensalidade] = useState("");
  const [nTitularNum, setNTitularNum] = useState("");
  const [nNumBenef, setNNumBenef] = useState("");
  // Busca de colaborador existente no modal
  const [buscaColab, setBuscaColab] = useState("");
  const [buscaColabDebounced, setBuscaColabDebounced] = useState("");
  const handleBuscaColab = useCallback((val: string) => {
    setBuscaColab(val);
    clearTimeout((handleBuscaColab as any)._t);
    (handleBuscaColab as any)._t = setTimeout(() => setBuscaColabDebounced(val), 300);
  }, []);

  const handleBusca = useCallback((val: string) => {
    setBusca(val);
    clearTimeout((handleBusca as any)._t);
    (handleBusca as any)._t = setTimeout(() => setBuscaDebounced(val), 300);
  }, []);

  const hoje = useMemo(() => new Date(), []);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const anos = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => cur - 2 + i);
  }, []);

  const { data: beneficiarios = [], isLoading } = trpc.planoSaude.list.useQuery({
    empresa: empresaFiltro !== "todas" ? empresaFiltro : undefined,
    busca: buscaDebounced || undefined,
    mesReferencia: mes,
    anoReferencia: ano,
  });

  const { data: resumo = [] } = trpc.planoSaude.resumo.useQuery({
    mesReferencia: mes,
    anoReferencia: ano,
  });

  const { data: precos = [] } = trpc.tabelaPrecos.list.useQuery({ empresa: undefined });

  // Busca de colaboradores para o modal (listAtivos retorna array direto)
  const { data: todosColabsAtivos = [] } = trpc.colaboradores.listAtivos.useQuery(undefined);
  const colabsBusca = useMemo(() => {
    if (buscaColabDebounced.length < 2) return [];
    const q = buscaColabDebounced.toLowerCase();
    return (todosColabsAtivos as any[]).filter((c: any) =>
      c.nome.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [todosColabsAtivos, buscaColabDebounced]);

  // Estado do modal de edição de beneficiário
  const [editBenefModal, setEditBenefModal] = useState(false);
  const [editBenefItem, setEditBenefItem] = useState<Beneficiario | null>(null);
  const [editBenefNome, setEditBenefNome] = useState("");
  const [editBenefCpf, setEditBenefCpf] = useState("");
  const [editBenefDataNasc, setEditBenefDataNasc] = useState("");
  const [editBenefMatricula, setEditBenefMatricula] = useState("");
  const [editBenefPlano, setEditBenefPlano] = useState("");
  const [editBenefMensalidade, setEditBenefMensalidade] = useState("");
  const [editBenefTipo, setEditBenefTipo] = useState<"T"|"D">("T");
  const [editBenefTipoDepend, setEditBenefTipoDepend] = useState<"Filho/Filha"|"Conjuge"|"Agregado"|"">("Filho/Filha");
  const [editBenefTitularNum, setEditBenefTitularNum] = useState("");

  const updateBenefMutation = trpc.planoSaude.update.useMutation({
    onSuccess: () => {
      toast.success("Beneficiário atualizado com sucesso!");
      setEditBenefModal(false);
      setEditBenefItem(null);
      utils.planoSaude.list.invalidate();
      utils.planoSaude.resumo.invalidate();
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  function abrirEditBenef(b: Beneficiario) {
    setEditBenefItem(b);
    setEditBenefNome(b.nome);
    setEditBenefCpf(b.cpf || "");
    setEditBenefDataNasc(b.dataNascimento || "");
    setEditBenefMatricula(b.matriculaFuncional || "");
    setEditBenefPlano(b.plano);
    setEditBenefMensalidade(String(b.mensalidade));
    setEditBenefTipo(b.tipo as "T"|"D");
    setEditBenefTipoDepend((b.tipoDepend as any) || "Filho/Filha");
    setEditBenefTitularNum(b.titularNumeroBeneficiario || "");
    setEditBenefModal(true);
  }

  function salvarEditBenef() {
    if (!editBenefItem) return;
    if (!editBenefNome.trim()) { toast.error("Informe o nome"); return; }
    const mensalidade = parseFloat(editBenefMensalidade);
    if (isNaN(mensalidade) || mensalidade < 0) { toast.error("Informe um valor de mensalidade válido"); return; }
    updateBenefMutation.mutate({
      id: editBenefItem.id,
      nome: editBenefNome.trim(),
      cpf: editBenefCpf.replace(/\D/g, "") || undefined,
      dataNascimento: editBenefDataNasc || undefined,
      matriculaFuncional: editBenefMatricula.trim() || undefined,
      plano: editBenefPlano || undefined,
      mensalidade,
      tipo: editBenefTipo,
      tipoDepend: editBenefTipo === "D" ? editBenefTipoDepend : "",
      titularNumeroBeneficiario: editBenefTipo === "D" ? editBenefTitularNum.trim() || undefined : undefined,
    });
  }

  // Próximo número de beneficiário
  const { data: proximoNum } = trpc.planoSaude.proximoNumero.useQuery(
    { empresa: nEmpresa },
    { enabled: novoModal }
  );

  // Planos disponíveis para a empresa selecionada no modal
  const planosDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of precos as FaixaPreco[]) {
      if (p.empresa === nEmpresa) {
        map.set(p.codigoPlano, p.nomePlano);
      }
    }
    return Array.from(map.entries()).map(([codigo, nome]) => ({ codigo, nome }));
  }, [precos, nEmpresa]);

  // Calcula idade a partir da data de nascimento
  const idadeCalculada = useMemo(() => {
    if (!nDataNasc || nDataNasc.length < 10) return 0;
    const nasc = new Date(nDataNasc);
    if (isNaN(nasc.getTime())) return 0;
    const agora = new Date();
    let idade = agora.getFullYear() - nasc.getFullYear();
    const m = agora.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && agora.getDate() < nasc.getDate())) idade--;
    return Math.max(0, idade);
  }, [nDataNasc]);

  // Busca o valor automático da tabela de preços
  const valorAutomatico = useMemo(() => {
    if (!nPlano || !nEmpresa) return null;
    const faixa = (precos as FaixaPreco[]).find(
      (p) => p.empresa === nEmpresa && p.codigoPlano === nPlano &&
        p.faixaInicio <= idadeCalculada && p.faixaFim >= idadeCalculada
    );
    if (!faixa) return null;
    return nTipo === "T" ? faixa.valorTitular : faixa.valorDependente;
  }, [precos, nEmpresa, nPlano, idadeCalculada, nTipo]);

  // Quando muda o plano/tipo/empresa/idade, atualiza o valor automaticamente
  useEffect(() => {
    if (valorAutomatico !== null) {
      setNMensalidade(String(valorAutomatico.toFixed(2)));
    }
  }, [valorAutomatico]);

  // Código do plano base para subsídio (Prata QC — mesmo código em todas as empresas)
  const PLANO_BASE_SUBSIDIO = "967067";
  // Planos que recebem subsídio direto de 70% (Prata QC e Prata Enfermaria)
  const isPlanoPrata = (codigo: string) =>
    codigo === "967067" || (precos as FaixaPreco[]).find(p => p.codigoPlano === codigo && p.nomePlano.toUpperCase().includes("PRATA ENF")) !== undefined;

  // Calcula subsídio e valor líquido do colaborador
  const calculoSubsidio = useMemo(() => {
    if (!nPlano || !nEmpresa || idadeCalculada === 0) return null;
    const valorBruto = valorAutomatico;
    if (valorBruto === null) return null;
    // Busca o valor do Prata QC para a mesma empresa, faixa etária e tipo
    const faixaPrataQC = (precos as FaixaPreco[]).find(
      (p) => p.empresa === nEmpresa && p.codigoPlano === PLANO_BASE_SUBSIDIO &&
        p.faixaInicio <= idadeCalculada && p.faixaFim >= idadeCalculada
    );
    const valorPrataQC = faixaPrataQC ? (nTipo === "T" ? faixaPrataQC.valorTitular : faixaPrataQC.valorDependente) : 0;
    const subsidio = valorPrataQC * 0.7; // empresa subsidia 70% do Prata QC
    if (isPlanoPrata(nPlano)) {
      // Prata QC / Prata Enfermaria: colaborador paga 30%
      return { valorBruto, subsidio, valorColaborador: valorBruto - subsidio, isPrata: true };
    } else {
      // Outros planos: colaborador paga valor do plano menos o subsídio do Prata QC
      const valorColaborador = Math.max(0, valorBruto - subsidio);
      return { valorBruto, subsidio, valorColaborador, isPrata: false };
    }
  }, [precos, nEmpresa, nPlano, idadeCalculada, nTipo, valorAutomatico]);

  // Quando abre o modal, pré-preenche o número de beneficiário
  useEffect(() => {
    if (novoModal && proximoNum) {
      setNNumBenef(proximoNum);
    }
  }, [novoModal, proximoNum]);

  const utils = trpc.useUtils();

  // Gerar competência do próximo mês
  const [gerarModal, setGerarModal] = useState(false);
  const gerarMutation = trpc.planoSaude.gerarCompetencia.useMutation({
    onSuccess: (result) => {
      utils.planoSaude.list.invalidate();
      utils.planoSaude.resumo.invalidate();
      toast.success(`Competência gerada com sucesso! ${result.inseridos} beneficiário(s) copiado(s).`);
      setGerarModal(false);
      // Navegar para o mês destino automaticamente
      const destMes = mes === 12 ? 1 : mes + 1;
      const destAno = mes === 12 ? ano + 1 : ano;
      setMes(destMes);
      setAno(destAno);
    },
    onError: (err) => toast.error("Erro ao gerar competência: " + err.message),
  });

  const createMutation = trpc.planoSaude.create.useMutation({
    onSuccess: () => {
      utils.planoSaude.list.invalidate();
      utils.planoSaude.resumo.invalidate();
      toast.success("Beneficiário adicionado com sucesso!");
      fecharNovoModal();
    },
    onError: (err) => toast.error("Erro ao adicionar: " + err.message),
  });

  function abrirNovoModal() {
    setNEmpresa("FREIRE");
    setNNome("");
    setNCpf("");
    setNDataNasc("");
    setNMatricula("");
    setNTipo("T");
    setNTipoDepend("Filho/Filha");
    setNPlano("");
    setNMensalidade("");
    setNTitularNum("");
    setNNumBenef("");
    setBuscaColab("");
    setBuscaColabDebounced("");
    setNovoModal(true);
  }

  function fecharNovoModal() {
    setNovoModal(false);
  }

  function selecionarColab(colab: any) {
    setNNome(colab.nome ?? "");
    if (colab.cpf) setNCpf(colab.cpf);
    if (colab.dataNascimento) setNDataNasc(colab.dataNascimento);
    // Preencher empresa automaticamente a partir do empresaNome do colaborador
    if (colab.empresaNome) {
      const empCodigo = (colab.empresaNome as string).toUpperCase();
      if (["FREIRE", "JOANES", "SUDOESTE", "SOLAR"].includes(empCodigo)) {
        setNEmpresa(empCodigo as any);
        setNPlano(""); // limpar plano ao trocar empresa
      }
    }
    setBuscaColab("");
    setBuscaColabDebounced("");
  }

  function salvarNovoBenef() {
    if (!nNome.trim()) { toast.error("Informe o nome do beneficiário"); return; }
    if (!nPlano) { toast.error("Selecione o plano"); return; }
    if (!nNumBenef.trim()) { toast.error("Informe o número do beneficiário"); return; }
    const mensalidade = parseFloat(nMensalidade);
    if (isNaN(mensalidade) || mensalidade < 0) { toast.error("Informe um valor de mensalidade válido"); return; }
    createMutation.mutate({
      empresa: nEmpresa,
      numeroBeneficiario: nNumBenef.trim(),
      nome: nNome.trim(),
      cpf: nCpf.replace(/\D/g, "") || undefined,
      dataNascimento: nDataNasc || undefined,
      idade: idadeCalculada,
      plano: nPlano,
      tipo: nTipo,
      tipoDepend: nTipo === "D" ? nTipoDepend : "",
      mensalidade,
      matriculaFuncional: nMatricula.trim() || undefined,
      titularNumeroBeneficiario: nTipo === "D" ? nTitularNum.trim() || undefined : undefined,
      mesReferencia: mes,
      anoReferencia: ano,
    });
  }

  const totaisPorEmpresa = useMemo(() => {
    const map: Record<string, { titulares: number; dependentes: number; totalMensalidade: number }> = {};
    for (const emp of EMPRESAS) {
      const rows = resumo.filter((r: any) => r.empresa === emp);
      const titulares = rows.find((r: any) => r.tipo === "T")?.total ?? 0;
      const dependentes = rows.find((r: any) => r.tipo === "D")?.total ?? 0;
      const totalMensalidade = rows.reduce((acc: number, r: any) => acc + (r.totalMensalidade ?? 0), 0);
      map[emp] = { titulares: Number(titulares), dependentes: Number(dependentes), totalMensalidade };
    }
    return map;
  }, [resumo]);

  const totalGeral = useMemo(() => {
    return Object.values(totaisPorEmpresa).reduce(
      (acc, e) => ({
        titulares: acc.titulares + e.titulares,
        dependentes: acc.dependentes + e.dependentes,
        totalMensalidade: acc.totalMensalidade + e.totalMensalidade,
      }),
      { titulares: 0, dependentes: 0, totalMensalidade: 0 }
    );
  }, [totaisPorEmpresa]);

  const porEmpresa = useMemo(() => {
    const map: Record<string, Familia[]> = {};
    for (const emp of EMPRESAS) {
      const bEmp = (beneficiarios as Beneficiario[]).filter((b) => b.empresa === emp);
      map[emp] = agruparFamilias(bEmp);
    }
    return map;
  }, [beneficiarios]);

  const mudancasFaixaEtaria = useMemo(() => {
    const alertas = new Set<string>();
    for (const b of beneficiarios as Beneficiario[]) {
      if (b.tipo !== "T") continue;
      const idadeAtual = b.idade;
      const idadeProxima = idadeAtual + 1;
      const faixasPlano = (precos as FaixaPreco[]).filter(
        (p) => p.empresa === b.empresa && b.plano.includes(p.codigoPlano)
      );
      const faixaAtual = faixasPlano.find((f) => f.faixaInicio <= idadeAtual && f.faixaFim >= idadeAtual);
      const faixaProxima = faixasPlano.find((f) => f.faixaInicio <= idadeProxima && f.faixaFim >= idadeProxima);
      if (faixaAtual && faixaProxima && faixaAtual.id !== faixaProxima.id) {
        alertas.add(b.numeroBeneficiario);
      }
    }
    return alertas;
  }, [beneficiarios, precos]);

  const toggleFamilia = (key: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportarExcel = () => {
    const dados = (beneficiarios as Beneficiario[]).map((b) => ({
      Empresa: EMPRESA_LABELS[b.empresa] ?? b.empresa,
      "Nº Beneficiário": b.numeroBeneficiario,
      Nome: b.nome,
      Matrícula: b.matriculaFuncional || "",
      CPF: formatCPF(b.cpf || ""),
      Plano: b.plano,
      Tipo: TIPO_LABELS[b.tipo] ?? b.tipo,
      Idade: b.idade,
      Dependência: DEP_LABELS[b.tipoDepend] ?? b.tipoDepend,
      "Mensalidade (R$)": b.mensalidade,
      "Total Família (R$)": b.totalFamilia ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plano de Saúde");
    XLSX.writeFile(wb, `plano_saude_jul_2026${empresaFiltro !== "todas" ? `_${empresaFiltro}` : ""}.xlsx`);
  };

  const empresasExibir = empresaFiltro !== "todas" ? [empresaFiltro] : EMPRESAS;

  return (
    <div className="space-y-5">
      {/* Cards de resumo por empresa */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {EMPRESAS.map((emp) => {
          const t = totaisPorEmpresa[emp];
          const isActive = empresaFiltro === emp;
          return (
            <button
              key={emp}
              onClick={() => setEmpresaFiltro(isActive ? "todas" : emp)}
              className="text-left rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: isActive ? "oklch(0.97 0.018 68)" : "white",
                border: `1px solid ${isActive ? "oklch(0.48 0.20 252)" : "oklch(0.885 0.006 240)"}`,
                boxShadow: isActive
                  ? "0 4px 16px oklch(0.45 0.18 250 / 0.18), 0 0 0 2px oklch(0.45 0.18 250 / 0.15)"
                  : "0 1px 4px oklch(0.22 0.08 250 / 0.06)",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: isActive ? "oklch(0.55 0.13 68)" : "oklch(0.52 0.012 240)" }}>
                {EMPRESA_LABELS[emp]}
              </p>
              <p className="text-2xl font-black leading-none tracking-tight"
                style={{ fontFamily: "var(--font-display)", color: isActive ? "oklch(0.40 0.10 68)" : "oklch(0.13 0.07 254)" }}>
                {t.titulares + t.dependentes}
              </p>
              <p className="text-xs mt-1 font-medium"
                style={{ color: isActive ? "oklch(0.55 0.13 68)" : "oklch(0.60 0.010 240)" }}>
                {t.titulares} tit. · {t.dependentes} dep.
              </p>
              <p className="text-sm font-bold mt-1.5"
                style={{ color: isActive ? "oklch(0.50 0.12 68)" : "oklch(0.25 0.015 240)" }}>
                <PrivacyValue value={formatMoeda(t.totalMensalidade)} iconSize={11} />
              </p>
            </button>
          );
        })}
      </div>

      {/* Card total geral */}
      <div className="rounded-xl px-5 py-3.5 flex flex-wrap gap-6 items-center"
        style={{ background: "oklch(0.14 0.016 240)", border: "1px solid oklch(0.25 0.09 252)" }}>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "oklch(0.48 0.20 252)" }} />
          <span className="text-sm font-medium text-white">
            <span className="text-lg font-bold">{totalGeral.titulares + totalGeral.dependentes}</span> beneficiários
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" style={{ color: "oklch(0.48 0.20 252)" }} />
          <span className="text-sm font-medium text-white">
            <span className="text-lg font-bold">{totalGeral.titulares}</span> titulares ·{" "}
            <span className="text-lg font-bold">{totalGeral.dependentes}</span> dependentes
          </span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs" style={{ color: "oklch(0.60 0.008 240)" }}>Total mensal</div>
          <div className="text-xl font-bold" style={{ color: "oklch(0.48 0.20 252)" }}>
            <PrivacyValue value={formatMoeda(totalGeral.totalMensalidade)} iconSize={14} />
          </div>
        </div>
      </div>

      {/* Seletor de competência */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium shrink-0">Competência:</Label>
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MESES_LABELS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={String(a)}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-1">
          {(beneficiarios as Beneficiario[]).length > 0
            ? `${(beneficiarios as Beneficiario[]).length} beneficiário${(beneficiarios as Beneficiario[]).length !== 1 ? "s" : ""}`
            : isLoading ? "Carregando..." : "Nenhum beneficiário neste mês"}
        </span>
      </div>

      {/* Filtros + Exportar + Novo */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, nº beneficiário ou CPF..."
            className="pl-9"
            value={busca}
            onChange={(e) => handleBusca(e.target.value)}
          />
        </div>
        <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {EMPRESAS.map((emp) => (
              <SelectItem key={emp} value={emp}>{EMPRESA_LABELS[emp]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportarExcel} className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Exportar Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setGerarModal(true)}
          className="gap-2 shrink-0"
          title="Gerar competência do próximo mês copiando os beneficiários atuais"
        >
          <span className="text-base leading-none">📋</span>
          Gerar Próximo Mês
        </Button>
        <Button
          size="sm"
          onClick={abrirNovoModal}
          className="gap-2 shrink-0 text-white"
          style={{ background: "oklch(0.20 0.08 252)" }}
        >
          <Plus className="h-4 w-4" />
          Novo Beneficiário
        </Button>
      </div>

      {/* Modal Gerar Competência */}
      <AlertDialog open={gerarModal} onOpenChange={setGerarModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar Competência {mes === 12 ? 1 : mes + 1}/{mes === 12 ? ano + 1 : ano}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação irá copiar todos os <strong>{(beneficiarios as Beneficiario[]).length} beneficiário(s)</strong> da
                competência <strong>{MESES_LABELS[mes - 1]}/{ano}</strong> para
                <strong> {MESES_LABELS[(mes === 12 ? 0 : mes)]}/{mes === 12 ? ano + 1 : ano}</strong>.
              </p>
              <p className="text-sm">
                As idades serão recalculadas automaticamente e os valores serão atualizados conforme a tabela de preços vigente.
                Beneficiários que mudaram de faixa etária terão o valor corrigido.
              </p>
              {(beneficiarios as Beneficiario[]).length === 0 && (
                <p className="text-red-500 text-sm font-medium">
                  ⚠️ Não há beneficiários na competência atual para copiar.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={gerarMutation.isPending || (beneficiarios as Beneficiario[]).length === 0}
              onClick={() => {
                const destMes = mes === 12 ? 1 : mes + 1;
                const destAno = mes === 12 ? ano + 1 : ano;
                gerarMutation.mutate({
                  origemMes: mes,
                  origemAno: ano,
                  destinoMes: destMes,
                  destinoAno: destAno,
                });
              }}
            >
              {gerarMutation.isPending ? "Gerando..." : "Confirmar e Gerar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Novo Beneficiário */}
      <Dialog open={novoModal} onOpenChange={(open) => { if (!open) fecharNovoModal(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" style={{ color: "oklch(0.48 0.20 252)" }} />
              Novo Beneficiário
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Busca de colaborador existente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buscar colaborador existente (opcional)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Digite o nome para buscar e pré-preencher..."
                  value={buscaColab}
                  onChange={(e) => handleBuscaColab(e.target.value)}
                />
              </div>
              {buscaColabDebounced.length >= 2 && (colabsBusca as any[]).length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto"
                  style={{ borderColor: "oklch(0.88 0.006 240)" }}>
                  {(colabsBusca as any[]).slice(0, 8).map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 border-b last:border-0"
                      style={{ borderColor: "oklch(0.92 0.004 240)" }}
                      onClick={() => selecionarColab(c)}
                    >
                      <span className="font-medium truncate">{c.nome}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.empresaNome ?? ""}</span>
                    </button>
                  ))}
                </div>
              )}
              {buscaColabDebounced.length >= 2 && (colabsBusca as any[]).length === 0 && (
                <p className="text-xs text-muted-foreground px-1">Nenhum colaborador encontrado</p>
              )}
            </div>

            <div className="border-t" style={{ borderColor: "oklch(0.92 0.004 240)" }} />

            {/* Empresa */}
            <div className="space-y-1.5">
              <Label>Empresa <span className="text-red-500">*</span></Label>
              <Select value={nEmpresa} onValueChange={(v) => setNEmpresa(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map((emp) => (
                    <SelectItem key={emp} value={emp}>{EMPRESA_LABELS[emp]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <Label>Nome completo <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Nome completo do beneficiário"
                value={nNome}
                onChange={(e) => setNNome(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* CPF + Data Nasc */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  placeholder="00000000000"
                  value={nCpf}
                  onChange={(e) => setNCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  maxLength={14}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={nDataNasc}
                  onChange={(e) => setNDataNasc(e.target.value)}
                />
                {nDataNasc && idadeCalculada > 0 && (
                  <p className="text-xs" style={{ color: "oklch(0.50 0.12 68)" }}>
                    {idadeCalculada} anos
                  </p>
                )}
              </div>
            </div>

            {/* Matrícula + Nº Beneficiário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Matrícula funcional</Label>
                <Input
                  placeholder="Ex: 00123"
                  value={nMatricula}
                  onChange={(e) => setNMatricula(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nº Beneficiário <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="Ex: 0042"
                  value={nNumBenef}
                  onChange={(e) => setNNumBenef(e.target.value)}
                  maxLength={20}
                />
              </div>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label>Tipo <span className="text-red-500">*</span></Label>
              <Select value={nTipo} onValueChange={(v) => setNTipo(v as "T" | "D")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T">Titular</SelectItem>
                  <SelectItem value="D">Dependente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de dependente (só se D) */}
            {nTipo === "D" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de dependência</Label>
                  <Select value={nTipoDepend} onValueChange={(v) => setNTipoDepend(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Filho/Filha">Filho/Filha</SelectItem>
                      <SelectItem value="Conjuge">Cônjuge</SelectItem>
                      <SelectItem value="Agregado">Agregado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nº Beneficiário do Titular</Label>
                  <Input
                    placeholder="Nº do titular"
                    value={nTitularNum}
                    onChange={(e) => setNTitularNum(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
            )}

            {/* Plano */}
            <div className="space-y-1.5">
              <Label>Plano <span className="text-red-500">*</span></Label>
              <Select value={nPlano} onValueChange={setNPlano}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano..." />
                </SelectTrigger>
                  <SelectContent>
                  {planosDisponiveis.map((p) => (
                    <SelectItem key={p.codigo} value={p.codigo}>
                      {formatPlano(p.nome)}
                    </SelectItem>
                  ))}
                  {planosDisponiveis.length === 0 && (
                    <SelectItem value="_" disabled>Nenhum plano cadastrado para esta empresa</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Mensalidade */}
            <div className="space-y-1.5">
              <Label>Mensalidade (R$) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={nMensalidade}
                onChange={(e) => setNMensalidade(e.target.value)}
              />
              {valorAutomatico !== null && (
                <p className="text-xs" style={{ color: "oklch(0.50 0.12 68)" }}>
                  Valor calculado automaticamente pela faixa etária ({idadeCalculada} anos)
                </p>
              )}
            </div>

            {/* Card de resumo de subsídio */}
            {calculoSubsidio !== null && idadeCalculada > 0 && (
              <div className="rounded-lg border p-3 space-y-2" style={{ background: "oklch(0.97 0.01 150)", borderColor: "oklch(0.85 0.06 150)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-bold" style={{ color: "oklch(0.30 0.10 150)" }}>
                    Resumo do Plano · {idadeCalculada} anos
                    {calculoSubsidio.isPrata ? " · Prata (70% subsidiado)" : " · Plano superior"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md p-2" style={{ background: "oklch(0.93 0.03 150)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.45 0.08 150)" }}>Valor do Plano</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.25 0.10 150)" }}>
                      R$ {calculoSubsidio.valorBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-md p-2" style={{ background: "oklch(0.93 0.05 250)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.40 0.10 250)" }}>Empresa Paga</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.25 0.12 250)" }}>
                      R$ {calculoSubsidio.subsidio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="rounded-md p-2" style={{ background: "oklch(0.93 0.05 30)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "oklch(0.45 0.10 30)" }}>Colaborador Paga</p>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.30 0.14 30)" }}>
                      R$ {calculoSubsidio.valorColaborador.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                {!calculoSubsidio.isPrata && (
                  <p className="text-[10px]" style={{ color: "oklch(0.45 0.08 150)" }}>
                    Subsídio calculado sobre 70% do Prata QC na mesma faixa etária
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharNovoModal} disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={salvarNovoBenef}
              disabled={createMutation.isPending}
              style={{ background: "oklch(0.20 0.08 252)", color: "white" }}
            >
              {createMutation.isPending ? "Salvando..." : "Adicionar Beneficiário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabelas por empresa */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {empresasExibir.map((emp) => {
            const familias = porEmpresa[emp] ?? [];
            if (familias.length === 0 && empresaFiltro !== "todas") return null;
            const totalEmp = familias.reduce((acc, f) => acc + f.totalFamilia, 0);
            return (
              <Card key={emp} className="overflow-hidden border border-border/60">
                <CardHeader className="pb-3 pt-3 px-5"
                  style={{ background: "oklch(0.97 0.003 240)", borderBottom: "1px solid oklch(0.90 0.006 240)" }}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: "oklch(0.48 0.20 252)" }} />
                      {EMPRESA_LABELS[emp]}
                    </CardTitle>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{familias.length} titular{familias.length !== 1 ? "es" : ""}</span>
                      <span>·</span>
                      <span>{familias.reduce((a, f) => a + f.dependentes.length, 0)} dep.</span>
                      <span>·</span>
                      <span className="font-bold text-sm" style={{ color: "oklch(0.50 0.12 68)" }}>
                        {formatMoeda(totalEmp)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow style={{ background: "oklch(0.985 0.002 240)" }}>
                        <TableHead className="w-8" />
                        <TableHead>Nº Beneficiário</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden md:table-cell">CPF</TableHead>
                        <TableHead className="hidden lg:table-cell">Matrícula</TableHead>
                        <TableHead className="hidden lg:table-cell">Plano</TableHead>
                        <TableHead className="text-center">Tipo</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Idade</TableHead>
                        <TableHead className="text-right">Mensalidade</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">Total Família</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {familias.map((familia) => {
                        const key = `${emp}-${familia.titular.numeroBeneficiario}`;
                        const expanded = expandidas.has(key);
                        const hasDeps = familia.dependentes.length > 0;
                        const mudaFaixa = mudancasFaixaEtaria.has(familia.titular.numeroBeneficiario);
                        return (
                          <>
                            <TableRow
                              key={key}
                              className={`${hasDeps ? "cursor-pointer hover:bg-muted/40" : ""} font-medium`}
                              onClick={() => hasDeps && toggleFamilia(key)}
                            >
                              <TableCell className="text-center">
                                {hasDeps ? (
                                  expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                ) : null}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{familia.titular.numeroBeneficiario}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[200px]" title={familia.titular.nome}>{familia.titular.nome}</span>
                                  {hasDeps && <Badge variant="secondary" className="text-xs shrink-0">+{familia.dependentes.length} dep.</Badge>}
                                  {mudaFaixa && (
                                    <span title="Muda de faixa etária no próximo aniversário">
                                      <AlertTriangle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                                {formatCPF(familia.titular.cpf || "")}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                {familia.titular.matriculaFuncional || "—"}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-xs">{formatPlano(familia.titular.plano)}</TableCell>
                              <TableCell className="text-center">
                                <Badge className="text-xs border-0 font-medium"
                                  style={{ background: "oklch(0.20 0.08 252)", color: "white" }}>
                                  Titular
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center hidden md:table-cell text-sm">{familia.titular.idade}</TableCell>
                              <TableCell className="text-right font-semibold text-sm">{formatMoeda(familia.titular.mensalidade)}</TableCell>
                              <TableCell className="text-right hidden sm:table-cell">
                                {familia.dependentes.length > 0 ? (
                                  <span className="font-bold text-sm" style={{ color: "oklch(0.50 0.12 68)" }}>
                                    {formatMoeda(familia.totalFamilia)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">{formatMoeda(familia.titular.mensalidade)}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); abrirEditBenef(familia.titular); }}
                                  title="Editar beneficiário"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {expanded && familia.dependentes.map((dep) => (
                              <TableRow key={dep.id} className="text-sm" style={{ background: "oklch(0.985 0.003 240)" }}>
                                <TableCell />
                                <TableCell className="font-mono text-xs text-muted-foreground pl-6">{dep.numeroBeneficiario}</TableCell>
                                <TableCell className="pl-6">
                                  <span className="truncate max-w-[200px] block" title={dep.nome}>{dep.nome}</span>
                                </TableCell>
                                <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                                  {formatCPF(dep.cpf || "")}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                  {dep.matriculaFuncional || "—"}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs">{formatPlano(dep.plano)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="text-xs border font-medium"
                                    style={dep.tipoDepend === "Conjuge"
                                      ? { background: "oklch(0.95 0.005 240)", color: "oklch(0.35 0.012 240)", borderColor: "oklch(0.80 0.008 240)" }
                                      : { background: "oklch(0.97 0.003 240)", color: "oklch(0.45 0.010 240)", borderColor: "oklch(0.85 0.006 240)" }
                                    }>
                                    {DEP_LABELS[dep.tipoDepend] || "Dependente"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center hidden md:table-cell text-sm">{dep.idade}</TableCell>
                                <TableCell className="text-right font-semibold text-sm">{formatMoeda(dep.mensalidade)}</TableCell>
                                <TableCell className="hidden sm:table-cell" />
                                <TableCell className="text-center">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); abrirEditBenef(dep); }}
                                    title="Editar dependente"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })}
                      {familias.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            Nenhum beneficiário encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
                    })}
        </div>
      )}

      {/* Modal de Edição de Beneficiário */}
      <Dialog open={editBenefModal} onOpenChange={(open) => { if (!open) { setEditBenefModal(false); setEditBenefItem(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" style={{ color: "oklch(0.48 0.20 252)" }} />
              Editar Beneficiário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label>Nome completo <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Nome completo do beneficiário"
                value={editBenefNome}
                onChange={(e) => setEditBenefNome(e.target.value)}
                maxLength={200}
              />
            </div>
            {/* Tipo Titular/Dependente */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={editBenefTipo} onValueChange={(v) => setEditBenefTipo(v as "T"|"D")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T">Titular</SelectItem>
                  <SelectItem value="D">Dependente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Tipo de dependente (só se D) */}
            {editBenefTipo === "D" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de dependência</Label>
                  <Select value={editBenefTipoDepend} onValueChange={(v) => setEditBenefTipoDepend(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Filho/Filha">Filho/Filha</SelectItem>
                      <SelectItem value="Conjuge">Cônjuge</SelectItem>
                      <SelectItem value="Agregado">Agregado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nº Beneficiário do Titular</Label>
                  <Input
                    placeholder="Nº do titular"
                    value={editBenefTitularNum}
                    onChange={(e) => setEditBenefTitularNum(e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
            )}
            {/* CPF + Data Nasc */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={editBenefCpf}
                  onChange={(e) => setEditBenefCpf(e.target.value)}
                  maxLength={14}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={editBenefDataNasc}
                  onChange={(e) => setEditBenefDataNasc(e.target.value)}
                />
              </div>
            </div>
            {/* Matrícula + Plano */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Matrícula funcional</Label>
                <Input
                  placeholder="Ex: 00123"
                  value={editBenefMatricula}
                  onChange={(e) => setEditBenefMatricula(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mensalidade (R$) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={editBenefMensalidade}
                  onChange={(e) => setEditBenefMensalidade(e.target.value)}
                />
              </div>
            </div>
            {/* Plano */}
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Input
                placeholder="Código do plano"
                value={editBenefPlano}
                onChange={(e) => setEditBenefPlano(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditBenefModal(false); setEditBenefItem(null); }} disabled={updateBenefMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={salvarEditBenef}
              disabled={updateBenefMutation.isPending}
              style={{ background: "oklch(0.20 0.08 252)", color: "white" }}
            >
              {updateBenefMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─── Componente principal ─────────────────────────────────────────────────────
export default function PlanoSaude() {
  return (
    <div className="space-y-6 p-6">
      {/* Hero Header */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
          border: "1px solid oklch(0.25 0.09 252)",
          boxShadow: "0 4px 24px oklch(0.22 0.08 250 / 0.18)",
        }}
      >
        <div className="px-7 py-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))",
                boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)",
              }}
            >
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}>
                Plano de Saúde
              </h1>
              <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>
                AMIL — Beneficiários, coparticipação e valores das 4 empresas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-abas */}
      <Tabs defaultValue="beneficiarios">
        <TabsList className="mb-4">
          <TabsTrigger value="beneficiarios">Beneficiários</TabsTrigger>
          <TabsTrigger value="coparticipacao">Coparticipação</TabsTrigger>
          <TabsTrigger value="valores">Valores dos Planos</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>

        <TabsContent value="beneficiarios">
          <Beneficiarios />
        </TabsContent>

        <TabsContent value="coparticipacao">
          <Coparticipacao />
        </TabsContent>

        <TabsContent value="valores">
          <TabelaValores />
        </TabsContent>

        <TabsContent value="simulador">
          <Simulador />
        </TabsContent>
      </Tabs>
    </div>
  );
}
