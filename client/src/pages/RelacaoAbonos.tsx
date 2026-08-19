import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, Edit2, Search, Gift, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/SortableHeader";
import { NomeColaborador } from "@/components/NomeColaborador";
import { toast } from "sonner";

const ANO_ATUAL = new Date().getFullYear();
// Mostra os últimos 5 anos + próximos 2 para cobrir histórico completo
const ANOS = Array.from({ length: 8 }, (_, i) => ANO_ATUAL - 5 + i);

// Usa UTC para evitar bug de timezone: em GMT-3, UTC midnight vira o dia anterior
function formatDate(d: any): string {
  if (!d) return "—";
  // Se vier como string ISO (ex: "2026-07-14" ou "2026-07-14T00:00:00.000Z"), extrai apenas a parte da data
  if (typeof d === "string") {
    const iso = d.split("T")[0];
    const [y, m, day] = iso.split("-");
    if (y && m && day) return `${day}/${m}/${y}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  // Usa UTC para evitar conversao de timezone
  const day = String(dt.getUTCDate()).padStart(2, "0");
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const year = dt.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function toInputDate(d: any): string {
  if (!d) return "";
  // Se vier como string ISO, extrai apenas a parte da data sem conversao de timezone
  if (typeof d === "string") return d.split("T")[0];
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  // Usa UTC para evitar bug de timezone
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type AbonoForm = {
  colaboradorId: string;
  colaboradorNome: string;
  empresaId: number | null;
  setorId: number | null;
  admissao: string | null; // data de admissão para calcular aptidão
  anoReferencia: string;
  dataAbono: string;
  dataAbono2: string;
  diasAbonados: string;
  observacao: string;
};

const emptyForm: AbonoForm = {
  colaboradorId: "",
  colaboradorNome: "",
  empresaId: null,
  setorId: null,
  admissao: null,
  anoReferencia: String(ANO_ATUAL),
  dataAbono: "",
  dataAbono2: "",
  diasAbonados: "1",
  observacao: "",
};

// ─── Calcula aptidão de abono baseada na data de admissão ──────────────────────
// Regra: o colaborador tem direito a 2 dias de abono por ANO DE EMPRESA.
// O ano de empresa conta do aniversario de admissão ao próximo aniversario.
// Ex: admissao 01/07/2024, hoje 30/06/2026 → 1 ano completo → período vigente: 01/07/2025 a 30/06/2026
// IMPORTANTE: o período vigente é calculado com base nos ANOS COMPLETOS DE EMPRESA HOJE,
// não pelo anoReferencia do filtro. O anoReferencia só é usado para comparar se é o mesmo período.
function calcularAptidaoAbono(admissaoStr: string | Date | null | undefined, _anoReferencia?: number): {
  apto: boolean;
  periodoInicio: string;
  periodoFim: string;
  anoEmpresa: number;
  mensagem: string;
} {
  if (!admissaoStr) return { apto: false, periodoInicio: "", periodoFim: "", anoEmpresa: 0, mensagem: "Data de admissão não informada." };
  // Extrai data sem timezone — aceita string 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ssZ' ou Date object
  let iso: string;
  if (admissaoStr instanceof Date) {
    // Date object (superjson deserializa campos date do drizzle como Date): usar UTC
    iso = `${(admissaoStr as Date).getUTCFullYear()}-${String((admissaoStr as Date).getUTCMonth()+1).padStart(2,"0")}-${String((admissaoStr as Date).getUTCDate()).padStart(2,"0")}`;
  } else if (typeof admissaoStr === "string") {
    iso = admissaoStr.split("T")[0];
  } else {
    iso = "";
  }
  const [ay, am, ad] = iso.split("-").map(Number);
  if (!ay || !am || !ad) return { apto: false, periodoInicio: "", periodoFim: "", anoEmpresa: 0, mensagem: "Data de admissão inválida (" + String(admissaoStr) + ")." };

  // Data de hoje em Brasília (UTC-3)
  const agora = new Date();
  const hojeUTC3 = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const hy = hojeUTC3.getUTCFullYear();
  const hm = hojeUTC3.getUTCMonth() + 1;
  const hd = hojeUTC3.getUTCDate();
  const hojeIso = `${hy}-${String(hm).padStart(2,"0")}-${String(hd).padStart(2,"0")}`;

  // Calcular anos completos de empresa hoje
  // (subtrai 1 se ainda não chegou o aniversario deste ano)
  let anosCompletos = hy - ay;
  if (hm < am || (hm === am && hd < ad)) anosCompletos--;

  if (anosCompletos < 1) {
    // Quando vai completar 1 ano?
    const aniversario1Ano = `${String(ad).padStart(2,"0")}/${String(am).padStart(2,"0")}/${ay + 1}`;
    return {
      apto: false,
      periodoInicio: "",
      periodoFim: "",
      anoEmpresa: anosCompletos,
      mensagem: `Colaborador ainda não completou 1 ano de empresa. Apto a partir de ${aniversario1Ano}.`,
    };
  }

  // Período vigente: do anosCompletos-ésimo aniversario ao (anosCompletos+1)-ésimo - 1 dia
  // Ex: anosCompletos=1, admissao 01/07/2024 → período: 01/07/2025 a 30/06/2026
  const inicioAno = ay + anosCompletos;
  const fimDate = new Date(Date.UTC(ay + anosCompletos + 1, am - 1, ad) - 86400000);

  const inicioIso = `${inicioAno}-${String(am).padStart(2,"0")}-${String(ad).padStart(2,"0")}`;
  const fimIso = `${fimDate.getUTCFullYear()}-${String(fimDate.getUTCMonth()+1).padStart(2,"0")}-${String(fimDate.getUTCDate()).padStart(2,"0")}`;

  const pIni = `${String(ad).padStart(2,"0")}/${String(am).padStart(2,"0")}/${inicioAno}`;
  const pFim = `${String(fimDate.getUTCDate()).padStart(2,"0")}/${String(fimDate.getUTCMonth()+1).padStart(2,"0")}/${fimDate.getUTCFullYear()}`;

  const apto = hojeIso >= inicioIso && hojeIso <= fimIso;

  if (!apto) {
    // Não deveria acontecer com a nova lógica, mas por segurança
    return { apto: false, periodoInicio: pIni, periodoFim: pFim, anoEmpresa: anosCompletos, mensagem: `Período de abono vigente: ${pIni} a ${pFim}. Verifique a data.` };
  }

  return {
    apto: true,
    periodoInicio: pIni,
    periodoFim: pFim,
    anoEmpresa: anosCompletos,
    mensagem: `Apto ao abono social. Período vigente (${anosCompletos}º ano): ${pIni} a ${pFim}.`,
  };
}

// ─── Busca de colaborador com autocomplete ────────────────────────────────────
function ColaboradorSearch({
  value,
  onChange,
  disabled,
}: {
  value: { id: string; nome: string };
  onChange: (v: { id: string; nome: string; empresaId: number | null; setorId: number | null; admissao?: string | null }) => void;
  disabled?: boolean;
}) {
  const [busca, setBusca] = useState(value.nome);
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = trpc.colaboradores.list.useQuery(
    { busca: busca.length >= 2 ? busca : undefined, pageSize: 20, status: "ativo" },
    { enabled: busca.length >= 2 }
  );

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sincroniza quando o form é resetado
  useEffect(() => {
    setBusca(value.nome);
  }, [value.nome]);

  function selecionar(c: any) {
    onChange({ id: String(c.id), nome: c.nome, empresaId: c.empresaId ?? null, setorId: c.setorId ?? null, admissao: c.admissao ?? null });
    setBusca(c.nome);
    setAberto(false);
  }

  function limpar() {
    onChange({ id: "", nome: "", empresaId: null, setorId: null, admissao: null });
    setBusca("");
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Digite o nome do colaborador..."
          value={busca}
          disabled={disabled}
          onChange={e => {
            setBusca(e.target.value);
            if (!e.target.value) onChange({ id: "", nome: "", empresaId: null, setorId: null });
            setAberto(true);
          }}
          onFocus={() => busca.length >= 2 && setAberto(true)}
          className="pl-9 pr-8"
        />
        {busca && !disabled && (
          <button
            type="button"
            onClick={limpar}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {aberto && data?.data && data.data.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {data.data.map((c: any) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
              onMouseDown={() => selecionar(c)}
            >
              <span className="font-medium">{c.nome}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {c.empresaNome ?? ""}{c.setorNome ? ` · ${c.setorNome}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {aberto && busca.length >= 2 && (!data?.data || data.data.length === 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg px-3 py-3 text-sm text-muted-foreground">
          Nenhum colaborador encontrado.
        </div>
      )}
    </div>
  );
}

