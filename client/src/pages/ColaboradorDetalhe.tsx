import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Edit2, Save, X, Building2, UserX, UserCheck, Trash2,
  User, Phone, FileText, Briefcase, AlertTriangle, CalendarDays, MapPin, Baby
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { formatDate, toDateStr } from "@/lib/ferias";

const ESTADOS_CIVIS: Record<string, string> = {
  solteiro: "Solteiro(a)", casado: "Casado(a)", divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)", uniao_estavel: "União Estável", outro: "Outro",
};
const SEXOS: Record<string, string> = { masculino: "Masculino", feminino: "Feminino", outro: "Outro" };
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function maskCPF(val: string): string {
  const nums = val.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}
function maskRG(val: string): string {
  const nums = val.replace(/\D/g, "").slice(0, 10);
  if (nums.length <= 2) return nums;
  if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
  if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}-${nums.slice(8)}`;
}
function maskCTPS(val: string): { numero: string; serie: string } {
  // Remove tudo que não é alfanumérico
  const clean = val.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  // Separa dígitos iniciais (até 7) e sufixo alfanumérico
  const digitsMatch = clean.match(/^(\d{0,7})([A-Z0-9]*)/);
  const digits = digitsMatch ? digitsMatch[1] : "";
  const suffix = digitsMatch ? digitsMatch[2] : "";
  // Monta número formatado: NNNNNNN/SSSS-UF
  let numero = digits;
  let serie = "";
  if (suffix.length > 0) {
    // sufixo: primeiros 4 chars são a série numérica, últimos 2 são UF
    const serieNums = suffix.slice(0, 4);
    const uf = suffix.slice(4, 6);
    if (digits.length === 7) {
      numero = digits + "/" + serieNums;
      if (uf.length > 0) {
        numero = digits + "/" + serieNums + "-" + uf;
        serie = serieNums + "-" + uf;
      } else {
        serie = serieNums;
      }
    } else {
      numero = digits;
    }
  }
  return { numero, serie };
}
function maskCelular(val: string): string {
  const nums = val.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2) return nums.length ? `(${nums}` : "";
  if (nums.length <= 3) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2, 3)} ${nums.slice(3)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 3)} ${nums.slice(3, 7)}-${nums.slice(7)}`;
}
function maskTelefone(val: string): string {
  const nums = val.replace(/\D/g, "").slice(0, 10);
  if (nums.length <= 2) return nums.length ? `(${nums}` : "";
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
}
function calcularIdade(dataNascimento: string | null | undefined): string {
  if (!dataNascimento) return "—";
  const nasc = new Date(dataNascimento + "T12:00:00");
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return `${idade} anos`;
}
function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
const AVATAR_COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#6366f1","#14b8a6"];
const BANCOS_BR: { codigo: string; nome: string }[] = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "041", nome: "Banrisul" },
  { codigo: "077", nome: "Inter" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "121", nome: "Agibank" },
  { codigo: "197", nome: "Stone" },
  { codigo: "208", nome: "BTG Pactual" },
  { codigo: "212", nome: "Banco Original" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "260", nome: "Nubank" },
  { codigo: "290", nome: "PagBank" },
  { codigo: "318", nome: "BMG" },
  { codigo: "336", nome: "C6 Bank" },
  { codigo: "341", nome: "Itaú" },
  { codigo: "380", nome: "PicPay" },
  { codigo: "389", nome: "Mercantil do Brasil" },
  { codigo: "422", nome: "Safra" },
  { codigo: "633", nome: "Rendimento" },
  { codigo: "707", nome: "Daycoval" },
  { codigo: "735", nome: "Neon" },
  { codigo: "748", nome: "Sicredi" },
  { codigo: "756", nome: "Sicoob" },
  { codigo: "999", nome: "Outro" },
];

const TIPO_CHAVE_PIX_LABEL: Record<string, string> = {
  cpf: "CPF", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};

