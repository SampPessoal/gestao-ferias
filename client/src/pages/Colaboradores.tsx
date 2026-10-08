import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, ChevronRight, ChevronLeft, Plus, Users, Building2, Layers, SlidersHorizontal, X } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";
import { Link } from "wouter";
import { toast } from "sonner";
import { calcPeriodoFerias } from "@/lib/ferias";

type NovoColabForm = {
  nome: string; codigo: string; empresaId: string; setorId: string;
  admissao: string; periodoAquisitivo: string; vencimento: string;
  dataLimite: string; diasDireito: string; saldo: string; observacoes: string;
  // Dados pessoais
  cpf: string; rg: string; dataNascimento: string; cargo: string;
  celular: string; telefone: string; emailCorporativo: string;
  sexo: string; estadoCivil: string; nacionalidade: string; naturalidade: string;
  temFilhos: boolean; qtdFilhos: string; idadeAdmissao: string;
  // Filiação
  nomePai: string; nomeMae: string;
  // Contato de emergência
  contatoEmergenciaNome: string; contatoEmergenciaTelefone: string;
  // Expedição RG
  rgExpedicao: string; rgOrgaoExpedidor: string;
  // Endereço
  enderecoLogradouro: string; enderecoNumero: string; enderecoComplemento: string;
  enderecoBairro: string; enderecoCidade: string; enderecoEstado: string; enderecoCep: string;
  // Documentos
  tituloEleitor: string; zonaEleitoral: string; secaoEleitoral: string;
  pis: string;
  ctpsTipo: string; ctpsNumero: string; ctpsSerie: string;
  // Benefícios
  recebeVR: boolean; recebeVT: boolean;
  valorVR: string; valorVT: string;
  recebeSeguroVida: boolean; receivePlanoSaude: boolean;
  recebeNotebook: boolean; recebeCreche: boolean;
};

const emptyNovoColab: NovoColabForm = {
  nome: "", codigo: "", empresaId: "", setorId: "", admissao: "",
  periodoAquisitivo: "", vencimento: "", dataLimite: "", diasDireito: "30", saldo: "30", observacoes: "",
  cpf: "", rg: "", dataNascimento: "", cargo: "", celular: "", telefone: "", emailCorporativo: "",
  sexo: "", estadoCivil: "", nacionalidade: "", naturalidade: "",
  temFilhos: false, qtdFilhos: "", idadeAdmissao: "",
  nomePai: "", nomeMae: "",
  contatoEmergenciaNome: "", contatoEmergenciaTelefone: "",
  rgExpedicao: "", rgOrgaoExpedidor: "",
  enderecoLogradouro: "", enderecoNumero: "", enderecoComplemento: "",
  enderecoBairro: "", enderecoCidade: "", enderecoEstado: "", enderecoCep: "",
  tituloEleitor: "", zonaEleitoral: "", secaoEleitoral: "",
  pis: "", ctpsTipo: "fisica", ctpsNumero: "", ctpsSerie: "",
  recebeVR: true, recebeVT: true, valorVR: "", valorVT: "",
  recebeSeguroVida: false, receivePlanoSaude: false,
  recebeNotebook: false, recebeCreche: false,
};

function maskDate(val: string): string {
  const nums = val.replace(/\D/g, "").slice(0, 8);
  if (nums.length <= 2) return nums;
  if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
  return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`;
}

function maskCPF(val: string): string {
  const nums = val.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function maskRG(val: string): string {
  // Formato BA: 00.000.000-00 (10 dígitos: ex. 21.018.854-78)
  const nums = val.replace(/\D/g, "").slice(0, 10);
  if (nums.length <= 2) return nums;
  if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
  if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}-${nums.slice(8)}`;
}