// ─── Saldo badge na tabela ────────────────────────────────────────────────────
function SaldoBadge({ colaboradorId, anoReferencia }: { colaboradorId: number; anoReferencia: number }) {
  const { data } = trpc.abonos.saldo.useQuery({ colaboradorId, anoReferencia });
  if (!data) return null;
  const { usado, saldo } = data;
  if (saldo === 0) return <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">Esgotado ({usado}/2)</Badge>;
  if (usado > 0) return <Badge className="bg-blue-100 text-yellow-700 border-blue-200 border text-xs">{usado}/2 usados</Badge>;
  return <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs">2 disponíveis</Badge>;
}

// ─── Saldo info no modal ──────────────────────────────────────────────────────
function SaldoInfo({ colaboradorId, anoReferencia, editandoId }: {
  colaboradorId: number;
  anoReferencia: number;
  editandoId: number | null;
}) {
  const { data } = trpc.abonos.saldo.useQuery({ colaboradorId, anoReferencia });
  if (!data) return null;
  const { usado, direito, saldo } = data;
  const esgotado = saldo === 0 && editandoId === null;
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
      esgotado ? "bg-red-50 border-red-200 text-red-700"
      : usado > 0 ? "bg-blue-50 border-blue-200 text-yellow-700"
      : "bg-blue-50 border-blue-200 text-blue-700"
    }`}>
      {esgotado ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
      <span>
        {esgotado
          ? `Limite atingido: ${usado}/${direito} dias já utilizados em ${anoReferencia}.`
          : `Saldo em ${anoReferencia}: ${usado} dia(s) utilizado(s) de ${direito} — restam ${saldo} dia(s).`}
      </span>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RelacaoAbonos() {
  const utils = trpc.useUtils();

  // Filtros
  const [busca, setBusca] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todos");
  const [setorFiltro, setSetorFiltro] = useState<string>("todos");
  const [anoFiltro, setAnoFiltro] = useState<number>(ANO_ATUAL);
  const [page, setPage] = useState(1);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [deletandoId, setDeletandoId] = useState<number | null>(null);
  const { sort: sortAbonos, toggle: toggleSortAbonos, sortData: sortAbonosData } = useTableSort<"colaboradorNome" | "empresaNome" | "setorNome" | "anoReferencia" | "dataAbono" | "diasAbonados">("dataAbono", "desc");
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState<AbonoForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Dados
  const { data: empresas } = trpc.empresas.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery(
    empresaFiltro !== "todos" ? { empresaId: Number(empresaFiltro) } : {}
  );

  const { data, isLoading } = trpc.abonos.list.useQuery({
    empresaId: empresaFiltro !== "todos" ? Number(empresaFiltro) : undefined,
    setorId: setorFiltro !== "todos" ? Number(setorFiltro) : undefined,
    anoReferencia: anoFiltro,
    page,
    pageSize: 50,
  });

  // Mutations
  const createMutation = trpc.abonos.create.useMutation({
    onSuccess: () => {
      toast.success("Abono registrado com sucesso!");
      utils.abonos.list.invalidate();
      utils.abonos.saldo.invalidate();
      fecharModal();
    },
    onError: (err) => toast.error(err.message || "Erro ao registrar abono."),
  });

  const updateMutation = trpc.abonos.update.useMutation({
    onSuccess: () => {
      toast.success("Abono atualizado!");
      utils.abonos.list.invalidate();
      utils.abonos.saldo.invalidate();
      fecharModal();
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar abono."),
  });

  const deleteMutation = trpc.abonos.delete.useMutation({
    onSuccess: () => {
      toast.success("Abono removido.");
      utils.abonos.list.invalidate();
      utils.abonos.saldo.invalidate();
      setConfirmDelete(null);
    },
    onError: () => toast.error("Erro ao remover abono."),
  });

  function abrirNovo() {
    setEditando(null);
    setForm(emptyForm);
    setModalAberto(true);
  }

  function abrirEditar(abono: any) {
    setEditando(abono.id);
    // Busca a data de admissão do colaborador na lista para calcular aptidão
    setForm({
      colaboradorId: String(abono.colaboradorId),
      colaboradorNome: abono.colaboradorNome ?? "",
      empresaId: abono.empresaId ?? null,
      setorId: abono.setorId ?? null,
      admissao: abono.admissao ?? null,
      anoReferencia: String(abono.anoReferencia),
      dataAbono: toInputDate(abono.dataAbono),
      dataAbono2: toInputDate(abono.dataAbono2),
      diasAbonados: String(abono.diasAbonados ?? 1),
      observacao: abono.observacao ?? "",
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditando(null);
    setForm(emptyForm);
  }

  function salvar() {
    if (!form.colaboradorId) { toast.error("Selecione o colaborador."); return; }
    // Bloqueia se não apto (apenas para novos registros, não para edição)
    if (editando === null && naoApto && aptidaoAtual) {
      toast.error(aptidaoAtual.mensagem, { duration: 6000 });
      return;
    }
    if (!form.dataAbono) { toast.error("Informe a data do 1º dia de abono."); return; }
    if (Number(form.diasAbonados) === 2 && !form.dataAbono2) {
      toast.error("Informe a data do 2º dia de abono."); return;
    }

    const d2 = Number(form.diasAbonados) === 2 ? form.dataAbono2 || null : null;

    if (editando !== null) {
      updateMutation.mutate({
        id: editando,
        dataAbono: form.dataAbono,
        dataAbono2: d2,
        diasAbonados: Number(form.diasAbonados),
        anoReferencia: Number(form.anoReferencia),
        observacao: form.observacao || null,
      });
    } else {
      // Busca empresa/setor do colaborador via lista (já carregada no autocomplete)
      createMutation.mutate({
        colaboradorId: Number(form.colaboradorId),
        empresaId: form.empresaId ?? null,
        setorId: form.setorId ?? null,
        anoReferencia: Number(form.anoReferencia),
        dataAbono: form.dataAbono,
        dataAbono2: d2,
        diasAbonados: Number(form.diasAbonados),
        observacao: form.observacao || null,
      });
    }
  }

  // Filtro local por busca de nome
  const abonosFiltrados = useMemo(() => {
    if (!data?.data) return [];
    const filtrado = !busca.trim() ? data.data : data.data.filter((a: any) => (a.colaboradorNome ?? "").toLowerCase().includes(busca.toLowerCase()));
    return sortAbonosData(filtrado);
  }, [data, busca, sortAbonos]);

  const totalPages = Math.ceil((data?.total ?? 0) / 50);
  const dois = Number(form.diasAbonados) === 2;

  // Calcula aptidão do colaborador selecionado para bloquear o salvamento
  const aptidaoAtual = form.colaboradorId && form.admissao
    ? calcularAptidaoAbono(form.admissao, Number(form.anoReferencia))
    : null;
  const naoApto = aptidaoAtual !== null && !aptidaoAtual.apto;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d1f3c 60%, #0f172a 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 40%)" }} />
        <div className="relative px-7 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
              <Gift className="w-7 h-7" style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}>Relação de Abonos</h1>
              <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Controle dos abonos sociais — 2 dias por colaborador por ano (não acumula)</p>
            </div>
          </div>
          <Button onClick={abrirNovo} className="gap-2 shrink-0 font-bold" style={{ background: "#3b82f6", color: "#fff" }}>
            <Plus className="w-4 h-4" /> Novo Abono
          </Button>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-200/60 bg-blue-50/80" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
          <Gift className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-sm">
          <p className="font-bold text-blue-900">Regra do Abono Social</p>
          <p className="text-blue-700 mt-0.5">
            Cada colaborador tem direito a <strong>2 dias de abono por ano de empresa</strong>. Os dias
            não acumulam: devem ser utilizados dentro do mesmo ano de referência.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por colaborador..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={String(anoFiltro)} onValueChange={v => { setAnoFiltro(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={empresaFiltro} onValueChange={v => { setEmpresaFiltro(v); setSetorFiltro("todos"); setPage(1); }}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as empresas</SelectItem>
                {empresas?.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={setorFiltro} onValueChange={v => { setSetorFiltro(v); setPage(1); }}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setores?.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {(busca || empresaFiltro !== "todos" || setorFiltro !== "todos") && (
              <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setEmpresaFiltro("todos"); setSetorFiltro("todos"); setPage(1); }}>
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">
            {isLoading ? "Carregando..." : `${abonosFiltrados.length} registro${abonosFiltrados.length !== 1 ? "s" : ""} em ${anoFiltro}`}
          </span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando abonos...</div>
        ) : abonosFiltrados.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-base font-bold text-foreground">Nenhum abono registrado</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Abono" para registrar o primeiro abono de {anoFiltro}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "oklch(0.97 0.005 245)" }}>
                  <SortableHeader col="colaboradorNome" label="Colaborador" sort={sortAbonos} onToggle={toggleSortAbonos} />
                  <SortableHeader col="empresaNome" label="Empresa" sort={sortAbonos} onToggle={toggleSortAbonos} />
                  <SortableHeader col="setorNome" label="Setor" sort={sortAbonos} onToggle={toggleSortAbonos} />
                  <SortableHeader col="anoReferencia" label="Ano Ref." sort={sortAbonos} onToggle={toggleSortAbonos} align="center" />
                  <SortableHeader col="dataAbono" label="Data(s) do Abono" sort={sortAbonos} onToggle={toggleSortAbonos} align="center" />
                  <SortableHeader col="diasAbonados" label="Dias" sort={sortAbonos} onToggle={toggleSortAbonos} align="center" />
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Saldo</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Observação</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Registrado por</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {abonosFiltrados.map((abono: any, idx: number) => (
                  <tr key={abono.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #0f172a)" }}>
                          {(abono.colaboradorNome ?? "?")[0].toUpperCase()}
                        </div>
                        <NomeColaborador nome={abono.colaboradorNome ?? "—"} className="font-semibold text-sm" maxChars={26} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{abono.empresaNome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{abono.setorNome ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{abono.anoReferencia}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-medium text-sm">{formatDate(abono.dataAbono)}</span>
                        {abono.dataAbono2 && (
                          <span className="text-muted-foreground text-xs">{formatDate(abono.dataAbono2)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {abono.diasAbonados} dia{abono.diasAbonados > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SaldoBadge colaboradorId={abono.colaboradorId} anoReferencia={abono.anoReferencia} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">{abono.observacao || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      {abono.createdByNome ? (
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
                          <span className="text-muted-foreground">{abono.createdByNome}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600" onClick={() => abrirEditar(abono)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDelete(abono.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground flex items-center px-2">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}

      {/* Modal Novo/Editar */}
      <Dialog open={modalAberto} onOpenChange={v => { if (!v) fecharModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              {editando !== null ? "Editar Abono" : "Registrar Novo Abono"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Colaborador com autocomplete */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Colaborador <span className="text-red-500">*</span>
              </Label>
              <ColaboradorSearch
                value={{ id: form.colaboradorId, nome: form.colaboradorNome }}
                onChange={v => setForm({ ...form, colaboradorId: v.id, colaboradorNome: v.nome, empresaId: v.empresaId, setorId: v.setorId, admissao: v.admissao ?? null })}
                disabled={editando !== null}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Ano de referência */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ano de Referência <span className="text-red-500">*</span>
                </Label>
                <Select value={form.anoReferencia} onValueChange={v => setForm({ ...form, anoReferencia: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Dias abonados */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Dias Abonados <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.diasAbonados}
                  onValueChange={v => setForm({ ...form, diasAbonados: v, dataAbono2: v === "1" ? "" : form.dataAbono2 })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="2">2 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Aptidão de abono baseada na admissão */}
            {form.colaboradorId && form.admissao && (() => {
              const apt = calcularAptidaoAbono(form.admissao, Number(form.anoReferencia));
              return (
                <div className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm ${
                  apt.apto
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}>
                  {apt.apto
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                    : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />}
                  <div className="space-y-0.5">
                    <p className="font-semibold">{apt.apto ? "Apto ao abono social" : "Não apto ao abono social"}</p>
                    <p className="text-xs opacity-80">{apt.mensagem}</p>
                    {apt.periodoInicio && apt.periodoFim && (
                      <p className="text-xs opacity-70">Período do {apt.anoEmpresa}º ano de empresa: {apt.periodoInicio} a {apt.periodoFim}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Saldo disponível */}
            {form.colaboradorId && (
              <SaldoInfo
                colaboradorId={Number(form.colaboradorId)}
                anoReferencia={Number(form.anoReferencia)}
                editandoId={editando}
              />
            )}

            {/* Datas do abono */}
            <div className={`grid gap-4 ${dois ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {dois ? "Data do 1º Dia" : "Data do Abono"} <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.dataAbono}
                  onChange={e => setForm({ ...form, dataAbono: e.target.value })}
                />
              </div>
              {dois && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Data do 2º Dia <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.dataAbono2}
                    onChange={e => setForm({ ...form, dataAbono2: e.target.value })}
                  />
                </div>
              )}
            </div>

            {dois && (
              <p className="text-xs text-muted-foreground -mt-1">
                Os dois dias podem ser em datas diferentes — consecutivas ou não.
              </p>
            )}

            {/* Observação */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observação</Label>
              <Textarea
                value={form.observacao}
                onChange={e => setForm({ ...form, observacao: e.target.value })}
                placeholder="Motivo ou observação sobre o abono..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {editando === null && naoApto && (
              <p className="text-xs text-red-600 flex items-center gap-1 mr-auto">
                <AlertTriangle className="w-3.5 h-3.5" />
                Não é possível registrar — colaborador não apto
              </p>
            )}
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button
              onClick={salvar}
              disabled={createMutation.isPending || updateMutation.isPending || (editando === null && naoApto === true)}
              title={editando === null && naoApto && aptidaoAtual ? aptidaoAtual.mensagem : undefined}
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={v => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover abono?</AlertDialogTitle>
            <AlertDialogDescription>
              Este registro de abono será removido permanentemente. O saldo do colaborador será restaurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDelete !== null && deleteMutation.mutate({ id: confirmDelete })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
