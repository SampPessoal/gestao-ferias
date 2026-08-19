import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarDays, Users, ChevronDown, ChevronRight, TrendingUp, Clock, Award, History, AlertCircle } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";
import { toDateStr, formatDateBR } from "@/lib/ferias";

const MESES = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const ANOS = Array.from({ length: 5 }, (_, i) => {
  const y = new Date().getFullYear() - 1 + i;
  return { value: String(y), label: String(y) };
});

type RegistroFerias = {
  id: number;
  colaboradorId: number;
  colaboradorNome: string | null;
  empresaId: number | null;
  empresaNome: string | null;
  setorId: number | null;
  setorNome: string | null;
  dataSaida: Date | string | null;
  dataFim: Date | string | null;
  dataRetorno: Date | string | null;
  diasGozados: number;
  venda10: "SIM" | "NAO";
  diasVendidos: number | null;
  periodoRef: string | null;
  observacao: string | null;
  createdByNome: string | null;
  createdAt: Date | string;
};

type FormData = {
  colaboradorId: string;
  empresaId: string;
  setorId: string;
  dataSaida: string;
  dataFim: string;      // Último dia de férias (calculado automaticamente)
  dataRetorno: string;  // Primeiro dia útil após o fim (calculado automaticamente)
  diasGozados: string;
  venda10: "SIM" | "NAO";
  diasVendidos: string;
  periodoRef: string;
  observacao: string;
};

const emptyForm: FormData = {
  colaboradorId: "",
  empresaId: "",
  setorId: "",
  dataSaida: "",
  dataFim: "",
  dataRetorno: "",
  diasGozados: "",
  venda10: "NAO",
  diasVendidos: "0",
  periodoRef: "",
  observacao: "",
};

