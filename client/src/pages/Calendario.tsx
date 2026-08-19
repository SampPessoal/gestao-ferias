import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Plus, Trash2, Bell, Calendar, MapPin, Clock, Flag, Sparkles, LayoutList, FileDown } from "lucide-react";
import { toast } from "sonner";

// ─── Feriados ──────────────────────────────────────────────────────────────────
const FERIADOS_NACIONAIS_FIXOS = [
  { dia: 1, mes: 1, nome: "Confraternização Universal" },
  { dia: 21, mes: 4, nome: "Tiradentes" },
  { dia: 1, mes: 5, nome: "Dia do Trabalho" },
  { dia: 7, mes: 9, nome: "Independência do Brasil" },
  { dia: 12, mes: 10, nome: "Nossa Senhora Aparecida" },
  { dia: 2, mes: 11, nome: "Finados" },
  { dia: 15, mes: 11, nome: "Proclamação da República" },
  { dia: 20, mes: 11, nome: "Consciência Negra" },
  { dia: 25, mes: 12, nome: "Natal" },
];
const FERIADOS_BAHIA_FIXOS = [
  { dia: 2, mes: 7, nome: "Independência da Bahia" },
];
const FERIADOS_SALVADOR_FIXOS = [
  { dia: 1, mes: 11, nome: "Festa de Todos os Santos" },
];

function calcularPascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function getFeriadosMoveis(ano: number) {
  const pascoa = calcularPascoa(ano);
  const add = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [
    { data: fmt(add(pascoa, -48)), nome: "Carnaval (2ª feira)", tipo: "nacional" },
    { data: fmt(add(pascoa, -47)), nome: "Carnaval (3ª feira)", tipo: "nacional" },
    { data: fmt(add(pascoa, -46)), nome: "Quarta-feira de Cinzas", tipo: "nacional" },
    { data: fmt(add(pascoa, -2)), nome: "Sexta-feira Santa", tipo: "nacional" },
    { data: fmt(pascoa), nome: "Páscoa", tipo: "nacional" },
    { data: fmt(add(pascoa, 60)), nome: "Corpus Christi", tipo: "nacional" },
  ];
}