function avatarColor(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function InfoRow({ label, value, icon: Icon }: { label: string; value?: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      {Icon && (
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: "oklch(0.97 0.005 245)" }}>
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">
          {value || <span className="text-muted-foreground/40 font-normal">—</span>}
        </p>
      </div>
    </div>
  );
}

function SectionBlock({ title, icon: Icon, color, children, className }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border/60 overflow-hidden self-start${className ? " " + className : ""}`} style={{ boxShadow: "0 1px 4px oklch(0.145 0.03 245 / 0.05)" }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60" style={{ background: "oklch(0.975 0.004 245)" }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: color + "22" }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/70">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function ColaboradorDetalhe({ id }: { id: number }) {
  const utils = trpc.useUtils();
  const { data: colaborador, isLoading, isError, error, refetch } = trpc.colaboradores.byId.useQuery({ id }, { retry: 2 });
  const { data: empresas } = trpc.empresas.list.useQuery();
  const [setorEmpresaId, setSetorEmpresaId] = useState<number | undefined>(undefined);
  const { data: setores } = trpc.setores.list.useQuery(setorEmpresaId ? { empresaId: setorEmpresaId } : undefined);

  const updateMutation = trpc.colaboradores.update.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados com sucesso!");
      utils.colaboradores.byId.invalidate({ id });
      utils.dashboard.stats.invalidate();
      setEditingFicha(false);
    },
    onError: () => toast.error("Erro ao atualizar dados."),
  });
  const toggleStatusMutation = trpc.colaboradores.toggleStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.status === "inativo" ? "Colaborador inativado." : "Colaborador reativado.");
      utils.colaboradores.byId.invalidate({ id });
      utils.dashboard.stats.invalidate();
      utils.dashboard.statusPorEmpresa.invalidate();
      utils.dashboard.statusPorSetor.invalidate();
    },
    onError: () => toast.error("Erro ao alterar status."),
  });
  const [, navigate] = useLocation();
  const [confirmDesligar, setConfirmDesligar] = useState(false);
  const deleteMutation = trpc.colaboradores.delete.useMutation({
    onSuccess: () => {
      toast.success("Colaborador excluído. Histórico de VT/VR de meses anteriores preservado.");
      utils.colaboradores.list.invalidate();
      utils.dashboard.stats.invalidate();
      utils.dashboard.statusPorSetor.invalidate();
      utils.dashboard.statusPorEmpresa.invalidate();
      navigate("/colaboradores");
    },
    onError: () => toast.error("Erro ao excluir colaborador."),
  });

  const [editingFicha, setEditingFicha] = useState(false);
  const [fichaForm, setFichaForm] = useState<Record<string, any>>({});

  function startEditFicha() {
    if (!colaborador) return;
    const c = colaborador as any;
    setSetorEmpresaId(colaborador.empresaId ?? undefined);
    setFichaForm({
      nome: colaborador.nome ?? "",
      empresaId: colaborador.empresaId ? String(colaborador.empresaId) : "",
      setorId: colaborador.setorId ? String(colaborador.setorId) : "",
      admissao: toDateStr(colaborador.admissao as any) ?? "",
      dataNascimento: toDateStr(c.dataNascimento) ?? "",
      nacionalidade: c.nacionalidade ?? "",
      estadoCivil: c.estadoCivil ?? "",
      naturalidade: c.naturalidade ?? "",
      estado: c.estado ?? "",
      sexo: c.sexo ?? "",
      temFilhos: c.temFilhos ?? false,
      qtdFilhos: c.qtdFilhos ?? 0,
      idadeAdmissao: c.idadeAdmissao ?? "",
      rg: c.rg ?? "",
      cpf: c.cpf ?? "",
      telefone: c.telefone ?? "",
      celular: c.celular ?? "",
      emailCorporativo: c.emailCorporativo ?? "",
      cargo: c.cargo ?? "",
      contatoEmergenciaNome: c.contatoEmergenciaNome ?? "",
      contatoEmergenciaTelefone: c.contatoEmergenciaTelefone ?? "",
      // Filiação
      nomePai: c.nomePai ?? "",
      nomeMae: c.nomeMae ?? "",
      // RG - expedição
      rgExpedicao: toDateStr(c.rgExpedicao) ?? "",
      rgOrgaoExpedidor: c.rgOrgaoExpedidor ?? "",
      // Endereço
      enderecoLogradouro: c.enderecoLogradouro ?? "",
      enderecoNumero: c.enderecoNumero ?? "",
      enderecoComplemento: c.enderecoComplemento ?? "",
      enderecoBairro: c.enderecoBairro ?? "",
      enderecoCidade: c.enderecoCidade ?? "",
      enderecoEstado: c.enderecoEstado ?? "",
      enderecoCep: c.enderecoCep ?? "",
      // Título de Eleitor
      tituloEleitor: c.tituloEleitor ?? "",
      zonaEleitoral: c.zonaEleitoral ?? "",
      secaoEleitoral: c.secaoEleitoral ?? "",
      pis: c.pis ?? "",
      // Carteira de Trabalho
      ctpsDigital: c.ctpsDigital ?? false,
      ctpsNumero: c.ctpsNumero ?? "",
      ctpsSerie: c.ctpsSerie ?? "",
      // Dados Bancários
      bancoCodigo: c.bancoCodigo ?? "",
      bancoNome: c.bancoNome ?? "",
      bancoAgencia: c.bancoAgencia ?? "",
      bancoConta: c.bancoConta ?? "",
      bancoTipoConta: c.bancoTipoConta ?? "",
      bancoChavePix: c.bancoChavePix ?? "",
      bancoTipoChavePix: c.bancoTipoChavePix ?? "",
    });
    setEditingFicha(true);
  }

  function saveFicha() {
    updateMutation.mutate({
      id,
      nome: fichaForm.nome || undefined,
      empresaId: fichaForm.empresaId ? Number(fichaForm.empresaId) : undefined,
      setorId: fichaForm.setorId ? Number(fichaForm.setorId) : undefined,
      admissao: fichaForm.admissao || null,
      dataNascimento: fichaForm.dataNascimento || null,
      nacionalidade: fichaForm.nacionalidade || null,
      estadoCivil: fichaForm.estadoCivil || null,
      naturalidade: fichaForm.naturalidade || null,
      estado: fichaForm.estado || null,
      sexo: fichaForm.sexo || null,
      temFilhos: fichaForm.temFilhos,
      qtdFilhos: fichaForm.temFilhos ? Number(fichaForm.qtdFilhos) : 0,
      idadeAdmissao: fichaForm.idadeAdmissao ? Number(fichaForm.idadeAdmissao) : null,
      rg: fichaForm.rg || null,
      cpf: fichaForm.cpf || null,
      telefone: fichaForm.telefone || null,
      celular: fichaForm.celular || null,
      emailCorporativo: fichaForm.emailCorporativo || null,
      cargo: fichaForm.cargo || null,
      contatoEmergenciaNome: fichaForm.contatoEmergenciaNome || null,
      contatoEmergenciaTelefone: fichaForm.contatoEmergenciaTelefone || null,
      // Filiação
      nomePai: fichaForm.nomePai || null,
      nomeMae: fichaForm.nomeMae || null,
      // RG - expedição
      rgExpedicao: fichaForm.rgExpedicao || null,
      rgOrgaoExpedidor: fichaForm.rgOrgaoExpedidor || null,
      // Endereço
      enderecoLogradouro: fichaForm.enderecoLogradouro || null,
      enderecoNumero: fichaForm.enderecoNumero || null,
      enderecoComplemento: fichaForm.enderecoComplemento || null,
      enderecoBairro: fichaForm.enderecoBairro || null,
      enderecoCidade: fichaForm.enderecoCidade || null,
      enderecoEstado: fichaForm.enderecoEstado || null,
      enderecoCep: fichaForm.enderecoCep || null,
      // Título de Eleitor
      tituloEleitor: fichaForm.tituloEleitor || null,
      zonaEleitoral: fichaForm.zonaEleitoral || null,
      secaoEleitoral: fichaForm.secaoEleitoral || null,
      pis: fichaForm.pis || null,
      // Carteira de Trabalho
      ctpsDigital: fichaForm.ctpsDigital ?? null,
      ctpsNumero: fichaForm.ctpsNumero || null,
      ctpsSerie: fichaForm.ctpsSerie || null,
      // Dados Bancários
      bancoCodigo: fichaForm.bancoCodigo || null,
      bancoNome: fichaForm.bancoNome || null,
      bancoAgencia: fichaForm.bancoAgencia || null,
      bancoConta: fichaForm.bancoConta || null,
      bancoTipoConta: fichaForm.bancoTipoConta || null,
      bancoChavePix: fichaForm.bancoChavePix || null,
      bancoTipoChavePix: fichaForm.bancoTipoChavePix || null,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80 rounded-xl" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }
  if (isError) {
    const isDbError = error?.message?.includes('indispon') || error?.message?.includes('unavailable') || error?.message?.includes('INTERNAL_SERVER_ERROR');
    return (
      <div className="text-center py-20">
        {isDbError ? (
          <>
            <p className="text-muted-foreground font-medium">Servidor reiniciando...</p>
            <p className="text-sm text-muted-foreground/70 mt-1">O banco de dados está sendo inicializado. Aguarde alguns segundos.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => refetch()}>
              <span>↻</span> Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Colaborador não encontrado.</p>
            <Link href="/colaboradores"><Button variant="outline" className="mt-4">Voltar</Button></Link>
          </>
        )}
      </div>
    );
  }
  if (!colaborador) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Colaborador não encontrado.</p>
        <Link href="/colaboradores"><Button variant="outline" className="mt-4">Voltar</Button></Link>
      </div>
    );
  }

  const isInativo = colaborador.status === "inativo";
  const c = colaborador as any;
  const color = avatarColor(colaborador.nome);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center justify-between">
        <Link href="/colaboradores">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Colaboradores
          </Button>
        </Link>
        {/* Ações rápidas no topo */}
        <div className="flex items-center gap-2">
          {!editingFicha ? (
            <>
              {isInativo ? (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                    disabled={toggleStatusMutation.isPending}
                    onClick={() => toggleStatusMutation.mutate({ id, status: "ativo", dataDemissao: null })}>
                    <UserCheck className="w-4 h-4" /> Reativar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                    disabled={deleteMutation.isPending} onClick={() => setConfirmDesligar(true)}>
                    <Trash2 className="w-4 h-4" /> Desligar
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={startEditFicha} className="gap-1.5 shadow-sm">
                    <Edit2 className="w-4 h-4" /> Editar Ficha
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 border-orange-200 text-orange-600 hover:bg-orange-50"
                    disabled={toggleStatusMutation.isPending}
                    onClick={() => {
                      const data = prompt("Data de demissão (AAAA-MM-DD):");
                      if (data) toggleStatusMutation.mutate({ id, status: "inativo", dataDemissao: data });
                    }}>
                    <UserX className="w-4 h-4" /> Inativar
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <Button size="sm" onClick={saveFicha} disabled={updateMutation.isPending} className="gap-1.5 shadow-sm">
                <Save className="w-4 h-4" /> {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingFicha(false)} className="gap-1.5">
                <X className="w-4 h-4" /> Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Hero Banner ── */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: `linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)`,
        border: "1px solid oklch(0.25 0.09 252)",
        boxShadow: "0 4px 24px oklch(0.12 0.015 240 / 0.18)"
      }}>
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
        <div className="px-6 py-5 flex items-center gap-5 flex-wrap">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `0 4px 16px ${color}44` }}>
            {getInitials(colaborador.nome)}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-black text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                {colaborador.nome}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isInativo
                  ? "bg-zinc-700/60 text-zinc-300 border border-zinc-600"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isInativo ? "bg-zinc-400" : "bg-emerald-400"}`} />
                {isInativo ? "Inativo" : "Ativo"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {colaborador.empresaNome && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: "oklch(0.65 0.008 240)" }}>
                  <Building2 className="w-3.5 h-3.5" />
                  {colaborador.empresaNome}
                </span>
              )}
              {colaborador.setorNome && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: "oklch(0.65 0.008 240)" }}>
                  <span style={{ color: "oklch(0.4 0.008 240)" }}>·</span>
                  {colaborador.setorNome}
                </span>
              )}
              {c.cargo && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: "oklch(0.65 0.008 240)" }}>
                  <span style={{ color: "oklch(0.4 0.008 240)" }}>·</span>
                  <Briefcase className="w-3.5 h-3.5" />
                  {c.cargo}
                </span>
              )}
              {colaborador.admissao && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: "oklch(0.65 0.008 240)" }}>
                  <span style={{ color: "oklch(0.4 0.008 240)" }}>·</span>
                  <CalendarDays className="w-3.5 h-3.5" />
                  Admissão: {formatDate(colaborador.admissao as any)}
                </span>
              )}
            </div>
            {isInativo && colaborador.dataDemissao && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)" }}>
                <UserX className="w-3.5 h-3.5" />
                Inativado em {formatDate(colaborador.dataDemissao as any)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Layout Principal: 3 colunas no desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* ── Coluna Esquerda: Dados Pessoais + Documentos ── */}
        <div className="space-y-4">
          {/* Dados Pessoais */}
          <SectionBlock title="Dados Pessoais" icon={User} color="#8b5cf6">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="Data de Nascimento">
                  <Input type="date" className="h-8 text-sm" value={fichaForm.dataNascimento} onChange={e => setFichaForm({ ...fichaForm, dataNascimento: e.target.value })} />
                </EditField>
                <EditField label="Sexo">
                  <Select value={fichaForm.sexo || ""} onValueChange={v => setFichaForm({ ...fichaForm, sexo: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </EditField>
                <EditField label="Estado Civil">
                  <Select value={fichaForm.estadoCivil || ""} onValueChange={v => setFichaForm({ ...fichaForm, estadoCivil: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ESTADOS_CIVIS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </EditField>
                <EditField label="Tem Filhos?">
                  <Select value={fichaForm.temFilhos ? "sim" : "nao"} onValueChange={v => setFichaForm({ ...fichaForm, temFilhos: v === "sim", qtdFilhos: v === "nao" ? 0 : fichaForm.qtdFilhos })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </EditField>
                {fichaForm.temFilhos && (
                  <EditField label="Qtd. de Filhos">
                    <Input type="number" min={1} className="h-8 text-sm" value={fichaForm.qtdFilhos} onChange={e => setFichaForm({ ...fichaForm, qtdFilhos: e.target.value })} />
                  </EditField>
                )}
                <EditField label="Idade na Admissão">
                  <Input type="number" min={14} max={80} className="h-8 text-sm" value={fichaForm.idadeAdmissao} onChange={e => setFichaForm({ ...fichaForm, idadeAdmissao: e.target.value })} placeholder="Ex: 25" />
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="Data de Nascimento" value={formatDate(c.dataNascimento)} icon={CalendarDays} />
                <InfoRow label="Idade" value={calcularIdade(toDateStr(c.dataNascimento))} icon={User} />
                <InfoRow label="Sexo" value={c.sexo ? SEXOS[c.sexo] : null} icon={User} />
                <InfoRow label="Estado Civil" value={c.estadoCivil ? ESTADOS_CIVIS[c.estadoCivil] : null} icon={User} />
                <InfoRow label="Filhos" value={c.temFilhos ? `Sim — ${c.qtdFilhos ?? 0} filho(s)` : "Não"} icon={Baby} />
                <InfoRow label="Idade na Admissão" value={c.idadeAdmissao != null ? `${c.idadeAdmissao} anos` : undefined} icon={User} />
              </div>
            )}
          </SectionBlock>

          {/* Documentos */}
          <SectionBlock title="Documentos" icon={FileText} color="#f59e0b">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="CPF">
                  <Input className="h-8 text-sm" value={fichaForm.cpf} onChange={e => setFichaForm({ ...fichaForm, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} />
                </EditField>
                <EditField label="RG">
                  <Input className="h-8 text-sm" value={fichaForm.rg} onChange={e => setFichaForm({ ...fichaForm, rg: maskRG(e.target.value) })} placeholder="00.000.000-00" maxLength={13} />
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="CPF" value={c.cpf} icon={FileText} />
                <InfoRow label="RG" value={c.rg} icon={FileText} />
              </div>
            )}
          </SectionBlock>
        </div>

        {/* ── Coluna Central: Perfil + Admissão + Contato ── */}
        <div className="space-y-4">
          {/* Perfil (empresa/setor/cargo) */}
          <SectionBlock title="Perfil Profissional" icon={Building2} color="#3b82f6">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="Nome">
                  <Input className="h-8 text-sm" value={fichaForm.nome} onChange={e => setFichaForm({ ...fichaForm, nome: e.target.value })} />
                </EditField>
                <EditField label="Empresa">
                  <Select value={fichaForm.empresaId || ""} onValueChange={v => { setFichaForm({ ...fichaForm, empresaId: v, setorId: "" }); setSetorEmpresaId(v ? Number(v) : undefined); }}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{empresas?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </EditField>
                <EditField label="Setor">
                  <Select value={fichaForm.setorId || ""} onValueChange={v => setFichaForm({ ...fichaForm, setorId: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{setores?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </EditField>
                <EditField label="Cargo">
                  <Input className="h-8 text-sm" value={fichaForm.cargo} onChange={e => setFichaForm({ ...fichaForm, cargo: e.target.value })} placeholder="Ex: Analista de RH" />
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="Empresa" value={colaborador.empresaNome} icon={Building2} />
                <InfoRow label="Setor" value={colaborador.setorNome} icon={Briefcase} />
                <InfoRow label="Cargo" value={c.cargo} icon={Briefcase} />
              </div>
            )}
          </SectionBlock>

          {/* Admissão */}
          <SectionBlock title="Admissão" icon={CalendarDays} color="#10b981">
            {editingFicha ? (
              <EditField label="Data de Admissão">
                <Input type="date" className="h-8 text-sm" value={fichaForm.admissao} onChange={e => setFichaForm({ ...fichaForm, admissao: e.target.value })} />
              </EditField>
            ) : (
              <InfoRow label="Data de Admissão" value={formatDate(colaborador.admissao as any)} icon={CalendarDays} />
            )}
          </SectionBlock>

          {/* Contato */}
          <SectionBlock title="Contato" icon={Phone} color="#06b6d4">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="Telefone">
                  <Input className="h-8 text-sm" value={fichaForm.telefone} onChange={e => setFichaForm({ ...fichaForm, telefone: maskTelefone(e.target.value) })} placeholder="(71) 3177-0000" maxLength={14} />
                </EditField>
                <EditField label="Celular">
                  <Input className="h-8 text-sm" value={fichaForm.celular} onChange={e => setFichaForm({ ...fichaForm, celular: maskCelular(e.target.value) })} placeholder="(71) 9 8177-0000" maxLength={16} />
                </EditField>
                <EditField label="E-mail Corporativo">
                  <Input type="email" className="h-8 text-sm" value={fichaForm.emailCorporativo} onChange={e => setFichaForm({ ...fichaForm, emailCorporativo: e.target.value })} placeholder="nome@empresa.com.br" />
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="Telefone" value={c.telefone} icon={Phone} />
                <InfoRow label="Celular" value={c.celular} icon={Phone} />
                <InfoRow label="E-mail Corporativo" value={c.emailCorporativo} icon={Phone} />
              </div>
            )}
          </SectionBlock>
        </div>

        {/* ── Coluna Direita: Naturalidade + Emergência ── */}
        <div className="space-y-4">
          {/* Naturalidade */}
          <SectionBlock title="Naturalidade" icon={MapPin} color="#14b8a6">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="Nacionalidade">
                  <Input className="h-8 text-sm" value={fichaForm.nacionalidade} onChange={e => setFichaForm({ ...fichaForm, nacionalidade: e.target.value })} placeholder="Ex: Brasileira" />
                </EditField>
                <EditField label="Naturalidade (Cidade)">
                  <Input className="h-8 text-sm" value={fichaForm.naturalidade} onChange={e => setFichaForm({ ...fichaForm, naturalidade: e.target.value })} placeholder="Ex: Salvador" />
                </EditField>
                <EditField label="Estado (UF)">
                  <Select value={fichaForm.estado || ""} onValueChange={v => setFichaForm({ ...fichaForm, estado: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                  </Select>
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="Nacionalidade" value={c.nacionalidade} icon={MapPin} />
                <InfoRow label="Naturalidade" value={c.naturalidade} icon={MapPin} />
                <InfoRow label="Estado (UF)" value={c.estado} icon={MapPin} />
              </div>
            )}
          </SectionBlock>

          {/* Contato de Emergência */}
          <SectionBlock title="Contato de Emergência" icon={AlertTriangle} color="#ef4444">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="Nome do Contato">
                  <Input className="h-8 text-sm" value={fichaForm.contatoEmergenciaNome} onChange={e => setFichaForm({ ...fichaForm, contatoEmergenciaNome: e.target.value })} placeholder="Nome completo" />
                </EditField>
                <EditField label="Telefone do Contato">
                  <Input className="h-8 text-sm" value={fichaForm.contatoEmergenciaTelefone} onChange={e => setFichaForm({ ...fichaForm, contatoEmergenciaTelefone: maskCelular(e.target.value) })} placeholder="(71) 9 8177-0000" maxLength={16} />
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="Nome do Contato" value={c.contatoEmergenciaNome} icon={AlertTriangle} />
                <InfoRow label="Telefone do Contato" value={c.contatoEmergenciaTelefone} icon={Phone} />
              </div>
            )}
          </SectionBlock>

          {/* Filiação */}
          <SectionBlock title="Filiação" icon={User} color="#8b5cf6">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="Nome do Pai">
                  <Input className="h-8 text-sm" value={fichaForm.nomePai} onChange={e => setFichaForm({ ...fichaForm, nomePai: e.target.value })} placeholder="Nome completo do pai" />
                </EditField>
                <EditField label="Nome da Mãe">
                  <Input className="h-8 text-sm" value={fichaForm.nomeMae} onChange={e => setFichaForm({ ...fichaForm, nomeMae: e.target.value })} placeholder="Nome completo da mãe" />
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="Nome do Pai" value={c.nomePai} icon={User} />
                <InfoRow label="Nome da Mãe" value={c.nomeMae} icon={User} />
              </div>
            )}
          </SectionBlock>
        </div>
      </div>

      {/* ── Linha 2: Documentos de Identidade (CTPS + Título Eleitor + PIS + RG Expedição) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Carteira de Trabalho */}
        <SectionBlock title="Carteira de Trabalho" icon={Briefcase} color="#10b981">
          {editingFicha ? (
            <div className="space-y-3">
              <EditField label="Tipo">
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="ctpsDigital" checked={!fichaForm.ctpsDigital} onChange={() => setFichaForm({ ...fichaForm, ctpsDigital: false, ctpsSerie: fichaForm.ctpsSerie })} className="accent-primary" />
                    <span className="text-sm">Física</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="ctpsDigital" checked={!!fichaForm.ctpsDigital} onChange={() => setFichaForm({ ...fichaForm, ctpsDigital: true, ctpsSerie: "" })} className="accent-primary" />
                    <span className="text-sm">Digital</span>
                  </label>
                </div>
              </EditField>
              {fichaForm.ctpsDigital ? (
                <EditField label="Número CTPS Digital (CPF)">
                  <Input className="h-8 text-sm" value={fichaForm.ctpsNumero} onChange={e => setFichaForm({ ...fichaForm, ctpsNumero: maskCPF(e.target.value) })} placeholder="XXX.XXX.XXX-XX" maxLength={14} />
                </EditField>
              ) : (
                <>
                  <EditField label="Número da CTPS">
                    <Input
                      className="h-8 text-sm"
                      value={fichaForm.ctpsNumero}
                      onChange={e => {
                        const { numero, serie } = maskCTPS(e.target.value);
                        setFichaForm({ ...fichaForm, ctpsNumero: numero, ctpsSerie: serie || fichaForm.ctpsSerie });
                      }}
                      placeholder="Ex: 7043433/0040-BA"
                      maxLength={20}
                    />
                  </EditField>
                  <EditField label="Série (preenchida automaticamente)">
                    <Input className="h-8 text-sm" value={fichaForm.ctpsSerie} onChange={e => setFichaForm({ ...fichaForm, ctpsSerie: e.target.value })} placeholder="Ex: 0040-BA" maxLength={15} />
                  </EditField>
                </>
              )}
            </div>
          ) : (
            <div>
              <InfoRow label="Tipo" value={c.ctpsDigital == null ? undefined : c.ctpsDigital ? "Digital" : "Física"} icon={Briefcase} />
              <InfoRow label={c.ctpsDigital ? "Número CTPS Digital (CPF)" : "Número da CTPS"} value={c.ctpsNumero} icon={FileText} />
              {!c.ctpsDigital && <InfoRow label="Série" value={c.ctpsSerie} icon={FileText} />}
            </div>
          )}
        </SectionBlock>

        {/* Título de Eleitor */}
        <SectionBlock title="Título de Eleitor" icon={FileText} color="#3b82f6">
          {editingFicha ? (
            <div className="space-y-3">
              <EditField label="Número do Título">
                <Input className="h-8 text-sm" value={fichaForm.tituloEleitor} onChange={e => setFichaForm({ ...fichaForm, tituloEleitor: e.target.value.replace(/\D/g, "").slice(0, 12) })} placeholder="Ex: 000000000000" maxLength={12} />
              </EditField>
              <div className="grid grid-cols-2 gap-2">
                <EditField label="Zona">
                  <Input className="h-8 text-sm" value={fichaForm.zonaEleitoral ?? ""} onChange={e => setFichaForm({ ...fichaForm, zonaEleitoral: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Ex: 001" maxLength={4} />
                </EditField>
                <EditField label="Seção">
                  <Input className="h-8 text-sm" value={fichaForm.secaoEleitoral ?? ""} onChange={e => setFichaForm({ ...fichaForm, secaoEleitoral: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Ex: 0001" maxLength={4} />
                </EditField>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label="Número do Título" value={c.tituloEleitor} icon={FileText} />
              <InfoRow label="Zona" value={c.zonaEleitoral} icon={FileText} />
              <InfoRow label="Seção" value={c.secaoEleitoral} icon={FileText} />
            </div>
          )}
        </SectionBlock>
        {/* Coluna 3: PIS + Expedição RG empilhados */}
        <div className="space-y-4">
          {/* PIS */}
          <SectionBlock title="PIS" icon={FileText} color="#10b981">
            {editingFicha ? (
              <EditField label="Número do PIS">
                <Input
                  className="h-8 text-sm"
                  value={fichaForm.pis ?? ""}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                    let masked = raw;
                    if (raw.length > 3) masked = raw.slice(0, 3) + "." + raw.slice(3);
                    if (raw.length > 8) masked = raw.slice(0, 3) + "." + raw.slice(3, 8) + "." + raw.slice(8);
                    if (raw.length > 10) masked = raw.slice(0, 3) + "." + raw.slice(3, 8) + "." + raw.slice(8, 10) + "-" + raw.slice(10);
                    setFichaForm({ ...fichaForm, pis: masked });
                  }}
                  placeholder="Ex: 000.00000.00-0"
                  maxLength={16}
                />
              </EditField>
            ) : (
              <InfoRow label="Número do PIS" value={c.pis} icon={FileText} />
            )}
          </SectionBlock>
          {/* Expedição do RG */}
          <SectionBlock title="Expedição do RG" icon={FileText} color="#f59e0b">
            {editingFicha ? (
              <div className="space-y-3">
                <EditField label="Data de Expedição">
                  <Input type="date" className="h-8 text-sm" value={fichaForm.rgExpedicao} onChange={e => setFichaForm({ ...fichaForm, rgExpedicao: e.target.value })} />
                </EditField>
                <EditField label="Órgão Expedidor">
                  <Input className="h-8 text-sm" value={fichaForm.rgOrgaoExpedidor} onChange={e => setFichaForm({ ...fichaForm, rgOrgaoExpedidor: e.target.value.toUpperCase() })} placeholder="Ex: SSP/BA" maxLength={20} />
                </EditField>
              </div>
            ) : (
              <div>
                <InfoRow label="Data de Expedição" value={formatDate(c.rgExpedicao)} icon={CalendarDays} />
                <InfoRow label="Órgão Expedidor" value={c.rgOrgaoExpedidor} icon={FileText} />
              </div>
            )}
          </SectionBlock>
        </div>
      </div>
      {/* ── Linha 3: Endereço ── */}
      <SectionBlock title="Endereço" icon={MapPin} color="#06b6d4">
        {editingFicha ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <EditField label="Logradouro">
                <Input className="h-8 text-sm" value={fichaForm.enderecoLogradouro} onChange={e => setFichaForm({ ...fichaForm, enderecoLogradouro: e.target.value })} placeholder="Rua, Avenida, Travessa..." />
              </EditField>
            </div>
            <EditField label="Número">
              <Input className="h-8 text-sm" value={fichaForm.enderecoNumero} onChange={e => setFichaForm({ ...fichaForm, enderecoNumero: e.target.value })} placeholder="Ex: 123" maxLength={10} />
            </EditField>
            <EditField label="Complemento">
              <Input className="h-8 text-sm" value={fichaForm.enderecoComplemento} onChange={e => setFichaForm({ ...fichaForm, enderecoComplemento: e.target.value })} placeholder="Apto, Bloco..." maxLength={60} />
            </EditField>
            <EditField label="Bairro">
              <Input className="h-8 text-sm" value={fichaForm.enderecoBairro} onChange={e => setFichaForm({ ...fichaForm, enderecoBairro: e.target.value })} placeholder="Bairro" />
            </EditField>
            <EditField label="Cidade">
              <Input className="h-8 text-sm" value={fichaForm.enderecoCidade} onChange={e => setFichaForm({ ...fichaForm, enderecoCidade: e.target.value })} placeholder="Cidade" />
            </EditField>
            <EditField label="Estado (UF)">
              <Select value={fichaForm.enderecoEstado || ""} onValueChange={v => setFichaForm({ ...fichaForm, enderecoEstado: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </EditField>
            <EditField label="CEP">
              <Input className="h-8 text-sm" value={fichaForm.enderecoCep} onChange={e => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                setFichaForm({ ...fichaForm, enderecoCep: v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v });
              }} placeholder="00000-000" maxLength={9} />
            </EditField>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
            <InfoRow label="Logradouro" value={c.enderecoLogradouro} icon={MapPin} />
            <InfoRow label="Número" value={c.enderecoNumero} icon={MapPin} />
            <InfoRow label="Complemento" value={c.enderecoComplemento} icon={MapPin} />
            <InfoRow label="Bairro" value={c.enderecoBairro} icon={MapPin} />
            <InfoRow label="Cidade" value={c.enderecoCidade} icon={MapPin} />
            <InfoRow label="Estado" value={c.enderecoEstado} icon={MapPin} />
            <InfoRow label="CEP" value={c.enderecoCep} icon={MapPin} />
          </div>
        )}
      </SectionBlock>

      {/* ── Linha 4: Dados Bancários ── */}
      <SectionBlock title="Dados Bancários" icon={Briefcase} color="#10b981">
        {editingFicha ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Banco */}
            <div className="sm:col-span-2">
              <EditField label="Banco">
                <Select value={fichaForm.bancoCodigo || ""} onValueChange={v => {
                  const banco = BANCOS_BR.find(b => b.codigo === v);
                  setFichaForm({ ...fichaForm, bancoCodigo: v, bancoNome: banco?.nome ?? "" });
                }}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {BANCOS_BR.map(b => (
                      <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} – {b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditField>
            </div>
            <EditField label="Tipo de Conta">
              <Select value={fichaForm.bancoTipoConta || ""} onValueChange={v => setFichaForm({ ...fichaForm, bancoTipoConta: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Conta Corrente</SelectItem>
                  <SelectItem value="poupanca">Conta Poupança</SelectItem>
                </SelectContent>
              </Select>
            </EditField>
            <EditField label="Agência (com DV)">
              <Input className="h-8 text-sm" value={fichaForm.bancoAgencia} onChange={e => {
                const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 5);
                setFichaForm({ ...fichaForm, bancoAgencia: v.length > 4 ? `${v.slice(0,4)}-${v.slice(4)}` : v });
              }} placeholder="Ex: 1234-5" maxLength={6} />
            </EditField>
            <EditField label="Conta (com DV)">
              <Input className="h-8 text-sm" value={fichaForm.bancoConta} onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 12);
                setFichaForm({ ...fichaForm, bancoConta: raw.length > 1 ? `${raw.slice(0,-1)}-${raw.slice(-1)}` : raw });
              }} placeholder="Ex: 12345-6" maxLength={14} />
            </EditField>
            {/* Chave PIX */}
            <EditField label="Tipo de Chave PIX">
              <Select value={fichaForm.bancoTipoChavePix || ""} onValueChange={v => setFichaForm({ ...fichaForm, bancoTipoChavePix: v, bancoChavePix: "" })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tipo de chave" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  <SelectItem value="nao_tem">Não possui PIX</SelectItem>
                </SelectContent>
              </Select>
            </EditField>
            {fichaForm.bancoTipoChavePix && fichaForm.bancoTipoChavePix !== "nao_tem" && (
              <EditField label="Chave PIX">
                <Input className="h-8 text-sm" value={fichaForm.bancoChavePix} onChange={e => setFichaForm({ ...fichaForm, bancoChavePix: e.target.value })} placeholder={
                  fichaForm.bancoTipoChavePix === "cpf" ? "000.000.000-00" :
                  fichaForm.bancoTipoChavePix === "email" ? "email@exemplo.com" :
                  fichaForm.bancoTipoChavePix === "telefone" ? "(00) 9 0000-0000" :
                  "Chave aleatória"
                } maxLength={150} />
              </EditField>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
            <InfoRow label="Banco" value={c.bancoCodigo && c.bancoNome ? `${c.bancoCodigo} – ${c.bancoNome}` : c.bancoNome || c.bancoCodigo} icon={Briefcase} />
            <InfoRow label="Tipo de Conta" value={c.bancoTipoConta === "corrente" ? "Conta Corrente" : c.bancoTipoConta === "poupanca" ? "Conta Poupança" : c.bancoTipoConta} icon={Briefcase} />
            <InfoRow label="Agência" value={c.bancoAgencia} icon={Briefcase} />
            <InfoRow label="Conta" value={c.bancoConta} icon={Briefcase} />
            <InfoRow label="Chave PIX" value={
              c.bancoTipoChavePix === "nao_tem" ? "Não possui PIX" :
              c.bancoChavePix ? `${TIPO_CHAVE_PIX_LABEL[c.bancoTipoChavePix as string] ?? c.bancoTipoChavePix}: ${c.bancoChavePix}` : undefined
            } icon={Briefcase} />
          </div>
        )}
      </SectionBlock>

      {/* ── Dialog de confirmação de desligamento ── */}
      <AlertDialog open={confirmDesligar} onOpenChange={setConfirmDesligar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" /> Desligar colaborador permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Você está prestes a <strong>excluir permanentemente</strong> o colaborador{" "}
                <strong>{colaborador.nome}</strong> e <strong>todos os registros de férias</strong> associados.
              </span>
              <span className="block text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteMutation.mutate({ id })}>
              {deleteMutation.isPending ? "Desligando..." : "Sim, desligar e apagar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