function calcDias(saida: string, retorno: string): number {
  if (!saida || !retorno) return 0;
  // Usa UTC para evitar bug de timezone ao calcular diferença de dias
  const [sy, sm, sd] = saida.split("-").map(Number);
  const [ry, rm, rd] = retorno.split("-").map(Number);
  if (!sy || !sm || !sd || !ry || !rm || !rd) return 0;
  const ms1 = Date.UTC(sy, sm - 1, sd);
  const ms2 = Date.UTC(ry, rm - 1, rd);
  const diff = Math.round((ms2 - ms1) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export default function RelacaoFerias() {
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;

  const [filtroAno, setFiltroAno] = useState(String(anoAtual));
  const [filtroMes, setFiltroMes] = useState("all");
  const [filtroEmpresaId, setFiltroEmpresaId] = useState<string>("all");
  const [filtroSetorId, setFiltroSetorId] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [mesesExpandidos, setMesesExpandidos] = useState<Record<string, boolean>>({});

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<RegistroFerias | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [abaPrincipal, setAbaPrincipal] = useState<"relacao" | "cancelamentos">("relacao");
  const [buscaColab, setBuscaColab] = useState("");
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [nomeColabSelecionado, setNomeColabSelecionado] = useState("");
  const [colabInfo, setColabInfo] = useState<any | null>(null); // dados do colaborador selecionado

  const { data: empresas = [] } = trpc.empresas.list.useQuery();
  const { data: setores = [] } = trpc.setores.list.useQuery(
    filtroEmpresaId !== "all" ? { empresaId: Number(filtroEmpresaId) } : undefined
  );
  const { data: todosSetores = [] } = trpc.setores.list.useQuery(undefined);
  // Busca todos os colaboradores ativos de uma vez (sem filtro de form para evitar re-renders)
  const { data: todosColaboradores = [] } = trpc.colaboradores.listAtivos.useQuery(undefined);
  // Filtra por empresa/setor selecionados no form
  const colaboradoresLista = useMemo(() => {
    if (!form.empresaId && !form.setorId) return todosColaboradores;
    return todosColaboradores.filter((c: any) => {
      const matchEmpresa = !form.empresaId || c.empresaId === Number(form.empresaId);
      const matchSetor = !form.setorId || c.setorId === Number(form.setorId);
      return matchEmpresa && matchSetor;
    });
  }, [todosColaboradores, form.empresaId, form.setorId]);

  // Buscar todos os registros do ano selecionado
  const { data: registros = [], refetch } = trpc.historicoFerias.list.useQuery({
    ano: Number(filtroAno),
    empresaId: filtroEmpresaId !== "all" ? Number(filtroEmpresaId) : undefined,
    setorId: filtroSetorId !== "all" ? Number(filtroSetorId) : undefined,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.historicoFerias.create.useMutation({
    onSuccess: () => {
      toast.success("Registro de férias adicionado! Saldo do colaborador atualizado.");
      setModalAberto(false);
      setForm(emptyForm);
      utils.historicoFerias.list.invalidate();
      utils.colaboradores.list.invalidate();
      utils.colaboradores.byId.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const updateMutation = trpc.historicoFerias.update.useMutation({
    onSuccess: () => {
      toast.success("Registro atualizado! Saldo do colaborador atualizado.");
      setModalAberto(false);
      setEditando(null);
      setForm(emptyForm);
      utils.historicoFerias.list.invalidate();
      utils.colaboradores.list.invalidate();
      utils.colaboradores.byId.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteMutation = trpc.historicoFerias.delete.useMutation({
    onSuccess: () => {
      toast.success("Registro excluído. Saldo do colaborador atualizado.");
      setConfirmDelete(null);
      setMotivoCancelamento("");
      utils.historicoFerias.listCancelamentos.invalidate();
      utils.historicoFerias.list.invalidate();
      utils.colaboradores.list.invalidate();
      utils.colaboradores.byId.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });

  // Filtrar por busca e mês selecionado
  const { sort: sortFerias, toggle: toggleSortFerias, sortData: sortFeriasData } = useTableSort<"colaboradorNome" | "empresaNome" | "setorNome" | "dataSaida" | "dataRetorno" | "diasGozados">("dataSaida", "desc");

  const registrosFiltrados = useMemo(() => {
    return (registros as RegistroFerias[]).filter((r) => {
      const matchBusca = !busca || (r.colaboradorNome ?? "").toLowerCase().includes(busca.toLowerCase());
      const matchMes = filtroMes === "all" ? true : (() => {
        if (!r.dataSaida) return false;
        // Usa UTC para evitar bug de timezone ao extrair mês
        const iso = typeof r.dataSaida === "string" ? r.dataSaida.split("T")[0] : r.dataSaida.toISOString().split("T")[0];
        const mes = Number(iso.split("-")[1]);
        return mes === Number(filtroMes);
      })();
      return matchBusca && matchMes;
    });
  }, [registros, busca, filtroMes]);

  // Agrupar por mês
  const agrupados = useMemo(() => {
    const grupos: Record<string, RegistroFerias[]> = {};
    for (const r of registrosFiltrados) {
      if (!r.dataSaida) continue;
      // Usa UTC para evitar bug de timezone ao extrair ano/mês
      const iso = typeof r.dataSaida === "string" ? r.dataSaida.split("T")[0] : r.dataSaida.toISOString().split("T")[0];
      const chave = iso.slice(0, 7); // "YYYY-MM"
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(r);
    }
    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0])).map(([k, regs]) => [k, sortFeriasData(regs)] as [string, RegistroFerias[]]);
  }, [registrosFiltrados, sortFerias]);

  function nomeMes(chave: string) {
    const [ano, mes] = chave.split("-");
    const m = MESES.find((x) => x.value === String(Number(mes)));
    return `${m?.label ?? mes} de ${ano}`;
  }

  function toggleMes(chave: string) {
    setMesesExpandidos((prev) => ({ ...prev, [chave]: !prev[chave] }));
  }

  function abrirNovo() {
    setEditando(null);
    setForm(emptyForm);
    setBuscaColab("");
    setNomeColabSelecionado("");
    setColabInfo(null);
    setDropdownAberto(false);
    setModalAberto(true);
  }

  function abrirEditar(r: RegistroFerias) {
    setEditando(r);
    setForm({
      colaboradorId: String(r.colaboradorId),
      empresaId: r.empresaId ? String(r.empresaId) : "",
      setorId: r.setorId ? String(r.setorId) : "",
      dataSaida: toDateStr(r.dataSaida) ?? "",
      dataFim: toDateStr(r.dataFim) ?? "",
      dataRetorno: toDateStr(r.dataRetorno) ?? "",
      diasGozados: String(r.diasGozados),
      venda10: r.venda10,
      diasVendidos: String(r.diasVendidos ?? 0),
      periodoRef: r.periodoRef ?? "",
      observacao: r.observacao ?? "",
    });
    setBuscaColab(r.colaboradorNome ?? "");
    setNomeColabSelecionado(r.colaboradorNome ?? "");
    // Busca dados do colaborador para exibir no card informativo
    const colab = todosColaboradores.find((c: any) => c.id === r.colaboradorId);
    setColabInfo(colab ?? null);
    setDropdownAberto(false);
    setModalAberto(true);
  }

  // Feriados: nacionais fixos + estaduais da Bahia + municipais de Salvador + móveis por ano
  function getFeriados(ano: number): Set<string> {
    const fixos = [
      // ── NACIONAIS ──────────────────────────────────────────────
      `${ano}-01-01`, // Confraternização Universal
      `${ano}-04-21`, // Tiradentes
      `${ano}-05-01`, // Dia do Trabalho
      `${ano}-09-07`, // Independência do Brasil
      `${ano}-10-12`, // N. Sra. Aparecida
      `${ano}-11-02`, // Finados
      `${ano}-11-15`, // Proclamação da República
      `${ano}-11-20`, // Consciência Negra (Lei 14.759/2023)
      `${ano}-12-25`, // Natal
      // ── ESTADUAL DA BAHIA ──────────────────────────────────────
      `${ano}-07-02`, // Independência da Bahia (2 de Julho)
      // ── MUNICIPAIS DE SALVADOR ─────────────────────────────────
      `${ano}-06-24`, // Dia de São João (Lei Municipal nº 1997/1967)
      `${ano}-12-08`, // N. Sra. da Conceição — padroeira de Salvador (Lei Municipal nº 1997/1967)
    ];
    // Páscoa (algoritmo de Meeus/Jones/Butcher)
    function pascoa(y: number): Date {
      const a = y % 19, b = Math.floor(y/100), c = y % 100;
      const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
      const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
      const i = Math.floor(c/4), k = c % 4;
      const l = (32+2*e+2*i-h-k) % 7;
      const m2 = Math.floor((a+11*h+22*l)/451);
      const month = Math.floor((h+l-7*m2+114)/31);
      const day = ((h+l-7*m2+114) % 31) + 1;
      return new Date(y, month-1, day);
    }
    const p = pascoa(ano);
    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const moveis = [
      fmt(addDays(p, -48)), // Carnaval — segunda-feira
      fmt(addDays(p, -47)), // Carnaval — terça-feira
      fmt(addDays(p, -2)),  // Sexta-feira Santa (nacional + municipal Salvador)
      fmt(p),               // Páscoa
      fmt(addDays(p, 60)),  // Corpus Christi (municipal Salvador — Lei Municipal nº 1997/1967)
    ];
    return new Set([...fixos, ...moveis]);
  }

  // Nomes dos feriados para mensagens de erro
  const NOMES_FERIADOS: Record<string, string> = {
    // Nacionais fixos
    "01-01": "Confraternização Universal",
    "04-21": "Tiradentes",
    "05-01": "Dia do Trabalho",
    "09-07": "Independência do Brasil",
    "10-12": "Nossa Senhora Aparecida",
    "11-02": "Finados",
    "11-15": "Proclamação da República",
    "11-20": "Dia da Consciência Negra",
    "12-25": "Natal",
    // Estadual da Bahia
    "07-02": "Independência da Bahia (2 de Julho)",
    // Municipais de Salvador
    "06-24": "Dia de São João (feriado municipal de Salvador)",
    "12-08": "Nossa Senhora da Conceição (feriado municipal de Salvador)",
  };

  // Nomes dos feriados móveis (calculados por ano)
  function nomeFeriadoMovel(isoDate: string, ano: number): string {
    function pascoa(y: number): Date {
      const a = y % 19, b = Math.floor(y/100), c = y % 100;
      const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
      const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
      const i = Math.floor(c/4), k = c % 4;
      const l = (32+2*e+2*i-h-k) % 7;
      const m2 = Math.floor((a+11*h+22*l)/451);
      const month = Math.floor((h+l-7*m2+114)/31);
      const day = ((h+l-7*m2+114) % 31) + 1;
      return new Date(y, month-1, day);
    }
    const p = pascoa(ano);
    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (isoDate === fmt(addDays(p, -48))) return "Carnaval (segunda-feira)";
    if (isoDate === fmt(addDays(p, -47))) return "Carnaval (terça-feira)";
    if (isoDate === fmt(addDays(p, -2)))  return "Sexta-feira Santa";
    if (isoDate === fmt(p))               return "Páscoa";
    if (isoDate === fmt(addDays(p, 60)))  return "Corpus Christi (feriado municipal de Salvador)";
    return "Feriado";
  }

  function nomeFeriado(isoDate: string): string {
    const mmdd = isoDate.slice(5); // "MM-DD"
    const ano = Number(isoDate.slice(0, 4));
    return NOMES_FERIADOS[mmdd] ?? nomeFeriadoMovel(isoDate, ano);
  }

  function validarDataSaida(isoDate: string): string | null {
    if (!isoDate) return null;
    const d = new Date(isoDate + "T00:00:00");
    const diaSemana = d.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    // Regra 1: não pode sair na quinta, sexta ou fim de semana
    if (diaSemana === 0 || diaSemana === 6) {
      return `A data de saída cai em ${nomes[diaSemana]}. Férias só podem iniciar de segunda a quarta-feira.`;
    }
    if (diaSemana === 4) {
      return `A data de saída cai em Quinta-feira. Férias só podem iniciar de segunda a quarta-feira.`;
    }
    if (diaSemana === 5) {
      return `A data de saída cai em Sexta-feira. Férias só podem iniciar de segunda a quarta-feira.`;
    }
    // Regra 2: não pode sair no próprio feriado nem a menos de 48h antes de feriado
    // h=0 verifica o próprio dia; h=1 e h=2 verificam os próximos 2 dias
    const ano = d.getFullYear();
    const feriados = getFeriados(ano);
    const fmtDate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    for (let h = 0; h <= 2; h++) {
      const dia = new Date(d);
      dia.setDate(dia.getDate() + h);
      const diaIso = fmtDate(dia);
      if (feriados.has(diaIso)) {
        const nomeDia = `${String(dia.getDate()).padStart(2,'0')}/${String(dia.getMonth()+1).padStart(2,'0')}/${dia.getFullYear()}`;
        const nomeF = nomeFeriado(diaIso);
        if (h === 0) {
          return `A data de saída ${nomeDia} é o feriado de ${nomeF}. Não é permitido iniciar férias em feriado.`;
        }
        return `A data de saída está a menos de 48h do feriado de ${nomeF} (${nomeDia}). Não é permitido iniciar férias nessa data.`;
      }
    }
    return null;
  }

  // Retorno de férias: sem restrição de dia da semana ou feriado
  // A regra de saída (seg-qua, sem feriados/48h) aplica-se APENAS à data de saída

  /**
   * Verifica se o lançamento incorre em penalidade de 2 dias (CLT art. 137).
   * Penalidade ocorre quando:
   *   - O colaborador sai de férias dentro de 30 dias antes da data limite
   *   - E NÃO vendeu 10 dias (abono pecuniário)
   * Retorna uma string de aviso ou null se não há penalidade.
   * NUNCA bloqueia o lançamento — apenas informa.
   */
  /**
   * Verifica se a data de saída está dentro do período elegivel do colaborador.
   * Bloqueia se a saída for ANTES do vencimento ou DEPOIS da data limite.
   * Retorna mensagem de erro ou null se está dentro do período.
   */
  function calcularAvisoForaPeriodo(): string | null {
    if (!colabInfo || !form.dataSaida) return null;
    const saidaStr = form.dataSaida.includes("T") ? form.dataSaida.split("T")[0] : form.dataSaida;
    if (saidaStr.length !== 10) return null;
    const [sy, sm, sd] = saidaStr.split("-").map(Number);
    if (!sy || !sm || !sd) return null;
    const msSaida = Date.UTC(sy, sm - 1, sd);

    // --- Verifica vencimento (data mínima para sair de férias) ---
    const vencimentoRaw = colabInfo.vencimento;
    if (vencimentoRaw) {
      const vencStr = typeof vencimentoRaw === "string"
        ? vencimentoRaw.split("T")[0]
        : (vencimentoRaw instanceof Date
            ? `${vencimentoRaw.getUTCFullYear()}-${String(vencimentoRaw.getUTCMonth()+1).padStart(2,'0')}-${String(vencimentoRaw.getUTCDate()).padStart(2,'0')}`
            : null);
      if (vencStr) {
        const [vy, vm, vd] = vencStr.split("-").map(Number);
        if (vy && vm && vd) {
          const msVenc = Date.UTC(vy, vm - 1, vd);
          if (msSaida < msVenc) {
            const vencBR = `${String(vd).padStart(2,'0')}/${String(vm).padStart(2,'0')}/${vy}`;
            const diasRestantes = Math.round((msVenc - msSaida) / (1000 * 60 * 60 * 24));
            return `Bloqueado: o colaborador só pode sair de férias a partir de ${vencBR} (faltam ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} para o vencimento do período aquisitivo).`;
          }
        }
      }
    }

    // --- Verifica data limite (data máxima para sair de férias) ---
    const dataLimiteRaw = colabInfo.dataLimite;
    if (dataLimiteRaw) {
      const limStr = typeof dataLimiteRaw === "string"
        ? dataLimiteRaw.split("T")[0]
        : (dataLimiteRaw instanceof Date
            ? `${dataLimiteRaw.getUTCFullYear()}-${String(dataLimiteRaw.getUTCMonth()+1).padStart(2,'0')}-${String(dataLimiteRaw.getUTCDate()).padStart(2,'0')}`
            : null);
      if (limStr) {
        const [ly, lm, ld] = limStr.split("-").map(Number);
        if (ly && lm && ld) {
          const msLimite = Date.UTC(ly, lm - 1, ld);
          if (msSaida > msLimite) {
            const limBR = `${String(ld).padStart(2,'0')}/${String(lm).padStart(2,'0')}/${ly}`;
            return `Bloqueado: a data limite para este período aquisitivo era ${limBR}. O período já expirou — atualize o período aquisitivo do colaborador antes de registrar.`;
          }
        }
      }
    }

    return null;
  }

  function calcularAvisoPenalidade(): string | null {
    if (!colabInfo || !form.dataSaida) return null;
    // Só aplica penalidade quando NÃO há venda de 10 dias
    if (form.venda10 === "SIM") return null;
    // Penalidade é calculada em relação ao VENCIMENTO (não à data limite)
    const vencimentoRaw = colabInfo.vencimento;
    if (!vencimentoRaw) return null;
    // Normaliza vencimento para string YYYY-MM-DD
    const vencimentoStr = typeof vencimentoRaw === "string"
      ? vencimentoRaw.split("T")[0]
      : (vencimentoRaw instanceof Date
          ? `${vencimentoRaw.getUTCFullYear()}-${String(vencimentoRaw.getUTCMonth()+1).padStart(2,'0')}-${String(vencimentoRaw.getUTCDate()).padStart(2,'0')}`
          : null);
    if (!vencimentoStr) return null;
    // Normaliza dataSaida para string YYYY-MM-DD
    const dataSaidaStr = form.dataSaida.includes("T") ? form.dataSaida.split("T")[0] : form.dataSaida;
    if (dataSaidaStr.length !== 10) return null;
    // Calcula diferença em dias entre dataSaida e vencimento
    const [vy, vm, vd] = vencimentoStr.split("-").map(Number);
    const [sy, sm, sd] = dataSaidaStr.split("-").map(Number);
    if (!vy || !vm || !vd || !sy || !sm || !sd) return null;
    const msVenc = Date.UTC(vy, vm - 1, vd);
    const msSaida = Date.UTC(sy, sm - 1, sd);
    const diasAntesDoVenc = Math.round((msVenc - msSaida) / (1000 * 60 * 60 * 24));
    // Se a saída é no mesmo dia ou após o vencimento — sem penalidade
    if (diasAntesDoVenc <= 0) return null;
    // Penalidade: saída dentro de 30 dias antes do vencimento (1 a 30 dias de antecedência)
    if (diasAntesDoVenc <= 30) {
      const vencBR = `${String(vd).padStart(2,'0')}/${String(vm).padStart(2,'0')}/${vy}`;
      return `Atenção: esta saída está a ${diasAntesDoVenc} dia${diasAntesDoVenc !== 1 ? 's' : ''} antes do vencimento (${vencBR}). Conforme CLT, o colaborador perde 2 dias do período de gozo. Para evitar a penalidade, marque "Venda 10 dias" como SIM.`;
    }
    return null;
  }

  function handleSalvar() {
    if (!form.colaboradorId || !form.dataSaida || !form.dataRetorno) {
      toast.error("Preencha colaborador, data de saída e dias gozados.");
      return;
    }
    // Validar regras de dia da semana e feriados
    const erroData = validarDataSaida(form.dataSaida);
    if (erroData) {
      toast.error(erroData, { duration: 6000 });
      return;
    }
    const payload = {
      colaboradorId: Number(form.colaboradorId),
      empresaId: form.empresaId ? Number(form.empresaId) : undefined,
      setorId: form.setorId ? Number(form.setorId) : undefined,
      dataSaida: form.dataSaida,
      dataFim: form.dataFim || undefined,
      dataRetorno: form.dataRetorno,
      diasGozados: Number(form.diasGozados) || 0,
      venda10: form.venda10,
      diasVendidos: Number(form.diasVendidos) || 0,
      periodoRef: form.periodoRef || undefined,
      observacao: form.observacao || undefined,
    };

    if (editando) {
      updateMutation.mutate({ id: editando.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // Auto-calcular dias ao mudar datas
  // Converte DD/MM/AAAA para YYYY-MM-DD (formato interno)
  function brToIso(br: string): string {
    const parts = br.replace(/\D/g, "");
    if (parts.length === 8) {
      return `${parts.slice(4,8)}-${parts.slice(2,4)}-${parts.slice(0,2)}`;
    }
    return "";
  }

  // Converte YYYY-MM-DD para DD/MM/AAAA (exibição)
  function isoToBr(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return iso;
  }

  // Aplica máscara DD/MM/AAAA enquanto digita
  function maskDate(val: string): string {
    const nums = val.replace(/\D/g, "").slice(0, 8);
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return `${nums.slice(0,2)}/${nums.slice(2)}`;
    return `${nums.slice(0,2)}/${nums.slice(2,4)}/${nums.slice(4)}`;
  }

  // Calcula dataFim: último dia de férias = saida + diasGozados - 1
  function calcDataFim(saidaIso: string, dias: number): string {
    if (!saidaIso || dias <= 0) return "";
    try {
      const [sy, sm, sd] = saidaIso.split("-").map(Number);
      const d = new Date(Date.UTC(sy, sm - 1, sd + dias - 1));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    } catch { return ""; }
  }

  // Calcula data de retorno: primeiro dia útil após o fim das férias
  // Pula sábado, domingo e feriados (nacionais + Bahia + Salvador)
  function calcRetorno(fimIso: string): string {
    if (!fimIso) return "";
    try {
      const [fy, fm, fd] = fimIso.split("-").map(Number);
      // Avança um dia após o fim
      let d = new Date(Date.UTC(fy, fm - 1, fd + 1));
      const feriados = getFeriados(d.getUTCFullYear());
      // Também pega feriados do ano seguinte caso vire o ano
      const feriadosProxAno = getFeriados(d.getUTCFullYear() + 1);
      const todosFeriados = new Set(Array.from(feriados).concat(Array.from(feriadosProxAno)));
      // Avança até encontrar um dia útil (seg a sex, sem feriado)
      for (let i = 0; i < 30; i++) {
        const dow = d.getUTCDay(); // 0=dom, 6=sáb
        const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
        if (dow !== 0 && dow !== 6 && !todosFeriados.has(iso)) {
          return iso;
        }
        d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
      }
      return "";
    } catch { return ""; }
  }

  function handleDataChange(campo: "dataSaida", valorBr: string) {
    const masked = maskDate(valorBr);
    const iso = brToIso(masked);
    const novoForm = { ...form, dataSaida: iso || masked };
    // Recalcula fim e retorno se tiver dias
    const diasNum = parseInt(novoForm.diasGozados);
    if (iso && diasNum > 0) {
      const fim = calcDataFim(iso, diasNum);
      novoForm.dataFim = fim;
      novoForm.dataRetorno = fim ? calcRetorno(fim) : "";
    }
    setForm(novoForm);
  }

  function handleDiasChange(valor: string) {
    const novoForm = { ...form, diasGozados: valor };
    const diasNum = parseInt(valor);
    if (form.dataSaida && diasNum > 0) {
      const saidaIso = brToIso(isoToBr(form.dataSaida)) || form.dataSaida;
      const fim = calcDataFim(saidaIso, diasNum);
      novoForm.dataFim = fim;
      novoForm.dataRetorno = fim ? calcRetorno(fim) : "";
    }
    setForm(novoForm);
  }

  const setoresFiltradosForm = useMemo(() => {
    if (!form.empresaId) return todosSetores;
    return todosSetores.filter((s: any) => s.empresaId === Number(form.empresaId));
  }, [form.empresaId, todosSetores]);

  // Validação em tempo real da data de saída — bloqueia o botão se houver violação de regra CLT
  const erroDataSaidaTempoReal = useMemo(() => {
    if (!form.dataSaida || form.dataSaida.length !== 10) return null;
    return validarDataSaida(form.dataSaida);
  }, [form.dataSaida]);

  // Validação em tempo real do período elegivel do colaborador — bloqueia se fora do período aquisitivo
  const erroForaPeriodo = useMemo(() => {
    if (!colabInfo || !form.dataSaida || form.dataSaida.length !== 10) return null;
    return calcularAvisoForaPeriodo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colabInfo, form.dataSaida]);

  // Botão fica inativo se: mutation pendente ou campos obrigatórios vazios.
  // Ao EDITAR um registro existente (editando !== null), as validações de data e período
  // são apenas avisos informativos — não bloqueiam o salvamento, pois o registro já foi
  // lançado e pode precisar de correção retroativa.
  const botaoRegistrarDesabilitado =
    createMutation.isPending ||
    updateMutation.isPending ||
    !form.colaboradorId ||
    !form.dataSaida ||
    !form.dataRetorno ||
    (!editando && !!erroDataSaidaTempoReal) ||
    (!editando && !!erroForaPeriodo);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)"
      }}>
        <div className="px-7 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
              <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Relação de Férias</h1>
              <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Histórico de férias tiradas por colaborador, agrupado por mês</p>
            </div>
          </div>
          <Button onClick={abrirNovo} className="gap-2 shrink-0 font-semibold"
            style={{ background: "oklch(0.48 0.20 252)", color: "oklch(0.13 0.07 254)", border: "none" }}>
            <Plus className="w-4 h-4" />
            Registrar Férias
          </Button>
        </div>
      </div>

      {/* Abas principais */}
      <Tabs value={abaPrincipal} onValueChange={(v) => setAbaPrincipal(v as "relacao" | "cancelamentos")}>
        <TabsList className="mb-2">
          <TabsTrigger value="relacao" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Relação de Férias
          </TabsTrigger>
          <TabsTrigger value="cancelamentos" className="gap-2">
            <History className="w-4 h-4" />
            Histórico de Cancelamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relacao" className="space-y-4 mt-0">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Select value={filtroEmpresaId} onValueChange={(v) => { setFiltroEmpresaId(v); setFiltroSetorId("all"); }}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(empresas as any[]).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtroEmpresaId !== "all" && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Setor</Label>
                <Select value={filtroSetorId} onValueChange={setFiltroSetorId}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(setores as any[]).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <Label className="text-xs text-muted-foreground">Buscar colaborador</Label>
              <Input
                placeholder="Digite o nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: CalendarDays, label: "Registros", value: registrosFiltrados.length, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
          { icon: Users, label: "Colaboradores", value: new Set(registrosFiltrados.map((r) => r.colaboradorId)).size, color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
          { icon: TrendingUp, label: "Dias gozados", value: registrosFiltrados.reduce((acc, r) => acc + (r.diasGozados || 0), 0), color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
          { icon: Award, label: "Venda de 10 dias", value: registrosFiltrados.filter((r) => r.venda10 === "SIM").length, color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
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

      {/* Tabela agrupada por mês */}
      {agrupados.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card py-16 text-center" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-base font-bold text-foreground">Nenhum registro encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Registrar Férias" para adicionar o primeiro registro.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agrupados.map(([chave, regs]) => {
            const expandido = mesesExpandidos[chave] !== false;
            const totalDias = regs.reduce((acc, r) => acc + (r.diasGozados || 0), 0);
            const comVenda = regs.filter((r) => r.venda10 === "SIM").length;
            return (
              <div key={chave} className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
                {/* Header do grupo */}
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleMes(chave)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${expandido ? "bg-primary/10" : "bg-muted/50"}`}>
                        {expandido ? (
                          <ChevronDown className="w-4 h-4 text-primary" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm font-bold text-foreground">{nomeMes(chave)}</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                        {regs.length} registro{regs.length !== 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-emerald-100">
                        {totalDias} dias gozados
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {comVenda > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {comVenda} venderam 10 dias
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {expandido && (
                  <div className="border-t border-border/60 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow style={{ background: "oklch(0.97 0.005 245)" }}>
                          <SortableTableHead col="colaboradorNome" label="Colaborador" sort={sortFerias} onToggle={toggleSortFerias} className="pl-5 min-w-[220px]" />
                          <SortableTableHead col="empresaNome" label="Empresa" sort={sortFerias} onToggle={toggleSortFerias} />
                          <SortableTableHead col="setorNome" label="Setor" sort={sortFerias} onToggle={toggleSortFerias} />
                          <SortableTableHead col="dataSaida" label="Saída" sort={sortFerias} onToggle={toggleSortFerias} />
                          <TableHead className="text-xs font-bold uppercase tracking-wide">Fim</TableHead>
                          <SortableTableHead col="dataRetorno" label="Retorno" sort={sortFerias} onToggle={toggleSortFerias} />
                          <SortableTableHead col="diasGozados" label="Dias" sort={sortFerias} onToggle={toggleSortFerias} align="center" />
                          <TableHead className="text-center text-xs font-bold uppercase tracking-wide">Venda 10</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wide">Período Ref.</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wide">Observação</TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wide">Registrado por</TableHead>
                          <TableHead className="text-right pr-5 text-xs font-bold uppercase tracking-wide">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regs.map((r, idx) => (
                          <TableRow key={r.id} className={`hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                            <TableCell className="pl-5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                                  {(r.colaboradorNome ?? "?")[0].toUpperCase()}
                                </div>
                                <NomeColaborador nome={r.colaboradorNome ?? "—"} className="font-semibold text-sm text-foreground" maxChars={38} />
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.empresaNome ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.setorNome ?? "—"}</TableCell>
                            <TableCell className="text-sm font-medium">{formatDateBR(r.dataSaida)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.dataFim ? formatDateBR(r.dataFim) : <span className="text-muted-foreground/40">—</span>}</TableCell>
                            <TableCell className="text-sm font-medium">{formatDateBR(r.dataRetorno)}</TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">{r.diasGozados}d</span>
                            </TableCell>
                            <TableCell className="text-center">
                              {r.venda10 === "SIM" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                  SIM {r.diasVendidos ? `(${r.diasVendidos}d)` : ""}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">NÃO</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{r.periodoRef ?? "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-32 truncate" title={r.observacao ?? ""}>
                              {r.observacao ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.createdByNome ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
                                  <span className="text-muted-foreground">{r.createdByNome}</span>
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right pr-5">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600" onClick={() => abrirEditar(r)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDelete(r.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      <Dialog open={modalAberto} onOpenChange={(open) => { if (!open) { setModalAberto(false); setEditando(null); setForm(emptyForm); } }}>
                <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{editando ? "Editar Registro de Férias" : "Registrar Férias"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[80vh] pr-1">
          <div className="space-y-3 py-1">
            {/* Empresa + Setor */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Empresa</Label>
                <Select
                  value={form.empresaId || "none"}
                  onValueChange={(v) => setForm({ ...form, empresaId: v === "none" ? "" : v, setorId: "" })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {(empresas as any[]).map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Setor</Label>
                <Select
                  value={form.setorId || "none"}
                  onValueChange={(v) => setForm({ ...form, setorId: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {(setoresFiltradosForm as any[]).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Colaborador - busca por digitação */}
            <div className="space-y-1 relative">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Colaborador <span className="text-destructive">*</span></Label>
              <Input
                className="h-8 text-sm"
                placeholder="Digite o nome do colaborador..."
                value={buscaColab}
                autoComplete="off"
                onChange={(e) => {
                  const val = e.target.value;
                  setBuscaColab(val);
                  setNomeColabSelecionado("");
                  // Ao limpar o nome, limpa também colaborador, empresa, setor e colabInfo
                  if (val === "") {
                    setColabInfo(null);
                    setForm({ ...form, colaboradorId: "", empresaId: "", setorId: "", periodoRef: "" });
                  } else {
                    setForm({ ...form, colaboradorId: "" });
                  }
                  setDropdownAberto(val.length > 0);
                }}
                onFocus={() => { if (buscaColab.length > 0) setDropdownAberto(true); }}
                onBlur={() => setTimeout(() => setDropdownAberto(false), 180)}
              />
              {dropdownAberto && buscaColab.length >= 1 && (
                <div className="absolute z-50 w-full bg-white border border-border rounded-md shadow-lg max-h-52 overflow-y-auto mt-1">
                  {(colaboradoresLista as any[])
                    .filter((c) => c.nome.toLowerCase().includes(buscaColab.toLowerCase()))
                    .slice(0, 20)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          // Formata o período aquisitivo para exibição
                          const periodoStr = c.periodoAquisitivo
                            ? (() => {
                                const ini = toDateStr(c.periodoAquisitivo);
                                const fim = c.vencimento ? toDateStr(c.vencimento) : null;
                                if (!ini) return "";
                                const [iy, im, id] = ini.split("-");
                                const iniFormatado = `${id}/${im}/${iy}`;
                                if (fim) {
                                  const [fy, fm, fd] = fim.split("-");
                                  return `${iniFormatado} a ${fd}/${fm}/${fy}`;
                                }
                                return iniFormatado;
                              })()
                            : "";
                          // Preenche diasGozados com o saldo do colaborador
                          const saldoDias = String(c.saldo ?? c.diasDireito ?? 30);
                          const diasNum = parseInt(saldoDias);
                          // Recalcula dataFim e dataRetorno se já houver dataSaida
                          const saidaIso = form.dataSaida;
                          let novaDataFim = form.dataFim;
                          let novaDataRetorno = form.dataRetorno;
                          if (saidaIso && diasNum > 0) {
                            const [sy, sm, sd] = saidaIso.split("-").map(Number);
                            const dFim = new Date(Date.UTC(sy, sm - 1, sd + diasNum - 1));
                            novaDataFim = `${dFim.getUTCFullYear()}-${String(dFim.getUTCMonth()+1).padStart(2,"0")}-${String(dFim.getUTCDate()).padStart(2,"0")}`;
                            novaDataRetorno = novaDataFim ? calcRetorno(novaDataFim) : "";
                          }
                          setForm({
                            ...form,
                            colaboradorId: String(c.id),
                            empresaId: c.empresaId ? String(c.empresaId) : form.empresaId,
                            setorId: c.setorId ? String(c.setorId) : form.setorId,
                            periodoRef: periodoStr,
                            diasGozados: saldoDias,
                            dataFim: novaDataFim,
                            dataRetorno: novaDataRetorno,
                          });
                          setBuscaColab(c.nome);
                          setNomeColabSelecionado(c.nome);
                          setColabInfo(c);
                          setDropdownAberto(false);
                        }}
                      >
                        <span className="font-medium">{c.nome}</span>
                        {c.setorNome && <span className="text-muted-foreground ml-2 text-xs">{c.setorNome}</span>}
                      </button>
                    ))}
                  {(colaboradoresLista as any[]).filter((c) => c.nome.toLowerCase().includes(buscaColab.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum colaborador encontrado.</div>
                  )}
                </div>
              )}
              {form.colaboradorId && nomeColabSelecionado && (
                <p className="text-xs text-blue-600 mt-0.5">✓ {nomeColabSelecionado} selecionado</p>
              )}
              {/* Card informativo do colaborador selecionado - compacto */}
              {colabInfo && (
                <div className="mt-1.5 px-2.5 py-1.5 rounded border border-blue-200 bg-blue-50 text-xs flex flex-wrap gap-x-3 gap-y-0.5 items-center text-blue-700">
                  <span className="font-semibold text-blue-800">📅 Período:</span>
                  <span>{colabInfo.periodoAquisitivo ? formatDateBR(colabInfo.periodoAquisitivo) : "—"} → {colabInfo.vencimento ? formatDateBR(colabInfo.vencimento) : "—"}</span>
                  <span className="text-blue-400">|</span>
                  <span>Limite: <span className="font-medium">{colabInfo.dataLimite ? formatDateBR(colabInfo.dataLimite) : "—"}</span></span>
                  <span className="text-blue-400">|</span>
                  <span>Saldo: <span className={`font-bold ${
                    (colabInfo.saldo ?? colabInfo.diasDireito ?? 30) <= 10
                      ? "text-red-600"
                      : (colabInfo.saldo ?? colabInfo.diasDireito ?? 30) <= 20
                      ? "text-blue-600"
                      : "text-green-700"
                  }`}>{colabInfo.saldo ?? colabInfo.diasDireito ?? 30}d</span></span>
                </div>
              )}
              {/* Aviso de período não elegível: saída antes do vencimento */}
              {calcularAvisoForaPeriodo() && (
                <div className="mt-1.5 px-2.5 py-2 rounded border border-red-300 bg-red-50 text-xs text-red-800 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">🚫</span>
                  <span>{calcularAvisoForaPeriodo()}</span>
                </div>
              )}
              {/* Aviso de penalidade de 2 dias (não bloqueante) */}
              {!calcularAvisoForaPeriodo() && calcularAvisoPenalidade() && (
                <div className="mt-1.5 px-2.5 py-2 rounded border border-blue-300 bg-blue-50 text-xs text-blue-800 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{calcularAvisoPenalidade()}</span>
                </div>
              )}
            </div>

            {/* Datas + Dias em grid 2x2 compacto */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Saída <span className="text-destructive">*</span></Label>
                <Input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="h-8 text-sm"
                  value={isoToBr(form.dataSaida)}
                  onChange={(e) => handleDataChange("dataSaida", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Dias Gozados</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  className="h-8 text-sm"
                  value={form.diasGozados}
                  onChange={(e) => handleDiasChange(e.target.value)}
                  placeholder="Ex: 20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Fim <span className="text-xs font-normal text-muted-foreground/60">(auto)</span>
                </Label>
                <Input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="h-8 text-sm bg-muted/40 cursor-default"
                  value={isoToBr(form.dataFim)}
                  readOnly
                  title="Último dia de férias — calculado automaticamente"
                  onChange={() => {}}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Retorno <span className="text-xs font-normal text-muted-foreground/60">(auto)</span>
                </Label>
                <Input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="h-8 text-sm bg-muted/40 cursor-default"
                  value={isoToBr(form.dataRetorno)}
                  readOnly
                  title="Primeiro dia útil após o fim — calculado automaticamente"
                  onChange={() => {}}
                />
              </div>
            </div>
            {form.dataSaida && form.diasGozados && form.dataRetorno && (
              <p className="text-xs text-blue-600 -mt-1">↩ Retorno calculado: {isoToBr(form.dataRetorno)}</p>
            )}

            {/* Venda 10 dias */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Venda 10 dias</Label>
                <Select value={form.venda10} onValueChange={(v: "SIM" | "NAO") => setForm({ ...form, venda10: v })}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAO">NÃO</SelectItem>
                    <SelectItem value="SIM">SIM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.venda10 === "SIM" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Dias vendidos</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={form.diasVendidos}
                    onChange={(e) => setForm({ ...form, diasVendidos: e.target.value })}
                    placeholder="10"
                  />
                </div>
              )}
            </div>

            {/* Período de referência */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Período Aquisitivo de Referência</Label>
              <Input
                className="h-8 text-sm"
                value={form.periodoRef}
                onChange={(e) => setForm({ ...form, periodoRef: e.target.value })}
                placeholder="Ex: 01/01/2024 a 31/12/2024"
              />
            </div>

            {/* Observação */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Observação</Label>
              <Textarea
                className="text-sm resize-none"
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border/40">
            {(erroDataSaidaTempoReal || erroForaPeriodo) && (
              <p className={`text-xs flex-1 text-left leading-snug ${editando ? "text-amber-600" : "text-destructive"}`}>
                {editando ? "⚠️ Aviso:" : "🚫"} {erroDataSaidaTempoReal || erroForaPeriodo}
                {editando && <span className="block text-[10px] text-muted-foreground mt-0.5">Você pode salvar mesmo assim por ser uma edição de registro existente.</span>}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={() => { setModalAberto(false); setEditando(null); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSalvar}
              disabled={botaoRegistrarDesabilitado}
              title={erroDataSaidaTempoReal || erroForaPeriodo || undefined}
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editando ? "Atualizar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={confirmDelete !== null} onOpenChange={() => { setConfirmDelete(null); setMotivoCancelamento(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Cancelar Férias
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Tem certeza que deseja cancelar este registro de férias? O saldo do colaborador será revertido automaticamente.</p>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo do cancelamento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Ex: Colaborador adiou as férias por necessidade da empresa..."
                className="resize-none text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDelete(null); setMotivoCancelamento(""); }}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete !== null && deleteMutation.mutate({ id: confirmDelete, motivo: motivoCancelamento || undefined })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="cancelamentos" className="mt-0">
          <HistoricoCancelamentos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
function HistoricoCancelamentos() {
  const [filtroEmpresaId, setFiltroEmpresaId] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const { data: empresas = [] } = trpc.empresas.list.useQuery();
  const { data: cancelamentos = [], isLoading } = trpc.historicoFerias.listCancelamentos.useQuery({});

  const filtrados = useMemo(() => {
    return (cancelamentos as any[]).filter((c) => {
      const matchEmpresa = filtroEmpresaId === "all" || String(c.empresaId) === filtroEmpresaId;
      const matchBusca = !busca || (c.colaboradorNome ?? "").toLowerCase().includes(busca.toLowerCase());
      return matchEmpresa && matchBusca;
    });
  }, [cancelamentos, filtroEmpresaId, busca]);

  const toStr = (d: any) => {
    if (!d) return "—";
    const iso = typeof d === "string" ? d.split("T")[0] : new Date(d).toISOString().split("T")[0];
    const [y, m, day] = iso.split("-");
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Select value={filtroEmpresaId} onValueChange={setFiltroEmpresaId}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {(empresas as any[]).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <Label className="text-xs text-muted-foreground">Buscar colaborador</Label>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do colaborador..." className="h-8 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-orange-500" />
            Histórico de Cancelamentos
            <Badge variant="secondary" className="ml-auto">{filtrados.length} registro{filtrados.length !== 1 ? "s" : ""}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum cancelamento registrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Data Saída</TableHead>
                  <TableHead>Data Retorno</TableHead>
                  <TableHead className="text-center">Dias</TableHead>
                  <TableHead>Período Ref.</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Cancelado por</TableHead>
                  <TableHead>Cancelado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.colaboradorNome}</TableCell>
                    <TableCell>{toStr(c.dataSaida)}</TableCell>
                    <TableCell>{toStr(c.dataRetorno)}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold">{c.diasGozados ?? 0}</span>
                      {(c.diasVendidos ?? 0) > 0 && <span className="text-xs text-muted-foreground ml-1">(+{c.diasVendidos}v)</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.periodoRef ?? "—"}</TableCell>
                    <TableCell>
                      {c.motivo ? (
                        <span className="text-sm">{c.motivo}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Não informado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.canceladoPorNome ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{toStr(c.canceladoEm)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