function getFeriadosAno(ano: number) {
  const fixos = [
    ...FERIADOS_NACIONAIS_FIXOS.map(f => ({ data: `${ano}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`, nome: f.nome, tipo: "nacional" })),
    ...FERIADOS_BAHIA_FIXOS.map(f => ({ data: `${ano}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`, nome: f.nome, tipo: "bahia" })),
    ...FERIADOS_SALVADOR_FIXOS.map(f => ({ data: `${ano}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`, nome: f.nome, tipo: "salvador" })),
  ];
  return [...fixos, ...getFeriadosMoveis(ano)];
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_SEMANA_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CORES_EVENTO = [
  { valor: "blue", label: "Azul", hex: "#3b82f6" },
  { valor: "indigo", label: "Índigo", hex: "#6366f1" },
  { valor: "purple", label: "Roxo", hex: "#a855f7" },
  { valor: "pink", label: "Rosa", hex: "#ec4899" },
  { valor: "red", label: "Vermelho", hex: "#ef4444" },
  { valor: "orange", label: "Laranja", hex: "#f97316" },
  { valor: "yellow", label: "Amarelo", hex: "#eab308" },
  { valor: "green", label: "Verde", hex: "#22c55e" },
  { valor: "teal", label: "Verde-água", hex: "#14b8a6" },
];

function getCorHex(cor: string | null | undefined) {
  return CORES_EVENTO.find(c => c.valor === (cor ?? "blue"))?.hex ?? "#3b82f6";
}

function corFeriado(tipo: string) {
  if (tipo === "salvador") return { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" };
  if (tipo === "bahia") return { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" };
  return { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" };
}

function tipoFeriadoLabel(tipo: string) {
  if (tipo === "salvador") return "Salvador";
  if (tipo === "bahia") return "Bahia";
  return "Nacional";
}

export default function Calendario() {
  const hoje = new Date();
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const [mesAtual, setMesAtual] = useState(hoje.getMonth() + 1);

  const { data: eventos = [] } = trpc.calendario.list.useQuery(
    { ano: anoAtual, mes: mesAtual },
    { refetchOnWindowFocus: false }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.calendario.create.useMutation({
    onSuccess: () => {
      toast.success("Evento criado com sucesso!");
      utils.calendario.list.invalidate();
      setModalOpen(false);
      resetForm();
    },
    onError: (e) => toast.error("Erro ao criar evento: " + e.message),
  });

  const deleteMutation = trpc.calendario.delete.useMutation({
    onSuccess: () => {
      toast.success("Evento removido.");
      utils.calendario.list.invalidate();
      setConfirmDelete(null);
    },
    onError: () => toast.error("Erro ao remover evento."),
  });

  const agendarLembretesMutation = trpc.calendario.agendarLembretes.useMutation({
    onSuccess: (data) => {
      if (data.agendados === 0) toast.info("Nenhum lembrete agendado — evento já passou ou é muito próximo.");
      else toast.success(`${data.agendados} lembrete(s) agendado(s)! Serão enviados por notificação e e-mail.`);
      utils.calendario.list.invalidate();
    },
    onError: (e) => toast.error("Erro ao agendar lembretes: " + e.message),
  });

  const cancelarLembretesMutation = trpc.calendario.cancelarLembretes.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.cancelados} lembrete(s) cancelado(s).`);
      utils.calendario.list.invalidate();
    },
    onError: () => toast.error("Erro ao cancelar lembretes."),
  });

  const feriados = useMemo(() => getFeriadosAno(anoAtual), [anoAtual]);
  const feriadosPorData = useMemo(() => {
    const map: Record<string, { nome: string; tipo: string }[]> = {};
    feriados.forEach(f => { if (!map[f.data]) map[f.data] = []; map[f.data].push(f); });
    return map;
  }, [feriados]);

  const eventosPorData = useMemo(() => {
    const map: Record<string, typeof eventos> = {};
    eventos.forEach(e => {
      const d = new Date(e.dataHora);
      const offsetBrasilia = -3 * 60;
      const localMs = d.getTime() + (d.getTimezoneOffset() + offsetBrasilia) * 60 * 1000;
      const dLocal = new Date(localMs);
      const key = `${dLocal.getUTCFullYear()}-${String(dLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(dLocal.getUTCDate()).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [eventos]);

  const diasDoMes = useMemo(() => {
    const primeiroDia = new Date(anoAtual, mesAtual - 1, 1).getDay();
    const totalDias = new Date(anoAtual, mesAtual, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < primeiroDia; i++) cells.push(null);
    for (let d = 1; d <= totalDias; d++) cells.push(d);
    return cells;
  }, [anoAtual, mesAtual]);

  // Próximos eventos do mês (para painel lateral)
  const proximosEventos = useMemo(() => {
    return eventos
      .filter(e => {
        const d = new Date(e.dataHora);
        const offsetBrasilia = -3 * 60;
        const localMs = d.getTime() + (d.getTimezoneOffset() + offsetBrasilia) * 60 * 1000;
        return localMs >= Date.now();
      })
      .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
      .slice(0, 5);
  }, [eventos]);

  // Feriados do mês
  const feriadosDoMes = useMemo(() => {
    return feriados.filter(f => f.data.startsWith(`${anoAtual}-${String(mesAtual).padStart(2, "0")}-`))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [feriados, anoAtual, mesAtual]);

  const [visao, setVisao] = useState<"calendario" | "agenda">("calendario");
  const [filtroAgenda, setFiltroAgenda] = useState<"todos" | "eventos" | "feriados">("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [diaClicado, setDiaClicado] = useState<number | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "", hora: "09:00", diaInteiro: false, cor: "blue" });
  const [diaDetalhe, setDiaDetalhe] = useState<{ dia: number; data: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function exportarAgendaPDF() {
    const itensFiltrados = agendaItens.filter(i =>
      filtroAgenda === "todos" || i.tipo === (filtroAgenda === "eventos" ? "evento" : "feriado")
    );
    const titulo = `Agenda — ${MESES[mesAtual - 1]} ${anoAtual}`;
    const subtitulo = filtroAgenda === "todos" ? "Todos os itens" : filtroAgenda === "eventos" ? "Apenas Eventos" : "Apenas Feriados";

    const linhas = itensFiltrados.map(item => {
      const dataFormatada = `${String(item.dia).padStart(2, "0")}/${String(mesAtual).padStart(2, "0")}/${anoAtual}`;
      if (item.tipo === "feriado") {
        const tipo = item.feriadoTipo === "nacional" ? "Nacional" : item.feriadoTipo === "bahia" ? "Bahia" : "Salvador";
        return `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 14px;font-size:13px;color:#374151;font-weight:600">${dataFormatada}</td>
          <td style="padding:10px 14px;font-size:13px;color:#374151">${item.diaSemana}</td>
          <td style="padding:10px 14px">
            <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:#fee2e2;color:#b91c1c">Feriado ${tipo}</span>
          </td>
          <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600">${item.nome}</td>
          <td style="padding:10px 14px;font-size:12px;color:#6b7280">—</td>
        </tr>`;
      }
      const corHex = getCorHex(item.eventoCor);
      return `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px 14px;font-size:13px;color:#374151;font-weight:600">${dataFormatada}</td>
        <td style="padding:10px 14px;font-size:13px;color:#374151">${item.diaSemana}</td>
        <td style="padding:10px 14px">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:${corHex}22;color:${corHex}">Evento</span>
        </td>
        <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600">${item.nome}</td>
        <td style="padding:10px 14px;font-size:12px;color:#6b7280">${item.eventoDiaInteiro ? "Dia inteiro" : (item.eventoHora ?? "")}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111827; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 32px 40px; }
    .header h1 { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
    .header p { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 4px; }
    .badge { display:inline-block; padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; background:rgba(245,158,11,0.2); color:#f59e0b; margin-top:10px; }
    .meta { padding: 16px 40px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; display:flex; gap:24px; }
    .meta-item { font-size:12px; color:#6b7280; }
    .meta-item strong { color:#111827; font-weight:700; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    thead th { padding: 10px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; text-align:left; }
    tbody tr:hover { background: #f9fafb; }
    .footer { padding: 20px 40px; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb; margin-top:8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Gest\u00e3o de RH</h1>
    <p>${titulo}</p>
    <span class="badge">${subtitulo} &bull; ${itensFiltrados.length} item${itensFiltrados.length !== 1 ? "s" : ""}</span>
  </div>
  <div class="meta">
    <div class="meta-item">Empresa: <strong>Salvador, Bahia</strong></div>
    <div class="meta-item">Gerado em: <strong>${new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" })}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Dia</th>
        <th>Tipo</th>
        <th>Descri\u00e7\u00e3o</th>
        <th>Hor\u00e1rio</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
  <div class="footer">Gestão de RH &bull; Documento gerado automaticamente</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => {
        setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 300);
      };
    } else {
      // fallback: download direto
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenda-${anoAtual}-${String(mesAtual).padStart(2, "0")}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.info("Arquivo baixado. Abra no navegador e use Ctrl+P para imprimir como PDF.");
    }
  }

  function resetForm() {
    setForm({ titulo: "", descricao: "", hora: "09:00", diaInteiro: false, cor: "blue" });
    setDiaClicado(null);
  }

  function abrirModalCriar(dia: number) { setDiaClicado(dia); setModalOpen(true); }
  function abrirDetalhe(dia: number) {
    const dataStr = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    setDiaDetalhe({ dia, data: dataStr });
  }

  function criarEvento() {
    if (!form.titulo.trim() || diaClicado === null) return;
    const [hh, mm] = form.hora.split(":").map(Number);
    const dataLocal = new Date(Date.UTC(anoAtual, mesAtual - 1, diaClicado, hh + 3, mm, 0));
    createMutation.mutate({ titulo: form.titulo.trim(), descricao: form.descricao.trim() || undefined, dataHora: dataLocal, diaInteiro: form.diaInteiro, cor: form.cor });
  }

  function navMes(delta: number) {
    let novoMes = mesAtual + delta, novoAno = anoAtual;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMesAtual(novoMes); setAnoAtual(novoAno);
  }

  const hojeStr = (() => {
    const offsetBrasilia = -3 * 60;
    const localMs = hoje.getTime() + (hoje.getTimezoneOffset() + offsetBrasilia) * 60 * 1000;
    const h = new Date(localMs);
    return `${h.getUTCFullYear()}-${String(h.getUTCMonth() + 1).padStart(2, "0")}-${String(h.getUTCDate()).padStart(2, "0")}`;
  })();

  const totalEventosMes = eventos.length;
  const totalFeriadosMes = feriadosDoMes.length;

  // Agenda: todos os itens do mês (feriados + eventos) ordenados por data
  const agendaItens = useMemo(() => {
    const itens: { data: string; dia: number; diaSemana: string; tipo: "feriado" | "evento"; nome: string; feriadoTipo?: string; eventoId?: number; eventoCor?: string | null; eventoHora?: string; eventoDiaInteiro?: boolean; eventoDescricao?: string | null; eventoLembrete?: string | null }[] = [];
    // feriados
    feriadosDoMes.forEach(f => {
      const dia = parseInt(f.data.split("-")[2]);
      itens.push({ data: f.data, dia, diaSemana: DIAS_SEMANA_FULL[new Date(anoAtual, mesAtual - 1, dia).getDay()], tipo: "feriado", nome: f.nome, feriadoTipo: f.tipo });
    });
    // eventos
    eventos.forEach(ev => {
      const d = new Date(ev.dataHora);
      const offsetBrasilia = -3 * 60;
      const localMs = d.getTime() + (d.getTimezoneOffset() + offsetBrasilia) * 60 * 1000;
      const dLocal = new Date(localMs);
      const dataStr = `${dLocal.getUTCFullYear()}-${String(dLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(dLocal.getUTCDate()).padStart(2, "0")}`;
      const dia = dLocal.getUTCDate();
      const hora = ev.diaInteiro ? undefined : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" });
      itens.push({ data: dataStr, dia, diaSemana: DIAS_SEMANA_FULL[new Date(anoAtual, mesAtual - 1, dia).getDay()], tipo: "evento", nome: ev.titulo, eventoCor: ev.cor, eventoId: ev.id, eventoHora: hora, eventoDiaInteiro: ev.diaInteiro, eventoDescricao: ev.descricao, eventoLembrete: ev.lembretesTaskUids });
    });
    return itens.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "feriado" ? -1 : 1));
  }, [feriados, eventos, feriadosDoMes, anoAtual, mesAtual]);

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── Header Premium ── */}
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-5"
        style={{
          background: "linear-gradient(135deg, oklch(0.13 0.07 254) 0%, oklch(0.20 0.08 252) 60%, oklch(0.14 0.012 240) 100%)",
          boxShadow: "0 4px 20px oklch(0.145 0.06 248 / 0.25)"
        }}
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full opacity-[0.07]" style={{ background: "oklch(0.45 0.18 252)" }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "radial-gradient(oklch(1 0 0) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.60 0.18 210 / 0.20)" }}>
                <Calendar className="w-4 h-4" style={{ color: "oklch(0.50 0.18 252)" }} />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "oklch(0.50 0.18 252)" }}>Calendário</p>
            </div>
            <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {MESES[mesAtual - 1]} {anoAtual}
            </h1>
            <p className="text-white/45 text-sm mt-0.5">
              {totalEventosMes > 0 ? `${totalEventosMes} evento${totalEventosMes > 1 ? "s" : ""} · ` : ""}{totalFeriadosMes} feriado{totalFeriadosMes !== 1 ? "s" : ""} este mês
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle visão */}
            <div className="flex items-center rounded-xl border border-white/15 overflow-hidden">
              <button
                onClick={() => setVisao("calendario")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all ${
                  visao === "calendario" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Calendário
              </button>
              <button
                onClick={() => setVisao("agenda")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all ${
                  visao === "agenda" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" /> Agenda
              </button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10 border border-white/15 text-xs"
              onClick={() => { setMesAtual(hoje.getMonth() + 1); setAnoAtual(hoje.getFullYear()); }}
            >
              Hoje
            </Button>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => navMes(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => navMes(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layout principal: Calendário + Painel lateral ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">

        {/* Calendário ou Agenda */}
        <div className="xl:col-span-3">
        {visao === "agenda" ? (
          /* ── VISÃO AGENDA ── */
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px oklch(0.145 0.03 245 / 0.08)" }}>
            <div className="px-5 py-4 border-b border-border/60">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LayoutList className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Agenda — {MESES[mesAtual - 1]} {anoAtual}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {agendaItens.filter(i => filtroAgenda === "todos" || i.tipo === (filtroAgenda === "eventos" ? "evento" : "feriado")).length} item{agendaItens.filter(i => filtroAgenda === "todos" || i.tipo === (filtroAgenda === "eventos" ? "evento" : "feriado")).length !== 1 ? "s" : ""}
                </span>
              </div>
              {/* Botões de filtro + Exportar */}
              <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {([
                  { key: "todos", label: "Todos", count: agendaItens.length },
                  { key: "eventos", label: "Eventos", count: agendaItens.filter(i => i.tipo === "evento").length },
                  { key: "feriados", label: "Feriados", count: agendaItens.filter(i => i.tipo === "feriado").length },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFiltroAgenda(f.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      filtroAgenda === f.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {f.label}
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${
                      filtroAgenda === f.key ? "bg-white/20" : "bg-border"
                    }`}>{f.count}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={exportarAgendaPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0"
                title="Exportar agenda como PDF"
              >
                <FileDown className="w-3.5 h-3.5" />
                Exportar PDF
              </button>
              </div>
            </div>
            {agendaItens.filter(i => filtroAgenda === "todos" || i.tipo === (filtroAgenda === "eventos" ? "evento" : "feriado")).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Calendar className="w-12 h-12 text-muted-foreground/25 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  {filtroAgenda === "eventos" ? "Nenhum evento este mês" : filtroAgenda === "feriados" ? "Nenhum feriado este mês" : "Nenhum evento ou feriado este mês"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">Clique em um dia no calendário para adicionar um evento</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {agendaItens.filter(i => filtroAgenda === "todos" || i.tipo === (filtroAgenda === "eventos" ? "evento" : "feriado")).map((item, idx) => {
                  const isHojeItem = item.data === hojeStr;
                  if (item.tipo === "feriado") {
                    const c = corFeriado(item.feriadoTipo ?? "nacional");
                    return (
                      <div key={`f-${idx}`} className={`flex items-center gap-4 px-5 py-3.5 ${isHojeItem ? "bg-primary/5" : "hover:bg-muted/20"} transition-colors`}>
                        <div className="w-12 text-center shrink-0">
                          <p className={`text-2xl font-black leading-none ${isHojeItem ? "text-primary" : "text-foreground"}`}>{item.dia}</p>
                          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{item.diaSemana.slice(0, 3)}</p>
                        </div>
                        <div className="w-px h-10 bg-border/60 shrink-0" />
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                            <Flag className="w-4 h-4" style={{ color: c.text }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                            <p className="text-xs font-medium" style={{ color: c.text }}>{tipoFeriadoLabel(item.feriadoTipo ?? "nacional")} · Feriado</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  // evento
                  const hex = getCorHex(item.eventoCor);
                  return (
                    <div key={`e-${item.eventoId}`} className={`flex items-center gap-4 px-5 py-3.5 ${isHojeItem ? "bg-primary/5" : "hover:bg-muted/20"} transition-colors group`}>
                      <div className="w-12 text-center shrink-0">
                        <p className={`text-2xl font-black leading-none ${isHojeItem ? "text-primary" : "text-foreground"}`}>{item.dia}</p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{item.diaSemana.slice(0, 3)}</p>
                      </div>
                      <div className="w-px h-10 bg-border/60 shrink-0" />
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-black" style={{ background: hex }}>
                          {item.eventoDiaInteiro ? <Calendar className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground truncate">{item.nome}</p>
                            {item.eventoLembrete && <Bell className="w-3 h-3 text-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.eventoDiaInteiro ? "Dia inteiro" : item.eventoHora}
                            {item.eventoDescricao && ` · ${item.eventoDescricao}`}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => item.eventoId !== undefined && setConfirmDelete(item.eventoId)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl border border-border/60 bg-card overflow-hidden"
            style={{ boxShadow: "0 2px 12px oklch(0.145 0.03 245 / 0.08)" }}
          >
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
              {DIAS_SEMANA_SHORT.map((d, i) => (
                <div
                  key={d}
                  className={`text-center text-xs font-bold py-3 tracking-wide uppercase ${i === 0 || i === 6 ? "text-muted-foreground/60" : "text-muted-foreground"}`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grade de dias */}
            <div className="grid grid-cols-7">
              {diasDoMes.map((dia, idx) => {
                if (dia === null) return (
                  <div key={`empty-${idx}`} className="min-h-[100px] border-r border-b border-border/30 bg-muted/5 last:border-r-0" />
                );
                const dataStr = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                const feriadosDia = feriadosPorData[dataStr] ?? [];
                const eventosDia = eventosPorData[dataStr] ?? [];
                const isHoje = dataStr === hojeStr;
                const diaSemana = new Date(anoAtual, mesAtual - 1, dia).getDay();
                const isWeekend = diaSemana === 0 || diaSemana === 6;
                const temFeriado = feriadosDia.length > 0;
                const colIdx = idx % 7;
                const isLastCol = colIdx === 6;

                return (
                  <div
                    key={dia}
                    className={`
                      min-h-[100px] border-b border-border/30 p-2 cursor-pointer transition-all duration-150 group relative
                      ${isLastCol ? "" : "border-r border-border/30"}
                      ${isHoje ? "bg-primary/5" : isWeekend ? "bg-muted/10" : temFeriado ? "bg-red-50/30" : "hover:bg-muted/20"}
                    `}
                    onClick={() => abrirDetalhe(dia)}
                  >
                    {/* Número do dia */}
                    <div className="flex items-start justify-between mb-1.5">
                      <div className={`
                        w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-colors
                        ${isHoje
                          ? "text-white font-black"
                          : isWeekend ? "text-muted-foreground/70" : "text-foreground"}
                      `}
                        style={isHoje ? { background: "oklch(0.20 0.08 252)" } : {}}
                      >
                        {dia}
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center hover:bg-primary/15 text-primary"
                        onClick={e => { e.stopPropagation(); abrirModalCriar(dia); }}
                        title="Adicionar evento"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Feriados */}
                    {feriadosDia.slice(0, 1).map((f, i) => {
                      const c = corFeriado(f.tipo);
                      return (
                        <div
                          key={i}
                          className="text-[10px] rounded-md px-1.5 py-0.5 mb-1 truncate leading-tight font-semibold"
                          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                        >
                          🏖 {f.nome}
                        </div>
                      );
                    })}
                    {feriadosDia.length > 1 && (
                      <div className="text-[9px] text-muted-foreground font-medium mb-0.5">+{feriadosDia.length - 1} feriado</div>
                    )}

                    {/* Eventos */}
                    {eventosDia.slice(0, 2).map(ev => {
                      const hex = getCorHex(ev.cor);
                      return (
                        <div
                          key={ev.id}
                          className="text-[10px] rounded-md px-1.5 py-0.5 mb-0.5 truncate leading-tight font-semibold text-white flex items-center gap-1"
                          style={{ background: hex }}
                        >
                          {!ev.diaInteiro && (
                            <span className="opacity-80 shrink-0">
                              {new Date(ev.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })}
                            </span>
                          )}
                          <span className="truncate">{ev.titulo}</span>
                          {ev.lembretesTaskUids && <Bell className="w-2.5 h-2.5 shrink-0 opacity-80" />}
                        </div>
                      );
                    })}
                    {eventosDia.length > 2 && (
                      <div className="text-[9px] text-primary font-bold">+{eventosDia.length - 2} mais</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        )}
          {/* Legenda */}
          <div className="flex flex-wrap gap-4 mt-3 px-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#fee2e2", border: "1px solid #fca5a5" }} />
              <span>Feriado Nacional</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#fef3c7", border: "1px solid #fcd34d" }} />
              <span>Feriado Bahia</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#d1fae5", border: "1px solid #6ee7b7" }} />
              <span>Feriado Salvador</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bell className="w-3 h-3" />
              <span>Lembretes ativos</span>
            </div>
          </div>
        </div>

        {/* ── Painel lateral ── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Botão novo evento */}
          <Button
            className="w-full gap-2 font-bold shadow-sm"
            style={{ background: "linear-gradient(135deg, oklch(0.20 0.08 252), oklch(0.28 0.012 240))" }}
            onClick={() => { setDiaClicado(new Date().getDate()); setModalOpen(true); }}
          >
            <Plus className="w-4 h-4" />
            Novo Evento
          </Button>

          {/* Próximos eventos */}
          <div
            className="rounded-xl border border-border/60 bg-card overflow-hidden"
            style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}
          >
            <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-sm font-bold text-foreground">Próximos Eventos</p>
            </div>
            {proximosEventos.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Calendar className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum evento futuro este mês</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {proximosEventos.map(ev => {
                  const hex = getCorHex(ev.cor);
                  const d = new Date(ev.dataHora);
                  const diaNum = d.toLocaleString("pt-BR", { day: "numeric", timeZone: "America/Bahia" });
                  const hora = ev.diaInteiro ? "Dia inteiro" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" });
                  return (
                    <div key={ev.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-black" style={{ background: hex }}>
                        {diaNum}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{ev.titulo}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {hora}
                          {ev.lembretesTaskUids && <><Bell className="w-3 h-3 text-primary ml-1" /><span className="text-primary">Lembrete</span></>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Feriados do mês */}
          <div
            className="rounded-xl border border-border/60 bg-card overflow-hidden"
            style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.06)" }}
          >
            <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                <Flag className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-foreground">Feriados do Mês</p>
            </div>
            {feriadosDoMes.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <p className="text-xs text-muted-foreground">Nenhum feriado este mês</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {feriadosDoMes.map((f, i) => {
                  const c = corFeriado(f.tipo);
                  const dia = parseInt(f.data.split("-")[2]);
                  return (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black"
                        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                      >
                        {dia}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{f.nome}</p>
                        <p className="text-[10px] font-medium" style={{ color: c.text }}>{tipoFeriadoLabel(f.tipo)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Localização */}
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">Salvador, Bahia</p>
              <p className="text-[10px] text-muted-foreground">Feriados municipais, estaduais e nacionais</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal de detalhe do dia ── */}
      <Dialog open={!!diaDetalhe} onOpenChange={v => { if (!v) setDiaDetalhe(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-white"
                style={{ background: "linear-gradient(135deg, oklch(0.20 0.08 252), oklch(0.28 0.012 240))" }}
              >
                <span className="text-lg font-black leading-none">{diaDetalhe?.dia}</span>
              </div>
              <div>
                <p className="text-base font-bold text-foreground">
                  {diaDetalhe && DIAS_SEMANA_FULL[new Date(anoAtual, mesAtual - 1, diaDetalhe.dia).getDay()]}
                </p>
                <p className="text-xs text-muted-foreground font-normal">
                  {diaDetalhe && `${diaDetalhe.dia} de ${MESES[mesAtual - 1]} de ${anoAtual}`}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {diaDetalhe && (
            <div className="space-y-4">
              {/* Feriados */}
              {(feriadosPorData[diaDetalhe.data] ?? []).length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Feriados</p>
                  <div className="space-y-1.5">
                    {(feriadosPorData[diaDetalhe.data] ?? []).map((f, i) => {
                      const c = corFeriado(f.tipo);
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                          style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                          <Flag className="w-4 h-4 shrink-0" style={{ color: c.text }} />
                          <div>
                            <p className="text-sm font-bold" style={{ color: c.text }}>{f.nome}</p>
                            <p className="text-xs opacity-70" style={{ color: c.text }}>{tipoFeriadoLabel(f.tipo)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Eventos */}
              {(eventosPorData[diaDetalhe.data] ?? []).length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Eventos</p>
                  <div className="space-y-2">
                    {(eventosPorData[diaDetalhe.data] ?? []).map(ev => {
                      const hex = getCorHex(ev.cor);
                      return (
                        <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-border/60 p-3 bg-card hover:bg-muted/20 transition-colors">
                          <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: hex }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground">{ev.titulo}</p>
                            {!ev.diaInteiro && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {new Date(ev.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bahia" })}
                              </p>
                            )}
                            {ev.descricao && <p className="text-xs text-muted-foreground mt-1">{ev.descricao}</p>}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {ev.lembretesTaskUids ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                                    <Bell className="w-3 h-3" /> Lembretes ativos
                                  </div>
                                  <Button variant="outline" size="sm" className="h-6 text-xs px-2 border-red-200 text-red-600 hover:bg-red-50"
                                    disabled={cancelarLembretesMutation.isPending}
                                    onClick={e => { e.stopPropagation(); cancelarLembretesMutation.mutate({ id: ev.id }); }}>
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" className="h-6 text-xs px-2 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                                  disabled={agendarLembretesMutation.isPending}
                                  onClick={e => { e.stopPropagation(); agendarLembretesMutation.mutate({ id: ev.id }); }}>
                                  <Bell className="w-3 h-3" /> Ativar lembretes
                                </Button>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500 hover:bg-red-50 shrink-0"
                            onClick={() => setConfirmDelete(ev.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(feriadosPorData[diaDetalhe.data] ?? []).length === 0 && (eventosPorData[diaDetalhe.data] ?? []).length === 0 && (
                <div className="text-center py-6">
                  <Calendar className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum evento ou feriado neste dia</p>
                </div>
              )}

              <Button className="w-full gap-2 font-semibold" style={{ background: "linear-gradient(135deg, oklch(0.20 0.08 252), oklch(0.28 0.012 240))" }}
                onClick={() => { setDiaDetalhe(null); abrirModalCriar(diaDetalhe.dia); }}>
                <Plus className="w-4 h-4" /> Adicionar evento neste dia
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal de criação de evento ── */}
      <Dialog open={modalOpen} onOpenChange={v => { if (!v) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: diaClicado ? getCorHex(form.cor) : "oklch(0.20 0.08 252)" }}
              >
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-base font-bold">Novo Evento</p>
                {diaClicado && (
                  <p className="text-xs text-muted-foreground font-normal">
                    {diaClicado} de {MESES[mesAtual - 1]} de {anoAtual}
                  </p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Título *</Label>
              <Input placeholder="Ex: Reunião de RH, Entrega de relatório..." value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })} autoFocus className="font-medium" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Descrição</Label>
              <Textarea placeholder="Detalhes do evento (opcional)" value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Dia inteiro</p>
                <p className="text-xs text-muted-foreground">Sem horário específico</p>
              </div>
              <Switch checked={form.diaInteiro} onCheckedChange={v => setForm({ ...form, diaInteiro: v })} id="dia-inteiro" />
            </div>

            {!form.diaInteiro && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Horário</Label>
                <Input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cor do evento</Label>
              <div className="flex flex-wrap gap-2">
                {CORES_EVENTO.map(c => (
                  <button key={c.valor} title={c.label} onClick={() => setForm({ ...form, cor: c.valor })}
                    className={`w-8 h-8 rounded-full transition-all duration-150 ${form.cor === c.valor ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                    style={{ background: c.hex }} />
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/15 p-3">
              <Bell className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lembretes automáticos por <strong>notificação</strong> e <strong>e-mail</strong> com 2 dias, 1 dia, 15h, 2h, 30min e 15min de antecedência.
                <span className="block mt-1 text-blue-600 font-medium">⚠ Ativados após publicação do sistema.</span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={criarEvento} disabled={!form.titulo.trim() || createMutation.isPending}
              className="gap-2 font-semibold" style={{ background: getCorHex(form.cor) }}>
              {createMutation.isPending ? "Salvando..." : <><Plus className="w-4 h-4" /> Criar Evento</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação de exclusão ── */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(v: boolean) => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento e todos os lembretes associados serão cancelados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDelete !== null && deleteMutation.mutate({ id: confirmDelete })}>
              {deleteMutation.isPending ? "Removendo..." : "Sim, remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