function maskCelular(val: string): string {
  // (71) 9 8177-0000
  const nums = val.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2) return nums.length ? `(${nums}` : "";
  if (nums.length <= 3) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2, 3)} ${nums.slice(3)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 3)} ${nums.slice(3, 7)}-${nums.slice(7)}`;
}

function maskTelefone(val: string): string {
  // (71) 3177-0000
  const nums = val.replace(/\D/g, "").slice(0, 10);
  if (nums.length <= 2) return nums.length ? `(${nums}` : "";
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
}

function maskPIS(val: string): string {
  // 000.00000.00-0
  const nums = val.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 8) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 10) return `${nums.slice(0, 3)}.${nums.slice(3, 8)}.${nums.slice(8)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 8)}.${nums.slice(8, 10)}-${nums.slice(10)}`;
}
function maskCTPS(val: string): string {
  // NNNNNNN/SSSS-UF
  const digits = val.replace(/\D/g, "").slice(0, 11);
  const letters = val.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
  const num = digits.slice(0, 7);
  const serie = digits.slice(7, 11);
  if (num.length < 7) return num;
  let result = num;
  if (serie.length > 0) result += `/${serie}`;
  if (letters.length > 0) result += `-${letters}`;
  return result;
}
function brToIso(br: string): string {
  const parts = br.replace(/\D/g, "");
  if (parts.length === 8) return `${parts.slice(4, 8)}-${parts.slice(2, 4)}-${parts.slice(0, 2)}`;
  return "";
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-violet-500", text: "text-white" },
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-blue-700", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-blue-600", text: "text-white" },
];

function avatarPalette(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

export default function Colaboradores() {
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [empresaId, setEmpresaId] = useState<number | undefined>(undefined);
  const [setorId, setSetorId] = useState<number | undefined>(undefined);
  const [statusColab, setStatusColab] = useState<"ativo" | "inativo" | "todos">("ativo");
  const [page, setPage] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [novoColab, setNovoColab] = useState<NovoColabForm>(emptyNovoColab);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [errosForm, setErrosForm] = useState<Record<string, string>>({});
  const { sort: sortColab, toggle: toggleSortColab, sortData: sortColabData } = useTableSort<"nome" | "empresaNome" | "setorNome" | "codigo" | "status">("nome", "asc");

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery(empresaId ? { empresaId } : undefined);
  const { data: todosSetores } = trpc.setores.list.useQuery(undefined);
  const { data, isLoading } = trpc.colaboradores.list.useQuery({
    busca: buscaDebounced || undefined,
    empresaId, setorId, status: statusColab, page, pageSize: 50,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.colaboradores.create.useMutation({
    onSuccess: () => {
      toast.success(`Colaborador "${novoColab.nome}" cadastrado com sucesso!`);
      setModalAberto(false);
      setNovoColab(emptyNovoColab);
      utils.colaboradores.list.invalidate();
      utils.dashboard.stats.invalidate();
      utils.dashboard.statusPorEmpresa.invalidate();
      utils.dashboard.statusPorSetor.invalidate();
    },
    onError: (err) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  const setoresFiltradosModal = useMemo(() => {
    if (!novoColab.empresaId) return todosSetores ?? [];
    return (todosSetores ?? []).filter((s: any) => s.empresaId === Number(novoColab.empresaId));
  }, [novoColab.empresaId, todosSetores]);

  const hasFilters = busca || empresaId || setorId || statusColab !== "ativo";

  function handleDateField(campo: keyof NovoColabForm, valor: string) {
    setNovoColab(prev => ({ ...prev, [campo]: maskDate(valor) }));
  }

  function handleAdmissaoChange(valor: string) {
    const masked = maskDate(valor);
    setNovoColab(prev => {
      const novo = { ...prev, admissao: masked };
      const iso = brToIso(masked);
      if (iso) {
        const [y, m, d] = iso.split("-").map(Number);
        const fmtDate = (dt: Date) =>
          `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;

        // Período aquisitivo = mesma data da admissão (1º período começa no dia da admissão)
        // Para colaboradores já avançados, o período aquisitivo será ajustado manualmente
        const calc = calcPeriodoFerias(iso);
        novo.periodoAquisitivo = fmtDate(new Date(calc.periodoAquisitivo + 'T12:00:00'));
        novo.vencimento = fmtDate(new Date(calc.vencimento + 'T12:00:00'));
        novo.dataLimite = fmtDate(new Date(calc.dataLimite + 'T12:00:00'));
      }
      return novo;
    });
  }

  async function buscarCep(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado. Verifique o número informado.");
      } else {
        setNovoColab(prev => ({
          ...prev,
          enderecoLogradouro: data.logradouro || prev.enderecoLogradouro,
          enderecoBairro: data.bairro || prev.enderecoBairro,
          enderecoCidade: data.localidade || prev.enderecoCidade,
          enderecoEstado: data.uf || prev.enderecoEstado,
        }));
        toast.success("Endereço preenchido automaticamente!");
      }
    } catch {
      toast.error("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setBuscandoCep(false);
    }
  }

  function handleSalvar() {
    // Validação dos campos obrigatórios
    const novosErros: Record<string, string> = {};
    if (!novoColab.nome.trim()) novosErros.nome = "Nome completo é obrigatório";
    if (!novoColab.empresaId) novosErros.empresaId = "Selecione a empresa";
    setErrosForm(novosErros);
    if (Object.keys(novosErros).length > 0) {
      toast.error("Preencha os campos obrigatórios antes de continuar.");
      return;
    }
    const toIso = (br: string) => brToIso(br) || null;
    createMutation.mutate({
      nome: novoColab.nome.trim(),
      codigo: novoColab.codigo.trim() || null,
      empresaId: novoColab.empresaId ? Number(novoColab.empresaId) : null,
      setorId: novoColab.setorId ? Number(novoColab.setorId) : null,
      admissao: toIso(novoColab.admissao),
      periodoAquisitivo: toIso(novoColab.periodoAquisitivo),
      vencimento: toIso(novoColab.vencimento),
      dataLimite: toIso(novoColab.dataLimite),
      diasDireito: novoColab.diasDireito ? Number(novoColab.diasDireito) : 30,
      saldo: novoColab.saldo ? Number(novoColab.saldo) : 30,
      observacoes: novoColab.observacoes.trim() || null,
      // Dados pessoais
      cpf: novoColab.cpf.trim() || null,
      rg: novoColab.rg.trim() || null,
      dataNascimento: toIso(novoColab.dataNascimento),
      cargo: novoColab.cargo.trim() || null,
      celular: novoColab.celular.trim() || null,
      telefone: novoColab.telefone.trim() || null,
      emailCorporativo: novoColab.emailCorporativo.trim() || null,
      sexo: (novoColab.sexo as any) || null,
      estadoCivil: (novoColab.estadoCivil as any) || null,
      nacionalidade: novoColab.nacionalidade.trim() || null,
      naturalidade: novoColab.naturalidade.trim() || null,
      temFilhos: novoColab.temFilhos,
      qtdFilhos: novoColab.temFilhos && novoColab.qtdFilhos ? Number(novoColab.qtdFilhos) : null,
      idadeAdmissao: novoColab.idadeAdmissao ? Number(novoColab.idadeAdmissao) : null,
      nomePai: novoColab.nomePai.trim() || null,
      nomeMae: novoColab.nomeMae.trim() || null,
      contatoEmergenciaNome: novoColab.contatoEmergenciaNome.trim() || null,
      contatoEmergenciaTelefone: novoColab.contatoEmergenciaTelefone.trim() || null,
      // Expedição RG
      rgExpedicao: toIso(novoColab.rgExpedicao),
      rgOrgaoExpedidor: novoColab.rgOrgaoExpedidor.trim() || null,
      // Endereço
      enderecoLogradouro: novoColab.enderecoLogradouro.trim() || null,
      enderecoNumero: novoColab.enderecoNumero.trim() || null,
      enderecoComplemento: novoColab.enderecoComplemento.trim() || null,
      enderecoBairro: novoColab.enderecoBairro.trim() || null,
      enderecoCidade: novoColab.enderecoCidade.trim() || null,
      enderecoEstado: novoColab.enderecoEstado.trim() || null,
      enderecoCep: novoColab.enderecoCep.trim() || null,
      // Documentos
      tituloEleitor: novoColab.tituloEleitor.trim() || null,
      zonaEleitoral: novoColab.zonaEleitoral.trim() || null,
      secaoEleitoral: novoColab.secaoEleitoral.trim() || null,
      pis: novoColab.pis.trim() || null,
      ctpsTipo: novoColab.ctpsTipo || null,
      ctpsNumero: novoColab.ctpsNumero.trim() || null,
      ctpsSerie: novoColab.ctpsSerie.trim() || null,
      // Benefícios
      valorVR: novoColab.recebeVR && novoColab.valorVR ? Number(novoColab.valorVR) : null,
      valorVT: novoColab.recebeVT && novoColab.valorVT ? Number(novoColab.valorVT) : null,
    });
  }

    return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Header ── */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)"
      }}>
        <div className="px-7 py-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Colaboradores</h1>
                <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Gerencie perfis, fichas técnicas e histórico de férias</p>
              </div>
            </div>
            <Button onClick={() => { setNovoColab(emptyNovoColab); setModalAberto(true); }}
              className="gap-2 font-semibold"
              style={{ background: "oklch(0.48 0.20 252)", color: "oklch(0.13 0.07 254)", border: "none" }}>
              <Plus className="w-4 h-4" />
              Novo Colaborador
            </Button>
          </div>
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { icon: Users, label: statusColab === "ativo" ? "Colaboradores Ativos" : statusColab === "inativo" ? "Inativos" : "Total", value: data?.total ?? 0 },
              { icon: Building2, label: "Empresas", value: empresas?.length ?? 0 },
              { icon: Layers, label: "Setores", value: todosSetores?.length ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3.5 flex items-center gap-3"
                style={{ background: "oklch(0.20 0.015 240)", border: "1px solid oklch(0.28 0.012 240)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.26 0.015 240)" }}>
                  <item.icon className="w-4 h-4" style={{ color: "oklch(0.48 0.20 252)" }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>{item.value}</p>
                  <p className="text-xs font-medium" style={{ color: "oklch(0.60 0.008 240)" }}>{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="rounded-xl p-4" style={{ background: "white", border: "1px solid oklch(0.885 0.006 240)", boxShadow: "0 1px 4px oklch(0.12 0.015 240 / 0.05)" }}>
        <div className="p-0">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-muted-foreground shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Filtros</span>
            </div>
            <div className="w-px h-5 bg-border/60 shrink-0" />
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={busca}
                onChange={e => { setBusca(e.target.value); setPage(1); }}
                className="pl-9 h-9 bg-background border-border/60"
              />
            </div>
            <Select value={statusColab} onValueChange={v => { setStatusColab(v as any); setPage(1); }}>
              <SelectTrigger className="w-32 h-9 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={empresaId ? String(empresaId) : "todos"}
              onValueChange={v => { setEmpresaId(v === "todos" ? undefined : Number(v)); setSetorId(undefined); setPage(1); }}
            >
              <SelectTrigger className="w-52 h-9 border-border/60">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as empresas</SelectItem>
                {empresas?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={setorId ? String(setorId) : "todos"}
              onValueChange={v => { setSetorId(v === "todos" ? undefined : Number(v)); setPage(1); }}
            >
              <SelectTrigger className="w-52 h-9 border-border/60">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setores?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => { setBusca(""); setBuscaDebounced(""); setEmpresaId(undefined); setSetorId(undefined); setStatusColab("ativo"); setPage(1); }}>
                <X className="w-3.5 h-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "white", border: "1px solid oklch(0.885 0.006 240)", boxShadow: "0 1px 4px oklch(0.12 0.015 240 / 0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "oklch(0.960 0.004 240)", borderBottom: "1px solid oklch(0.885 0.006 240)" }}>
                <SortableHeader col="nome" label="Colaborador" sort={sortColab} onToggle={toggleSortColab} className="px-5 py-3.5" />
                <SortableHeader col="empresaNome" label="Empresa" sort={sortColab} onToggle={toggleSortColab} />
                <SortableHeader col="setorNome" label="Setor" sort={sortColab} onToggle={toggleSortColab} />
                <SortableHeader col="codigo" label="Código" sort={sortColab} onToggle={toggleSortColab} />
                <SortableHeader col="status" label="Status" sort={sortColab} onToggle={toggleSortColab} align="center" />
                <th className="w-12 px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-44" />
                      </div>
                    </td>
                    {[1, 2, 3, 4, 5].map(j => <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>)}
                  </tr>
                ))
                : sortColabData(data?.data ?? []).map((c, idx) => {
                  const palette = avatarPalette(c.nome);
                  return (
                    <tr key={c.id} className={`hover:bg-muted/30 transition-colors group cursor-pointer ${idx % 2 === 1 ? "bg-muted/15" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full ${palette.bg} ${palette.text} flex items-center justify-center text-xs font-bold shrink-0 shadow-sm`}>
                            {getInitials(c.nome)}
                          </div>
                          <NomeColaborador nome={c.nome} className="font-semibold text-foreground group-hover:text-primary transition-colors leading-tight" maxChars={30} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {c.empresaNome ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/8 text-primary border border-primary/15">
                            {c.empresaNome}
                          </span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted-foreground">
                        {c.setorNome ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {(c as any).codigo ? (
                          <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                            {(c as any).codigo}
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          c.status === "ativo"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === "ativo" ? "bg-blue-500" : "bg-zinc-400"}`} />
                          {c.status === "ativo" ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/colaboradores/${c.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!isLoading && (data?.data ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-foreground">Nenhum colaborador encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasFilters ? "Tente ajustar os filtros de busca" : "Cadastre o primeiro colaborador"}
            </p>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/60 bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Página <span className="font-semibold text-foreground">{page}</span> de <span className="font-semibold text-foreground">{totalPages}</span>
              <span className="ml-2 text-muted-foreground/60">· {data?.total ?? 0} colaboradores</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Novo Colaborador ── */}
      <Dialog open={modalAberto} onOpenChange={(open) => { if (!open) { setModalAberto(false); setNovoColab(emptyNovoColab); setErrosForm({}); } }}>
        <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header moderno com gradiente sutil */}
          <div className="relative px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-r from-background to-muted/20 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3M13.5 4.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM3 19.5a9 9 0 0 1 15-6.708" />
                </svg>
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight">Novo Colaborador</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados para realizar a admissão</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="basico" className="w-full flex flex-col flex-1 min-h-0">
            {/* Abas com estilo pill moderno - 2 linhas para caber tudo */}
            <div className="px-5 pt-4 pb-0 flex-shrink-0">
              <TabsList className="grid grid-cols-3 w-full h-auto p-1 gap-1 bg-muted/50 rounded-xl">
                {[
                  { value: "basico", label: "Básico", icon: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" },
                  { value: "pessoal", label: "Pessoal", icon: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" },
                  { value: "documentos", label: "Documentos", icon: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" },
                  { value: "endereco", label: "Endereço", icon: "M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" },
                  { value: "contato", label: "Contato", icon: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" },
                  { value: "clt", label: "CLT / Benefícios", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="flex items-center justify-center gap-1.5 h-9 text-xs font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all px-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                    </svg>
                    <span>{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── ABA BÁSICO ── */}
            <TabsContent value="basico" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-5">
              {/* Bloco: Identificação */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Identificação</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Nome completo <span className="text-destructive">*</span></Label>
                    <Input
                      className={`h-9 ${errosForm.nome ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
                      placeholder="Nome completo do colaborador" value={novoColab.nome}
                      onChange={e => { setNovoColab(prev => ({ ...prev, nome: e.target.value })); setErrosForm(prev => ({ ...prev, nome: '' })); }} autoFocus />
                    {errosForm.nome && <p className="text-[11px] text-destructive mt-0.5">{errosForm.nome}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Código / Matrícula</Label>
                    <Input className="h-9" placeholder="Ex: 00123" value={novoColab.codigo}
                      onChange={e => setNovoColab(prev => ({ ...prev, codigo: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Bloco: Lotação */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Lotação</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Empresa <span className="text-destructive">*</span></Label>
                    <Select value={novoColab.empresaId || "none"}
                      onValueChange={v => { setNovoColab(prev => ({ ...prev, empresaId: v === "none" ? "" : v, setorId: "" })); setErrosForm(prev => ({ ...prev, empresaId: '' })); }}>
                      <SelectTrigger className={`h-9 ${errosForm.empresaId ? 'border-destructive' : ''}`}><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione a empresa</SelectItem>
                        {(empresas ?? []).map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errosForm.empresaId && <p className="text-[11px] text-destructive mt-0.5">{errosForm.empresaId}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Setor</Label>
                    <Select value={novoColab.setorId || "none"}
                      onValueChange={v => setNovoColab(prev => ({ ...prev, setorId: v === "none" ? "" : v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione o setor</SelectItem>
                        {(setoresFiltradosModal as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Cargo</Label>
                    <Input className="h-9" placeholder="Ex: Auxiliar Administrativo" value={novoColab.cargo}
                      onChange={e => setNovoColab(prev => ({ ...prev, cargo: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Sexo</Label>
                    <Select value={novoColab.sexo || "none"} onValueChange={v => setNovoColab(prev => ({ ...prev, sexo: v === "none" ? "" : v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione</SelectItem>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Bloco: Dados Pessoais Básicos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Dados Pessoais</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Estado Civil</Label>
                    <Select value={novoColab.estadoCivil || "none"} onValueChange={v => setNovoColab(prev => ({ ...prev, estadoCivil: v === "none" ? "" : v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione</SelectItem>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        <SelectItem value="uniao_estavel">União Estável</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Data de Nascimento</Label>
                    <Input className="h-9" type="text" placeholder="DD/MM/AAAA" maxLength={10} value={novoColab.dataNascimento}
                      onChange={e => setNovoColab(prev => ({ ...prev, dataNascimento: maskDate(e.target.value) }))} />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/70">Observações</Label>
                <Textarea className="text-sm resize-none" placeholder="Informações adicionais sobre o colaborador..." rows={3} value={novoColab.observacoes}
                  onChange={e => setNovoColab(prev => ({ ...prev, observacoes: e.target.value }))} />
              </div>
            </TabsContent>

            {/* ── ABA PESSOAL ── */}
            <TabsContent value="pessoal" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-5">
              {/* Origem */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Origem</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Nacionalidade</Label>
                    <Input className="h-9" placeholder="Ex: Brasileira" value={novoColab.nacionalidade}
                      onChange={e => setNovoColab(prev => ({ ...prev, nacionalidade: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Naturalidade</Label>
                    <Input className="h-9" placeholder="Ex: Salvador/BA" value={novoColab.naturalidade}
                      onChange={e => setNovoColab(prev => ({ ...prev, naturalidade: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Família */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Família</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Tem Filhos?</Label>
                    <Select value={novoColab.temFilhos ? "sim" : "nao"} onValueChange={v => setNovoColab(prev => ({ ...prev, temFilhos: v === "sim", qtdFilhos: v === "nao" ? "" : prev.qtdFilhos }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao">Não</SelectItem>
                        <SelectItem value="sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Qtd. Filhos</Label>
                    <Input className="h-9" type="number" min={1} max={20} placeholder="0" value={novoColab.qtdFilhos}
                      disabled={!novoColab.temFilhos}
                      onChange={e => setNovoColab(prev => ({ ...prev, qtdFilhos: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Idade na Admissão</Label>
                    <Input className="h-9" type="number" min={14} max={99} placeholder="Ex: 25" value={novoColab.idadeAdmissao}
                      onChange={e => setNovoColab(prev => ({ ...prev, idadeAdmissao: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Nome do Pai</Label>
                    <Input className="h-9" placeholder="Nome completo do pai" value={novoColab.nomePai}
                      onChange={e => setNovoColab(prev => ({ ...prev, nomePai: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Nome da Mãe</Label>
                    <Input className="h-9" placeholder="Nome completo da mãe" value={novoColab.nomeMae}
                      onChange={e => setNovoColab(prev => ({ ...prev, nomeMae: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Emergência */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-destructive/70" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Contato de Emergência</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Nome do Contato</Label>
                    <Input className="h-9" placeholder="Nome completo" value={novoColab.contatoEmergenciaNome}
                      onChange={e => setNovoColab(prev => ({ ...prev, contatoEmergenciaNome: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Telefone de Emergência</Label>
                    <Input className="h-9" placeholder="(71) 9 8177-0000" value={novoColab.contatoEmergenciaTelefone}
                      maxLength={16}
                      onChange={e => setNovoColab(prev => ({ ...prev, contatoEmergenciaTelefone: maskCelular(e.target.value) }))} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── ABA DOCUMENTOS ── */}
            <TabsContent value="documentos" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-5">
              {/* Documentos Principais */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Documentos Principais</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">CPF</Label>
                    <Input className="h-9" placeholder="000.000.000-00" value={novoColab.cpf}
                      maxLength={14}
                      onChange={e => setNovoColab(prev => ({ ...prev, cpf: maskCPF(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">PIS / PASEP</Label>
                    <Input className="h-9" placeholder="000.00000.00-0" value={novoColab.pis}
                      maxLength={14}
                      onChange={e => setNovoColab(prev => ({ ...prev, pis: maskPIS(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">RG</Label>
                    <Input className="h-9" placeholder="00.000.000-0" value={novoColab.rg}
                      maxLength={13}
                      onChange={e => setNovoColab(prev => ({ ...prev, rg: maskRG(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Data de Expedição</Label>
                    <Input className="h-9" type="text" placeholder="DD/MM/AAAA" maxLength={10} value={novoColab.rgExpedicao}
                      onChange={e => setNovoColab(prev => ({ ...prev, rgExpedicao: maskDate(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Órgão Expedidor</Label>
                    <Input className="h-9" placeholder="Ex: SSP/BA" value={novoColab.rgOrgaoExpedidor}
                      onChange={e => setNovoColab(prev => ({ ...prev, rgOrgaoExpedidor: e.target.value.toUpperCase() }))} />
                  </div>
                </div>
              </div>

              {/* CTPS */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Carteira de Trabalho (CTPS)</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Tipo</Label>
                    <Select value={novoColab.ctpsTipo} onValueChange={v => setNovoColab(prev => ({ ...prev, ctpsTipo: v, ctpsNumero: "", ctpsSerie: "" }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fisica">Física</SelectItem>
                        <SelectItem value="digital">Digital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">
                      {novoColab.ctpsTipo === "digital" ? "CPF (CTPS Digital)" : "Número"}
                    </Label>
                    <Input className="h-9"
                      placeholder={novoColab.ctpsTipo === "digital" ? "000.000.000-00" : "NNNNNNN/SSSS-UF"}
                      value={novoColab.ctpsNumero}
                      onChange={e => {
                        if (novoColab.ctpsTipo === "digital") {
                          setNovoColab(prev => ({ ...prev, ctpsNumero: maskCPF(e.target.value) }));
                        } else {
                          const raw = e.target.value;
                          const digits = raw.replace(/\D/g, "");
                          const letters = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
                          const num = digits.slice(0, 7);
                          const serie = digits.slice(7, 11);
                          const uf = letters.slice(0, 2);
                          let formatted = num;
                          if (serie.length > 0) formatted += `/${serie}`;
                          if (uf.length > 0) formatted += `-${uf}`;
                          const serieVal = serie.length === 4 && uf.length === 2 ? `${serie}-${uf}` : serie.length > 0 ? `${serie}${uf.length > 0 ? "-" + uf : ""}` : "";
                          setNovoColab(prev => ({ ...prev, ctpsNumero: formatted, ctpsSerie: serieVal || prev.ctpsSerie }));
                        }
                      }} />
                  </div>
                  {novoColab.ctpsTipo === "fisica" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground/70">Série</Label>
                      <Input className="h-9" placeholder="Ex: 0001-BA" value={novoColab.ctpsSerie}
                        onChange={e => setNovoColab(prev => ({ ...prev, ctpsSerie: e.target.value.toUpperCase() }))} />
                    </div>
                  )}
                </div>
              </div>

              {/* Título de Eleitor */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Título de Eleitor</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Número</Label>
                    <Input className="h-9" placeholder="0000 0000 0000" value={novoColab.tituloEleitor}
                      onChange={e => setNovoColab(prev => ({ ...prev, tituloEleitor: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Zona</Label>
                    <Input className="h-9" placeholder="Ex: 001" value={novoColab.zonaEleitoral}
                      maxLength={10}
                      onChange={e => setNovoColab(prev => ({ ...prev, zonaEleitoral: e.target.value.replace(/\D/g, "") }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Seção</Label>
                    <Input className="h-9" placeholder="Ex: 0001" value={novoColab.secaoEleitoral}
                      maxLength={10}
                      onChange={e => setNovoColab(prev => ({ ...prev, secaoEleitoral: e.target.value.replace(/\D/g, "") }))} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── ABA ENDEREÇO ── */}
            <TabsContent value="endereco" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Endereço Residencial</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Logradouro</Label>
                    <Input className="h-9" placeholder="Rua, Avenida, Travessa..." value={novoColab.enderecoLogradouro}
                      onChange={e => setNovoColab(prev => ({ ...prev, enderecoLogradouro: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Número</Label>
                    <Input className="h-9" placeholder="Ex: 123" value={novoColab.enderecoNumero}
                      onChange={e => setNovoColab(prev => ({ ...prev, enderecoNumero: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Complemento</Label>
                    <Input className="h-9" placeholder="Apto, Bloco, Casa..." value={novoColab.enderecoComplemento}
                      onChange={e => setNovoColab(prev => ({ ...prev, enderecoComplemento: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Bairro</Label>
                    <Input className="h-9" placeholder="Nome do bairro" value={novoColab.enderecoBairro}
                      onChange={e => setNovoColab(prev => ({ ...prev, enderecoBairro: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">CEP</Label>
                    <div className="relative">
                      <Input className="h-9 pr-8" placeholder="00000-000" maxLength={9} value={novoColab.enderecoCep}
                        onChange={e => {
                          const n = e.target.value.replace(/\D/g, "").slice(0, 8);
                          const formatted = n.length > 5 ? `${n.slice(0,5)}-${n.slice(5)}` : n;
                          setNovoColab(prev => ({ ...prev, enderecoCep: formatted }));
                          if (n.length === 8) buscarCep(n);
                        }} />
                      {buscandoCep && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <svg className="w-4 h-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Preencha para buscar o endereço</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Cidade</Label>
                    <Input className="h-9" placeholder="Nome da cidade" value={novoColab.enderecoCidade}
                      onChange={e => setNovoColab(prev => ({ ...prev, enderecoCidade: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">UF</Label>
                    <Input className="h-9" placeholder="BA" maxLength={2} value={novoColab.enderecoEstado}
                      onChange={e => setNovoColab(prev => ({ ...prev, enderecoEstado: e.target.value.toUpperCase().slice(0,2) }))} />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── ABA CONTATO ── */}
            <TabsContent value="contato" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Telefones</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Celular</Label>
                    <Input className="h-9" placeholder="(71) 9 8177-0000" value={novoColab.celular}
                      maxLength={16}
                      onChange={e => setNovoColab(prev => ({ ...prev, celular: maskCelular(e.target.value) }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Telefone Fixo</Label>
                    <Input className="h-9" placeholder="(71) 3177-0000" value={novoColab.telefone}
                      maxLength={14}
                      onChange={e => setNovoColab(prev => ({ ...prev, telefone: maskTelefone(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">E-mail</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground/70">E-mail Corporativo</Label>
                  <Input className="h-9" type="email" placeholder="nome@empresa.com.br" value={novoColab.emailCorporativo}
                    onChange={e => setNovoColab(prev => ({ ...prev, emailCorporativo: e.target.value }))} />
                </div>
              </div>
            </TabsContent>

            {/* ── ABA CLT / BENEFÍCIOS ── */}
            <TabsContent value="clt" className="flex-1 overflow-y-auto px-6 py-5 mt-0 space-y-5">
              {/* Datas CLT */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Datas CLT</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Data de Admissão</Label>
                    <Input className="h-9" type="text" placeholder="DD/MM/AAAA" maxLength={10} value={novoColab.admissao}
                      onChange={e => handleAdmissaoChange(e.target.value)} />
                    <p className="text-[10px] text-muted-foreground/60">Calcula automaticamente período aquisitivo, vencimento e prazo</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Início do Período Aquisitivo</Label>
                    <Input className="h-9" type="text" placeholder="DD/MM/AAAA" maxLength={10} value={novoColab.periodoAquisitivo}
                      onChange={e => handleDateField("periodoAquisitivo", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Vencimento das Férias</Label>
                    <Input className="h-9" type="text" placeholder="DD/MM/AAAA" maxLength={10} value={novoColab.vencimento}
                      onChange={e => handleDateField("vencimento", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Data Limite (prazo CLT)</Label>
                    <Input className="h-9" type="text" placeholder="DD/MM/AAAA" maxLength={10} value={novoColab.dataLimite}
                      onChange={e => handleDateField("dataLimite", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Dias de Direito</Label>
                    <Input className="h-9" type="number" min={1} max={30} value={novoColab.diasDireito}
                      onChange={e => setNovoColab(prev => ({ ...prev, diasDireito: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/70">Saldo de Férias</Label>
                    <Input className="h-9" type="number" min={0} max={30} value={novoColab.saldo}
                      onChange={e => setNovoColab(prev => ({ ...prev, saldo: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Benefícios */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Benefícios</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {([
                    { key: "recebeVR", label: "Vale Refeição (VR)", desc: "Benefício diário de alimentação" },
                    { key: "recebeVT", label: "Vale Transporte (VT)", desc: "Auxílio para deslocamento" },
                    { key: "recebeSeguroVida", label: "Seguro de Vida", desc: "Cobertura de vida em grupo" },
                    { key: "receivePlanoSaude", label: "Plano de Saúde", desc: "Assistência médica" },
                    { key: "recebeNotebook", label: "Auxílio Notebook", desc: "Equipamento de trabalho" },
                    { key: "recebeCreche", label: "Auxílio Creche", desc: "Suporte para dependentes" },
                  ] as { key: keyof NovoColabForm; label: string; desc: string }[]).map(({ key, label, desc }) => (
                    <label key={key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                      novoColab[key]
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border/50 bg-transparent hover:border-border hover:bg-muted/20"
                    }`}>
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        novoColab[key] ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {novoColab[key] && (
                          <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <input type="checkbox" className="sr-only"
                        checked={!!novoColab[key]}
                        onChange={e => setNovoColab(prev => ({ ...prev, [key]: e.target.checked }))} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {(novoColab.recebeVR || novoColab.recebeVT) && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-2.5">Valores dos benefícios</p>
                    <div className="grid grid-cols-2 gap-3">
                      {novoColab.recebeVR && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground/70">Valor VR (R$)</Label>
                          <Input className="h-9" type="number" min={0} step={0.01} placeholder="Ex: 39.52"
                            value={novoColab.valorVR}
                            onChange={e => setNovoColab(prev => ({ ...prev, valorVR: e.target.value }))} />
                        </div>
                      )}
                      {novoColab.recebeVT && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-foreground/70">Valor VT (R$)</Label>
                          <Input className="h-9" type="number" min={0} step={0.01} placeholder="Ex: 10.00"
                            value={novoColab.valorVT}
                            onChange={e => setNovoColab(prev => ({ ...prev, valorVT: e.target.value }))} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer moderno */}
          <div className="flex flex-col gap-2 px-6 py-4 border-t border-border/50 bg-muted/10 flex-shrink-0 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground hidden sm:block">Campos marcados com <span className="text-destructive">*</span> são obrigatórios</p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" className="h-9 px-4 flex-1 sm:flex-none" onClick={() => { setModalAberto(false); setNovoColab(emptyNovoColab); setErrosForm({}); }}>
                Cancelar
              </Button>
              <Button className="h-9 px-5 font-semibold flex-1 sm:flex-none whitespace-nowrap" onClick={handleSalvar} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Cadastrar Colaborador"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
