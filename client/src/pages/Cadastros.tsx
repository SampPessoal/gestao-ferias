import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useSystemAuth } from "@/hooks/useSystemAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  UserPlus, Shield, User, RefreshCw, Trash2,
  ToggleLeft, ToggleRight, Copy, Pencil, KeyRound,
  CheckCircle2, Mail, Lock, AlertTriangle, Users,
} from "lucide-react";

type FormState = {
  nome: string;
  email: string;
  role: "admin" | "usuario";
};

type EditModalState = {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "usuario";
  ativo: boolean;
};

export default function Cadastros() {
  const { isAdmin } = useSystemAuth();
  const utils = trpc.useUtils();

  const { data: usuarios = [], isLoading } = trpc.systemUsers.list.useQuery();

  const [modalNovo, setModalNovo] = useState(false);
  const [formNovo, setFormNovo] = useState<FormState>({ nome: "", email: "", role: "usuario" });
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  const [editando, setEditando] = useState<EditModalState | null>(null);
  const [formEdit, setFormEdit] = useState({ nome: "", email: "", role: "usuario" as "admin" | "usuario" });

  const [deletandoId, setDeletandoId] = useState<number | null>(null);
  const [novaSenhaInfo, setNovaSenhaInfo] = useState<{ nome: string; senha: string } | null>(null);
  const pendingResetNome = useRef<string>("");

  const invalidar = () => utils.systemUsers.list.invalidate();
  const fecharEditar = () => setEditando(null);

  const createMutation = trpc.systemUsers.create.useMutation({
    onSuccess: (data) => { setSenhaGerada(data.senhaGerada); invalidar(); },
    onError: (err) => toast.error(err.message || "Erro ao criar usuário."),
  });

  const updateMutation = trpc.systemUsers.update.useMutation({
    onSuccess: () => { toast.success("Dados atualizados com sucesso."); invalidar(); fecharEditar(); },
    onError: (err) => toast.error(err.message || "Erro ao atualizar usuário."),
  });

  const resetPasswordMutation = trpc.systemUsers.resetPassword.useMutation({
    onSuccess: (data) => {
      const nomeCapturado = pendingResetNome.current;
      fecharEditar();
      setTimeout(() => {
        setNovaSenhaInfo({ nome: nomeCapturado || "Usuário", senha: data.novaSenha });
        navigator.clipboard.writeText(data.novaSenha).catch(() => {});
      }, 150);
      invalidar();
    },
    onError: (err) => toast.error(err.message || "Erro ao redefinir senha."),
  });

  const deleteMutation = trpc.systemUsers.delete.useMutation({
    onSuccess: () => { toast.success("Usuário removido."); setDeletandoId(null); invalidar(); },
    onError: (err) => toast.error(err.message || "Erro ao remover usuário."),
  });

  const resetMutation = trpc.systemUsers.resetPassword.useMutation({
    onSuccess: (data, vars) => {
      const u = usuarios.find(u => u.id === vars.id);
      setNovaSenhaInfo({ nome: u?.nome ?? "Usuário", senha: data.novaSenha });
      invalidar();
    },
    onError: (err) => toast.error(err.message || "Erro ao resetar senha."),
  });

  const toggleAtivo = (u: typeof usuarios[0]) => updateMutation.mutate({ id: u.id, ativo: !u.ativo });
  const copiar = (texto: string) => navigator.clipboard.writeText(texto).then(() => toast.success("Copiado!"));

  const abrirEditar = (u: typeof usuarios[0]) => {
    setEditando({ id: u.id, nome: u.nome, email: u.email, role: u.role, ativo: u.ativo });
    setFormEdit({ nome: u.nome, email: u.email, role: u.role });
  };

  const salvarPerfil = () => {
    if (!editando) return;
    if (!formEdit.nome.trim()) { toast.error("Informe o nome completo."); return; }
    if (!formEdit.email.trim()) { toast.error("Informe o e-mail."); return; }
    updateMutation.mutate({ id: editando.id, nome: formEdit.nome, email: formEdit.email, role: formEdit.role });
  };

  const salvarSenha = () => {
    if (!editando) return;
    pendingResetNome.current = editando.nome;
    resetPasswordMutation.mutate({ id: editando.id });
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-muted-foreground opacity-40" />
        </div>
        <p className="text-lg font-semibold text-foreground">Acesso restrito</p>
        <p className="text-sm text-muted-foreground mt-1">Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  const totalAtivos = usuarios.filter(u => u.ativo).length;
  const totalAdmins = usuarios.filter(u => u.role === "admin").length;

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d1f3c 60%, #0f172a 100%)", minHeight: 140 }}>
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 15% 50%, #3b82f6 0%, transparent 45%), radial-gradient(circle at 85% 20%, #6366f1 0%, transparent 40%)" }} />
        <div className="relative px-7 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
              <Users className="w-7 h-7" style={{ color: "#60a5fa" }} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}>Cadastros</h1>
              <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Gerencie os usuários com acesso ao sistema</p>
            </div>
          </div>
          <Button
            onClick={() => { setFormNovo({ nome: "", email: "", role: "usuario" }); setSenhaGerada(null); setModalNovo(true); }}
            className="gap-2 shrink-0 font-bold"
            style={{ background: "#3b82f6", color: "#fff" }}
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* ── Cards de resumo ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Total de Usuários", value: usuarios.length, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
          { icon: Shield, label: "Administradores", value: totalAdmins, color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
          { icon: CheckCircle2, label: "Usuários Ativos", value: totalAtivos, color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
        ].map((item, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border/60 p-5" style={{ boxShadow: "0 1px 8px oklch(0.145 0.03 245 / 0.06)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
            </div>
            <p className="text-3xl font-black" style={{ color: item.color, fontFamily: "var(--font-display)" }}>{item.value}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabela de Usuários ──────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px oklch(0.145 0.03 245 / 0.07)" }}>
        {/* Header da tabela */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center gap-3" style={{ background: "oklch(0.97 0.005 245)" }}>
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Usuários do Sistema</h2>
            <p className="text-xs text-muted-foreground">{usuarios.length} {usuarios.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-foreground">Usuário</TableHead>
                <TableHead className="font-semibold text-foreground">E-mail</TableHead>
                <TableHead className="font-semibold text-foreground">Perfil</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                      <span className="text-sm">Carregando usuários...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-10 h-10 opacity-20" />
                      <span className="text-sm">Nenhum usuário cadastrado.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((u, idx) => {
                  const iniciais = u.nome.split(" ").slice(0, 2).map(n => n[0]?.toUpperCase()).join("");
                  return (
                    <TableRow
                      key={u.id}
                      className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""} ${!u.ativo ? "opacity-50" : ""}`}
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: u.role === "admin" ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "linear-gradient(135deg, #64748b, #475569)" }}>
                            {iniciais}
                          </div>
                          <span className="font-semibold text-sm text-foreground">{u.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground text-sm">{u.email}</TableCell>
                      <TableCell className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          u.role === "admin"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-slate-50 text-slate-600 border-slate-100"
                        }`}>
                          {u.role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {u.role === "admin" ? "Administrador" : "Usuário"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          u.ativo
                            ? "bg-green-50 text-green-700 border-green-100"
                            : "bg-red-50 text-red-600 border-red-100"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.ativo ? "bg-green-500" : "bg-red-500"}`} />
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)} className="h-8 px-2 text-xs gap-1 hover:bg-blue-50 hover:text-blue-700" title="Editar usuário">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleAtivo(u)} className="h-8 px-2 text-xs hover:bg-blue-50" title={u.ativo ? "Inativar" : "Reativar"}>
                            {u.ativo ? <ToggleRight className="w-4 h-4 text-blue-600" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => resetMutation.mutate({ id: u.id })} className="h-8 px-2 text-xs hover:bg-blue-50" title="Resetar senha">
                            <RefreshCw className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeletandoId(u.id)} className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-red-50" title="Remover">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ===== Modal Editar Usuário ===== */}
      <Dialog open={!!editando} onOpenChange={(open) => { if (!open) fecharEditar(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Pencil className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-base">Editar Usuário</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{editando?.nome}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Nome completo</Label>
                <Input placeholder="Ex: Maria Silva" value={formEdit.nome} onChange={(e) => setFormEdit(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">E-mail</Label>
                <Input type="email" placeholder="usuario@email.com" value={formEdit.email} onChange={(e) => setFormEdit(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Perfil de acesso</Label>
                <Select value={formEdit.role} onValueChange={(v) => setFormEdit(f => ({ ...f, role: v as "admin" | "usuario" }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usuario">Usuário — lançamentos e consultas</SelectItem>
                    <SelectItem value="admin">Administrador — acesso total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full gap-2" onClick={salvarPerfil} disabled={updateMutation.isPending}>
                <CheckCircle2 className="w-4 h-4" />
                {updateMutation.isPending ? "Salvando..." : "Salvar dados"}
              </Button>
            </div>

            <Separator />

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">Redefinir senha do usuário</p>
              </div>
              <p className="text-xs text-blue-700">Uma nova senha aleatória será gerada e copiada para a área de transferência.</p>
              <Button variant="outline" size="sm" className="w-full gap-2 border-blue-200 bg-white hover:bg-blue-100 text-blue-700" onClick={salvarSenha} disabled={resetPasswordMutation.isPending}>
                <RefreshCw className="w-3.5 h-3.5" />
                {resetPasswordMutation.isPending ? "Gerando..." : "Gerar nova senha"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharEditar}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal Criar Novo Usuário ===== */}
      <Dialog open={modalNovo} onOpenChange={(open) => { if (!open) { setModalNovo(false); setSenhaGerada(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                {senhaGerada ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : <UserPlus className="w-4 h-4 text-blue-600" />}
              </div>
              <div>
                <DialogTitle className="text-base">{senhaGerada ? "Usuário criado!" : "Novo Usuário"}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{senhaGerada ? "Compartilhe as credenciais abaixo" : "Preencha os dados do novo usuário"}</p>
              </div>
            </div>
          </DialogHeader>

          {senhaGerada ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-background/60">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Usuário criado</p>
                  <p className="font-semibold text-foreground">{formNovo.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formNovo.role === "admin" ? "🛡️ Administrador" : "👤 Usuário"}</p>
                </div>
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">E-mail de acesso</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <span className="text-sm font-mono text-foreground truncate">{formNovo.email}</span>
                    </div>
                    <button onClick={() => copiar(formNovo.email)} className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-muted">
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Senha gerada</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <span className="text-xl font-mono font-bold tracking-[0.25em] text-foreground">{senhaGerada}</span>
                    </div>
                    <button onClick={() => copiar(senhaGerada)} className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-muted">
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Atenção:</span> anote ou copie a senha agora. Por segurança, ela não será exibida novamente após fechar esta janela.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => copiar(`E-mail: ${formNovo.email}\nSenha: ${senhaGerada}`)}>
                  <Copy className="w-4 h-4" /> Copiar tudo
                </Button>
                <Button className="flex-1" onClick={() => { setModalNovo(false); setSenhaGerada(null); }}>Concluir</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Nome completo</Label>
                  <Input placeholder="Ex: Maria Silva" value={formNovo.nome} onChange={(e) => setFormNovo(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">E-mail</Label>
                  <Input type="email" placeholder="usuario@email.com" value={formNovo.email} onChange={(e) => setFormNovo(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Perfil de acesso</Label>
                  <Select value={formNovo.role} onValueChange={(v) => setFormNovo(f => ({ ...f, role: v as "admin" | "usuario" }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usuario">Usuário — lançamentos e consultas</SelectItem>
                      <SelectItem value="admin">Administrador — acesso total</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalNovo(false)}>Cancelar</Button>
                <Button
                  className="gap-2"
                  onClick={() => {
                    if (!formNovo.nome.trim()) { toast.error("Informe o nome."); return; }
                    if (!formNovo.email.trim()) { toast.error("Informe o e-mail."); return; }
                    createMutation.mutate({ nome: formNovo.nome, email: formNovo.email, role: formNovo.role });
                  }}
                  disabled={createMutation.isPending}
                >
                  <UserPlus className="w-4 h-4" />
                  {createMutation.isPending ? "Criando..." : "Criar e gerar senha"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de nova senha gerada pelo reset */}
      <Dialog open={!!novaSenhaInfo} onOpenChange={() => setNovaSenhaInfo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-base">Nova senha gerada</DialogTitle>
                {novaSenhaInfo && <p className="text-xs text-muted-foreground mt-0.5">Para {novaSenhaInfo.nome}</p>}
              </div>
            </div>
          </DialogHeader>
          {novaSenhaInfo && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Nova senha</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <span className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground">{novaSenhaInfo.senha}</span>
                  </div>
                  <button onClick={() => copiar(novaSenhaInfo.senha)} className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-muted">
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">Atenção:</span> anote ou copie a senha agora. Por segurança, ela não será exibida novamente.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => copiar(novaSenhaInfo.senha)}>
                  <Copy className="w-4 h-4" /> Copiar senha
                </Button>
                <Button className="flex-1" onClick={() => setNovaSenhaInfo(null)}>Concluir</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar remoção */}
      <AlertDialog open={!!deletandoId} onOpenChange={() => setDeletandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário perderá acesso ao sistema imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletandoId && deleteMutation.mutate({ id: deletandoId })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
