import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Download, FileText, BarChart3, AlertTriangle, CheckCircle, Clock,
  FileSpreadsheet, FileDown, Search, X, User, Building2, Layers, Users,
  CalendarDays, Heart, ShieldCheck, Stethoscope, CalendarCheck
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { formatDate } from "@/lib/ferias";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val: Date | string | null | undefined): string {
  if (!val) return "";
  return formatDate(val as any);
}

function fmtMoney(val: string | null | undefined): string {
  return val ?? "";
}

// Busca de colaborador com autocomplete
function ColaboradorSearch({
  value,
  onChange,
}: {
  value: { id: number; nome: string } | null;
  onChange: (c: { id: number; nome: string } | null) => void;
}) {
  const [query, setQuery] = useState(value?.nome ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = trpc.colaboradores.list.useQuery(
    { busca: query.length >= 2 ? query : undefined, pageSize: 10, status: "todos" },
    { enabled: query.length >= 2 && !value }
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 pr-8"
          placeholder="Buscar colaborador por nome..."
          value={query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {(value || query) && (
          <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(""); onChange(null); setOpen(false); }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && !value && data?.data && data.data.length > 0 && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {data.data.map(c => (
            <button key={c.id} className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center gap-3"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange({ id: c.id, nome: c.nome }); setQuery(c.nome); setOpen(false); }}>
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{c.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.empresaNome ?? ""}{c.setorNome ? ` · ${c.setorNome}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filtros comuns ────────────────────────────────────────────────────────────

type FiltroComum = {
  empresaId?: number;
  setorId?: number;
  grupo?: string; // "fabrica" | "live" | "todos"
  colaborador: { id: number; nome: string } | null;
  ano?: number;
};

// Grupos de setores: identifica pelo nome do setor se contém "Fábrica" ou "Live"
const GRUPOS = [
  { value: "todos", label: "Todos os grupos" },
  { value: "fabrica", label: "Fábrica (todos)" },
  { value: "live", label: "Live (todos)" },
];

function grupoMatchSetor(nomeSetor: string, grupo: string): boolean {
  const n = nomeSetor.toLowerCase();
  if (grupo === "fabrica") return n.includes("fábrica") || n.includes("fabrica");
  if (grupo === "live") return n.includes("live");
  return true;
}

function FiltrosComuns({
  value,
  onChange,
  semColaborador,
  semAno,
  semGrupo,
  extraSlot,
}: {
  value: FiltroComum;
  onChange: (v: FiltroComum) => void;
  semColaborador?: boolean;
  semAno?: boolean;
  semGrupo?: boolean;
  extraSlot?: React.ReactNode;
}) {
  const { data: empresas } = trpc.empresas.list.useQuery();
  // Busca setores: se empresa selecionada, filtra por empresa; senão busca todos
  const { data: setoresPorEmpresa } = trpc.setores.list.useQuery(
    value.empresaId ? { empresaId: value.empresaId } : undefined
  );
  const { data: todosSetores } = trpc.setores.list.useQuery(undefined);
  const setores = value.empresaId ? setoresPorEmpresa : todosSetores;
  // Filtra setores pelo grupo selecionado
  const setoresFiltrados = (setores ?? []).filter(s =>
    !value.grupo || value.grupo === "todos" ? true : grupoMatchSetor(s.nome, value.grupo)
  );
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 5 }, (_, i) => anoAtual - i);

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Filtro de Grupo */}
      {!semGrupo && (
        <div className="space-y-1 min-w-44">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grupo</p>
          <Select value={value.grupo ?? "todos"}
            onValueChange={v => onChange({ ...value, grupo: v !== "todos" ? v : undefined, empresaId: undefined, setorId: undefined })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Todos os grupos" /></SelectTrigger>
            <SelectContent>
              {GRUPOS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Filtro de Empresa — oculto quando grupo está ativo */}
      {(!value.grupo || value.grupo === "todos") && (
        <div className="space-y-1 min-w-44">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Empresa</p>
          <Select value={value.empresaId ? String(value.empresaId) : "todos"}
            onValueChange={v => onChange({ ...value, empresaId: v !== "todos" ? Number(v) : undefined, setorId: undefined })}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as empresas</SelectItem>
              {empresas?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1 min-w-44">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Setor</p>
        <Select value={value.setorId ? String(value.setorId) : "todos"}
          onValueChange={v => onChange({ ...value, setorId: v !== "todos" ? Number(v) : undefined })}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {setoresFiltrados.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!semColaborador && (
        <div className="space-y-1 min-w-56">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Colaborador</p>
          <ColaboradorSearch value={value.colaborador} onChange={c => onChange({ ...value, colaborador: c })} />
        </div>
      )}
      {!semAno && (
        <div className="space-y-1 min-w-32">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ano</p>
          <Select value={value.ano ? String(value.ano) : "todos"}
            onValueChange={v => onChange({ ...value, ano: v !== "todos" ? Number(v) : undefined })}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os anos</SelectItem>
              {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {extraSlot}
    </div>
  );
}

// ── Botões de exportação ──────────────────────────────────────────────────────

function BotoesExport({
  rows,
  nomeArquivo,
  colsPdf,
  titulo,
  disabled,
}: {
  rows: Record<string, any>[];
  nomeArquivo: string;
  colsPdf: string[];
  titulo: string;
  disabled?: boolean;
}) {
  const canExport = rows.length > 0 && !disabled;

  function downloadCsv() {
    if (!canExport) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(";"),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
    ];
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${nomeArquivo}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  }

  function downloadExcel() {
    if (!canExport) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0]);
    ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `${nomeArquivo}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  }

  function downloadPdf() {
    if (!canExport) return;
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bahia" });
    const tableRows = rows.map(r =>
      `<tr>${colsPdf.map(c => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`
    ).join("");
    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
<style>
  @page { size: A4 landscape; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1e293b; }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%); color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 16px; font-weight: 800; }
  .header .meta { font-size: 9px; opacity: 0.7; margin-top: 4px; }
  .badge { background: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.4); color: #fbbf24; padding: 4px 10px; border-radius: 20px; font-size: 9px; font-weight: 700; }
  .total { font-size: 9px; color: #64748b; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1e293b; color: white; }
  thead th { padding: 7px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9.5px; }
  tbody td:first-child { font-weight: 600; }
  .footer { margin-top: 14px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style></head><body>
<div class="header">
  <div><h1>${titulo}</h1><div class="meta">Gestão de RH · Gerado em ${now}</div></div>
  <div class="badge">${rows.length} registro${rows.length !== 1 ? "s" : ""}</div>
</div>
<p class="total">${rows.length} registro${rows.length !== 1 ? "s" : ""} encontrado${rows.length !== 1 ? "s" : ""}</p>
<table>
  <thead><tr>${colsPdf.map(c => `<th>${c}</th>`).join("")}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">Gestão de RH — Sistema de Recursos Humanos · Salvador/BA · Documento gerado automaticamente</div>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) { toast.error("Bloqueio de pop-up detectado. Permita pop-ups para este site."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    toast.success("PDF pronto para impressão!");
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {canExport && (
        <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 mr-1">
          {rows.length} registro{rows.length !== 1 ? "s" : ""}
        </Badge>
      )}
      <Button onClick={downloadCsv} disabled={!canExport} variant="outline"
        className="gap-2 h-9 border-border/60 hover:border-primary/40 hover:bg-primary/5 text-sm">
        <FileText className="w-4 h-4 text-primary" /> CSV
      </Button>
      <Button onClick={downloadExcel} disabled={!canExport} variant="outline"
        className="gap-2 h-9 border-blue-200 hover:border-emerald-400 hover:bg-blue-50 text-blue-700 text-sm">
        <FileSpreadsheet className="w-4 h-4" /> Excel
      </Button>
      <Button onClick={downloadPdf} disabled={!canExport} variant="outline"
        className="gap-2 h-9 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-700 text-sm">
        <FileDown className="w-4 h-4" /> PDF
      </Button>
    </div>
  );
}

// ── Seção de módulo ───────────────────────────────────────────────────────────

function ModuloSection({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <Card className="border border-border/60 rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 8px oklch(0.145 0.03 245 / 0.06)" }}>
      <CardHeader className="pb-3 px-5 pt-4 border-b border-border/60 bg-muted/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">{titulo}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{descricao}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4">{children}</CardContent>
    </Card>
  );
}

// ── Abas de módulos ───────────────────────────────────────────────────────────

const MODULOS = [
  { id: "colaboradores", label: "Colaboradores", icon: Users, color: "oklch(0.45 0.14 248)", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  { id: "ferias", label: "Férias", icon: CalendarDays, color: "#059669", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  { id: "historico", label: "Histórico de Férias", icon: CalendarCheck, color: "#7c3aed", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  { id: "atestados", label: "Atestados", icon: Stethoscope, color: "#dc2626", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  { id: "abonos", label: "Abonos", icon: CalendarCheck, color: "#d97706", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  { id: "beneficios", label: "Benefícios VR/VT", icon: Heart, color: "#db2777", bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700" },
  { id: "seguro", label: "Seguro de Vida", icon: ShieldCheck, color: "#0891b2", bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
] as const;

type ModuloId = typeof MODULOS[number]["id"];

// ── Módulo: Colaboradores ─────────────────────────────────────────────────────

function ModuloColaboradores() {
  const [filtro, setFiltro] = useState<FiltroComum>({ colaborador: null });
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "ativo" | "inativo">("todos");
  const { data: todosSetores } = trpc.setores.list.useQuery(undefined);
  const params = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
    ...(filtro.colaborador ? { colaboradorId: filtro.colaborador.id } : {}),
  };
  const { data } = trpc.colaboradores.exportCsv.useQuery(Object.keys(params).length > 0 ? params : undefined);

  // Filtra por status e por grupo no frontend
  const dadosFiltrados = (data ?? []).filter(c => {
    if (statusFiltro === "ativo" && c.status !== "ativo") return false;
    if (statusFiltro === "inativo" && c.status === "ativo") return false;
    if (!filtro.grupo || filtro.grupo === "todos") return true;
    const nomeSetor = (todosSetores ?? []).find(s => s.nome === c.setorNome)?.nome ?? c.setorNome ?? "";
    return grupoMatchSetor(nomeSetor, filtro.grupo);
  });

  const totalAtivos = (data ?? []).filter(c => c.status === "ativo").length;
  const totalInativos = (data ?? []).filter(c => c.status !== "ativo").length;

  const rows = dadosFiltrados.map(c => ({
    "Código": c.codigo ?? "",
    "Nome": c.nome,
    "Empresa": c.empresaNome ?? "",
    "Setor": c.setorNome ?? "",
    "Status": c.status === "ativo" ? "Ativo" : "Inativo",
    "Admissão": fmtDate(c.admissao),
    "Data de Nascimento": fmtDate(c.dataNascimento),
    "CPF": c.cpf ?? "",
    "RG": c.rg ?? "",
    "Expedição RG": fmtDate(c.rgExpedicao),
    "Órgão Expedidor": c.rgOrgaoExpedidor ?? "",
    "Nome do Pai": c.nomePai ?? "",
    "Nome da Mãe": c.nomeMae ?? "",
    "Telefone": c.telefone ?? "",
    "E-mail Corporativo": c.emailCorporativo ?? "",
    "Cargo": c.cargo ?? "",
    "CTPS": c.ctpsDigital ? `Digital (CPF: ${c.ctpsNumero ?? ""})` : `Física — Nº ${c.ctpsNumero ?? ""} Série ${c.ctpsSerie ?? ""}`,
    "Título de Eleitor": c.tituloEleitor ?? "",
    "Endereço": [
      c.enderecoLogradouro, c.enderecoNumero, c.enderecoComplemento,
      c.enderecoBairro, c.enderecoCidade, c.enderecoEstado, c.enderecoCep
    ].filter(Boolean).join(", "),
    "Contato Emergência": c.contatoEmergenciaNome ?? "",
    "Tel. Emergência": c.contatoEmergenciaTelefone ?? "",
  }));
  return (
    <ModuloSection titulo="Colaboradores" descricao="Ficha cadastral completa: dados pessoais, documentos e contatos">
      {/* Abas de filtro por status */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/50 w-fit mb-1">
        {([
          { value: "todos", label: "Todos", count: (data ?? []).length },
          { value: "ativo", label: "Ativos", count: totalAtivos },
          { value: "inativo", label: "Inativos", count: totalInativos },
        ] as const).map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFiltro(tab.value)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              statusFiltro === tab.value
                ? tab.value === "ativo"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : tab.value === "inativo"
                  ? "bg-slate-600 text-white shadow-sm"
                  : "bg-background text-foreground shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              statusFiltro === tab.value
                ? "bg-white/20 text-inherit"
                : "bg-muted text-muted-foreground"
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>
      <FiltrosComuns value={filtro} onChange={setFiltro} semAno />
      <BotoesExport rows={rows} nomeArquivo={`relatorio-colaboradores-${statusFiltro}`} titulo={`Relatório de Colaboradores — ${statusFiltro === "ativo" ? "Ativos" : statusFiltro === "inativo" ? "Inativos" : "Todos"}`}
        colsPdf={["Nome", "Empresa", "Setor", "Status", "Admissão", "Data de Nascimento", "CPF", "RG", "Cargo", "Telefone"]} />
    </ModuloSection>
  );
}

// ── Módulo: Férias (situação atual) ──────────────────────────────────────────

function ModuloFerias() {
  const [filtro, setFiltro] = useState<FiltroComum>({ colaborador: null });
  const params = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
    ...(filtro.colaborador ? { colaboradorId: filtro.colaborador.id } : {}),
  };
  const { data } = trpc.colaboradores.exportCsv.useQuery(Object.keys(params).length > 0 ? params : undefined);
  const rows = (data ?? []).filter(c => {
    if (c.status !== "ativo") return false;
    if (!filtro.grupo || filtro.grupo === "todos") return true;
    return grupoMatchSetor(c.setorNome ?? "", filtro.grupo);
  }).map(c => ({
    "Nome": c.nome,
    "Empresa": c.empresaNome ?? "",
    "Setor": c.setorNome ?? "",
    "Admissão": fmtDate(c.admissao),
    "Período Aquisitivo": fmtDate(c.periodoAquisitivo),
    "Vencimento": fmtDate(c.vencimento),
    "Data Limite": fmtDate(c.dataLimite),
    "Dias de Direito": c.diasDireito ?? "",
    "Saldo (dias)": c.saldo ?? "",
    "Venda 10 dias": c.venda10 === "SIM" ? "Sim" : "Não",
    "Fracionada": c.fracionada ?? "",
    "Planejamento 1": c.planejamento1 ?? "",
    "Planejamento 2": c.planejamento2 ?? "",
    "Planejamento 3": c.planejamento3 ?? "",
    "Observações": c.observacoes ?? "",
  }));
  return (
    <ModuloSection titulo="Férias — Situação Atual" descricao="Saldo, vencimentos e planejamentos de férias dos colaboradores ativos">
      <FiltrosComuns value={filtro} onChange={setFiltro} semAno />
      <BotoesExport rows={rows} nomeArquivo="relatorio-ferias" titulo="Relatório de Férias — Situação Atual"
        colsPdf={["Nome", "Empresa", "Setor", "Admissão", "Período Aquisitivo", "Vencimento", "Data Limite", "Saldo (dias)"]} />
    </ModuloSection>
  );
}

// ── Módulo: Histórico de Férias ───────────────────────────────────────────────

function ModuloHistoricoFerias() {
  const [filtro, setFiltro] = useState<FiltroComum>({ colaborador: null });
  const params = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
    ...(filtro.colaborador ? { colaboradorId: filtro.colaborador.id } : {}),
    ...(filtro.ano ? { ano: filtro.ano } : {}),
  };
  const { data } = trpc.historicoFerias.exportar.useQuery(Object.keys(params).length > 0 ? params : undefined);
  const rows = (data ?? []).filter(h => {
    if (!filtro.grupo || filtro.grupo === "todos") return true;
    return grupoMatchSetor(h.setorNome ?? "", filtro.grupo);
  }).map(h => ({
    "Colaborador": h.colaboradorNome ?? "",
    "Empresa": h.empresaNome ?? "",
    "Setor": h.setorNome ?? "",
    "Saída": fmtDate(h.dataSaida),
    "Retorno": fmtDate(h.dataRetorno),
    "Dias Gozados": h.diasGozados,
    "Venda 10 dias": h.venda10 === "SIM" ? "Sim" : "Não",
    "Dias Vendidos": h.diasVendidos ?? 0,
    "Período Ref.": h.periodoRef ?? "",
    "Observação": h.observacao ?? "",
    "Registrado por": h.createdByNome ?? "",
  }));
  return (
    <ModuloSection titulo="Histórico de Férias" descricao="Períodos de férias já gozados pelos colaboradores">
      <FiltrosComuns value={filtro} onChange={setFiltro} />
      <BotoesExport rows={rows} nomeArquivo="relatorio-historico-ferias" titulo="Relatório de Histórico de Férias"
        colsPdf={["Colaborador", "Empresa", "Setor", "Saída", "Retorno", "Dias Gozados", "Venda 10 dias", "Período Ref."]} />
    </ModuloSection>
  );
}

// ── Módulo: Atestados ─────────────────────────────────────────────────────────

function ModuloAtestados() {
  const [filtro, setFiltro] = useState<FiltroComum>({ colaborador: null });
  const TIPO_LABEL: Record<string, string> = { medico: "Médico", odontologico: "Odontológico", acompanhante: "Acompanhante", outros: "Outros" };
  const params = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
    ...(filtro.colaborador ? { colaboradorId: filtro.colaborador.id } : {}),
    ...(filtro.ano ? { ano: filtro.ano } : {}),
  };
  const { data } = trpc.atestados.exportar.useQuery(Object.keys(params).length > 0 ? params : undefined);
  const rows = (data ?? []).filter(a => {
    if (!filtro.grupo || filtro.grupo === "todos") return true;
    return grupoMatchSetor(a.setorNome ?? "", filtro.grupo);
  }).map(a => ({
    "Colaborador": a.colaboradorNome ?? "",
    "Empresa": a.empresaNome ?? "",
    "Setor": a.setorNome ?? "",
    "Início": fmtDate(a.dataInicio),
    "Fim": fmtDate(a.dataFim),
    "Dias Afastamento": a.diasAfastamento,
    "Tipo": TIPO_LABEL[a.tipo] ?? a.tipo,
    "CID": a.cid ?? "",
    "Médico": a.medico ?? "",
    "Observação": a.observacao ?? "",
    "Registrado por": a.createdByNome ?? "",
  }));
  return (
    <ModuloSection titulo="Atestados Médicos" descricao="Afastamentos por atestado médico, odontológico e outros">
      <FiltrosComuns value={filtro} onChange={setFiltro} />
      <BotoesExport rows={rows} nomeArquivo="relatorio-atestados" titulo="Relatório de Atestados"
        colsPdf={["Colaborador", "Empresa", "Setor", "Início", "Fim", "Dias Afastamento", "Tipo", "CID", "Médico"]} />
    </ModuloSection>
  );
}

// ── Módulo: Abonos ────────────────────────────────────────────────────────────

function ModuloAbonos() {
  const [filtro, setFiltro] = useState<FiltroComum>({ colaborador: null });
  const params = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
    ...(filtro.colaborador ? { colaboradorId: filtro.colaborador.id } : {}),
    ...(filtro.ano ? { ano: filtro.ano } : {}),
  };
  const { data } = trpc.abonos.exportar.useQuery(Object.keys(params).length > 0 ? params : undefined);
  const rows = (data ?? []).filter(a => {
    if (!filtro.grupo || filtro.grupo === "todos") return true;
    return grupoMatchSetor(a.setorNome ?? "", filtro.grupo);
  }).map(a => ({
    "Colaborador": a.colaboradorNome ?? "",
    "Empresa": a.empresaNome ?? "",
    "Setor": a.setorNome ?? "",
    "Ano Referência": a.anoReferencia,
    "Data Abono 1": fmtDate(a.dataAbono),
    "Data Abono 2": fmtDate(a.dataAbono2),
    "Dias Abonados": a.diasAbonados,
    "Observação": a.observacao ?? "",
    "Registrado por": a.createdByNome ?? "",
  }));
  return (
    <ModuloSection titulo="Abonos Sociais" descricao="Dias de folga abonados por colaborador (2 dias/ano)">
      <FiltrosComuns value={filtro} onChange={setFiltro} />
      <BotoesExport rows={rows} nomeArquivo="relatorio-abonos" titulo="Relatório de Abonos Sociais"
        colsPdf={["Colaborador", "Empresa", "Setor", "Ano Referência", "Data Abono 1", "Data Abono 2", "Dias Abonados"]} />
    </ModuloSection>
  );
}

// ── Módulo: Benefícios ────────────────────────────────────────────────────────

function ModuloBeneficios() {
  const [filtro, setFiltro] = useState<FiltroComum>({ colaborador: null });
  const params = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
  };
  const { data } = trpc.beneficios.exportar.useQuery(Object.keys(params).length > 0 ? params : undefined);
  const rows = (data ?? []).filter(b => {
    if (!filtro.grupo || filtro.grupo === "todos") return true;
    return grupoMatchSetor(b.setorNome ?? "", filtro.grupo);
  }).map(b => ({
    "Colaborador": b.nome,
    "Empresa": b.empresaNome ?? "",
    "Setor": b.setorNome ?? "",
    "Setor Benefício": b.setorBeneficio ?? "",
    "VR (R$)": fmtMoney(b.valorVR),
    "VT (R$)": fmtMoney(b.valorVT),
    "Auxílio Veículo (R$)": fmtMoney(b.auxilioVeiculo),
  }));
  return (
    <ModuloSection titulo="Benefícios VR/VT" descricao="Vale-refeição, vale-transporte e auxílio veículo dos colaboradores">
      <FiltrosComuns value={filtro} onChange={setFiltro} semColaborador semAno />
      <BotoesExport rows={rows} nomeArquivo="relatorio-beneficios" titulo="Relatório de Benefícios VR/VT"
        colsPdf={["Colaborador", "Empresa", "Setor", "Setor Benefício", "VR (R$)", "VT (R$)", "Auxílio Veículo (R$)"]} />
    </ModuloSection>
  );
}

// ── Módulo: Seguro de Vida ────────────────────────────────────────────────────

function ModuloSeguroVida() {
  const [filtro, setFiltro] = useState<FiltroComum>({ colaborador: null });
  const [seguro, setSeguro] = useState<"com" | "sem" | "todos">("todos");
  const params = {
    ...(filtro.empresaId ? { empresaId: filtro.empresaId } : {}),
    ...(filtro.setorId ? { setorId: filtro.setorId } : {}),
    seguro,
  };
  const { data } = trpc.seguroVida.exportar.useQuery(params);
  const rows = (data ?? []).filter(s => {
    if (!filtro.grupo || filtro.grupo === "todos") return true;
    return grupoMatchSetor(s.setorNome ?? "", filtro.grupo);
  }).map(s => ({
    "Colaborador": s.nome,
    "Empresa": s.empresaNome ?? "",
    "Setor": s.setorNome ?? "",
    "Tem Seguro": s.temSeguroVida ? "Sim" : "Não",
    "Valor Seguro (R$)": fmtMoney(s.valorSeguroVida),
  }));
  const extraSlot = (
    <div className="space-y-1 min-w-36">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filtrar</p>
      <Select value={seguro} onValueChange={v => setSeguro(v as any)}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="com">Com seguro</SelectItem>
          <SelectItem value="sem">Sem seguro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
  return (
    <ModuloSection titulo="Seguro de Vida" descricao="Apólices e valores de seguro de vida dos colaboradores">
      <FiltrosComuns value={filtro} onChange={setFiltro} semColaborador semAno extraSlot={extraSlot} />
      <BotoesExport rows={rows} nomeArquivo="relatorio-seguro-vida" titulo="Relatório de Seguro de Vida"
        colsPdf={["Colaborador", "Empresa", "Setor", "Tem Seguro", "Valor Seguro (R$)"]} />
    </ModuloSection>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Relatorio() {
  const [abaAtiva, setAbaAtiva] = useState<ModuloId>("colaboradores");
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: statusPorSetor } = trpc.dashboard.statusPorSetor.useQuery();

  const modulo = MODULOS.find(m => m.id === abaAtiva)!;

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in-up">

      {/* Header */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.22 0.08 250 / 0.18)"
      }}>
        <div className="px-7 py-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.48 0.20 252), oklch(0.45 0.18 255))", boxShadow: "0 4px 12px oklch(0.45 0.18 250 / 0.30)" }}>
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Relatórios</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Exporte dados de todos os módulos do sistema — CSV, Excel ou PDF — com filtros por empresa, setor e colaborador</p>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Colaboradores Ativos", value: stats?.ativos ?? "—", color: "border-l-primary", bg: "bg-primary/5", text: "text-primary" },
          { label: "Férias Vencidas", value: stats?.vencidas ?? "—", color: "border-l-red-500", bg: "bg-red-50", text: "text-red-600" },
          { label: "Vencem em 30 dias", value: stats?.vence30 ?? "—", color: "border-l-orange-500", bg: "bg-orange-50", text: "text-orange-600" },
          { label: "Vencem em 90 dias", value: stats?.vence90 ?? "—", color: "border-l-blue-500", bg: "bg-blue-50", text: "text-blue-600" },
        ].map(item => (
          <div key={item.label} className={`rounded-xl border border-l-4 ${item.color} border-border/60 ${item.bg} p-4`}
            style={{ boxShadow: "0 1px 3px oklch(0.145 0.03 245 / 0.06)" }}>
            <p className={`text-2xl font-bold ${item.text}`} style={{ fontFamily: "var(--font-display)" }}>{item.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Abas de módulos */}
      <div>
        <div className="flex flex-wrap gap-2 mb-5">
          {MODULOS.map(m => {
            const Icon = m.icon;
            const active = abaAtiva === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setAbaAtiva(m.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                  active
                    ? `${m.bg} ${m.border} ${m.text} ring-2 ring-offset-1`
                    : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                }`}
                style={active ? { boxShadow: `0 2px 8px ${m.color}30` } : { boxShadow: "0 1px 3px oklch(0.145 0.03 245 / 0.06)" }}
              >
                <Icon className="w-4 h-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo da aba ativa */}
        <div key={abaAtiva}>
          {abaAtiva === "colaboradores" && <ModuloColaboradores />}
          {abaAtiva === "ferias" && <ModuloFerias />}
          {abaAtiva === "historico" && <ModuloHistoricoFerias />}
          {abaAtiva === "atestados" && <ModuloAtestados />}
          {abaAtiva === "abonos" && <ModuloAbonos />}
          {abaAtiva === "beneficios" && <ModuloBeneficios />}
          {abaAtiva === "seguro" && <ModuloSeguroVida />}
        </div>
      </div>

      {/* Tabela de situação por setor — sempre visível */}
      <Card className="border border-border/60 rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 8px oklch(0.145 0.03 245 / 0.06)" }}>
        <CardHeader className="pb-3 px-5 pt-4 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Situação Geral por Setor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Setor</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencidas</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Vencem 30d</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Saldo Médio</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Situação</th>
                </tr>
              </thead>
              <tbody>
                {(statusPorSetor ?? []).map((s, idx) => (
                  <tr key={s.setorId} className={`border-b border-border row-hover ${idx % 2 === 1 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-primary/8 text-primary border border-primary/15">
                        {s.empresaNome}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{s.setorNome}</td>
                    <td className="px-4 py-3 text-center">{s.total}</td>
                    <td className="px-4 py-3 text-center">
                      {s.vencidas > 0
                        ? <Badge className="text-xs border bg-red-100 text-red-700 border-red-200">{s.vencidas}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.vence30 > 0
                        ? <Badge className="text-xs border bg-orange-100 text-orange-700 border-orange-200">{s.vence30}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">{s.saldoMedio} dias</td>
                    <td className="px-4 py-3 text-center">
                      {s.vencidas > 0 ? (
                        <div className="flex items-center justify-center gap-1 text-red-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Crítico</span>
                        </div>
                      ) : s.vence30 > 0 ? (
                        <div className="flex items-center justify-center gap-1 text-orange-600">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Atenção</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-blue-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Em dia</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
