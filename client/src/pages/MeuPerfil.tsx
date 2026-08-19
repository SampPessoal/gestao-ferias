import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useSystemAuth } from "@/hooks/useSystemAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Shield, User, Eye, EyeOff, KeyRound, Save,
  UserCircle, Mail, BadgeCheck, Calendar, Lock,
  CheckCircle2,
} from "lucide-react";

export default function MeuPerfil() {
  const { user, refetch } = useSystemAuth();
  const utils = trpc.useUtils();

  const [nome, setNome] = useState(user?.nome ?? "");
  const [nomeEditado, setNomeEditado] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const updateProfileMutation = trpc.systemUsers.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Nome atualizado com sucesso!");
      setNomeEditado(false);
      await utils.systemUsers.me.invalidate();
      refetch();
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar nome."),
  });

  const changePasswordMutation = trpc.systemUsers.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    },
    onError: (err) => toast.error(err.message || "Erro ao alterar senha."),
  });

  const salvarNome = () => {
    if (!nome.trim() || nome.trim().length < 2) {
      toast.error("Informe um nome válido.");
      return;
    }
    updateProfileMutation.mutate({ nome: nome.trim() });
  };

  const salvarSenha = () => {
    if (!senhaAtual.trim()) { toast.error("Informe a senha atual."); return; }
    if (novaSenha.length < 6) { toast.error("A nova senha deve ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { toast.error("As senhas não coincidem."); return; }
    changePasswordMutation.mutate({ senhaAtual, novaSenha });
  };

  if (!user) return null;

  const iniciais = user.nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join("");

  const senhaForte = novaSenha.length >= 8;
  const senhaMedia = novaSenha.length >= 6 && novaSenha.length < 8;
  const senhaOk = novaSenha.length >= 6;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner ───────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #0d1f3c 60%, #0f172a 100%)", minHeight: 200 }}>
        {/* Blobs decorativos */}
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 15% 50%, #3b82f6 0%, transparent 45%), radial-gradient(circle at 85% 20%, #6366f1 0%, transparent 40%)" }} />

        <div className="relative px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar grande */}
          <div className="relative shrink-0">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-2xl"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", border: "3px solid rgba(255,255,255,0.15)" }}
            >
              {iniciais}
            </div>
            {/* Badge de role */}
            <div
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: user.role === "admin" ? "#3b82f6" : "#64748b", border: "2px solid #0f172a" }}
            >
              {user.role === "admin" ? <Shield className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black text-white" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.5px" }}>
                {user.nome}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                user.role === "admin"
                  ? "bg-blue-500/20 text-blue-300 border-blue-400/30"
                  : "bg-slate-500/20 text-slate-300 border-slate-400/30"
              }`}>
                {user.role === "admin" ? <BadgeCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                {user.role === "admin" ? "Administrador" : "Usuário"}
              </span>
            </div>
            <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.55)" }}>{user.email}</p>
          </div>
        </div>
      </div>

      {/* ── Grid principal ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Coluna Esquerda: Dados do Perfil ──────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px oklch(0.145 0.03 245 / 0.07)" }}>
          {/* Header da seção */}
          <div className="px-6 py-4 border-b border-border/60 flex items-center gap-3" style={{ background: "oklch(0.97 0.005 245)" }}>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <UserCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Dados do Perfil</h2>
              <p className="text-xs text-muted-foreground">Informações da sua conta</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-sm font-semibold">Nome completo</Label>
              <div className="flex gap-2">
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setNomeEditado(e.target.value !== user.nome);
                  }}
                  placeholder="Seu nome completo"
                  className="flex-1"
                />
                {nomeEditado && (
                  <Button
                    onClick={salvarNome}
                    disabled={updateProfileMutation.isPending}
                    className="gap-1.5 shrink-0"
                    size="sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {updateProfileMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                )}
              </div>
            </div>

            {/* E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                E-mail
                <span className="text-xs text-muted-foreground font-normal">(somente leitura)</span>
              </Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Função */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                Função
                <span className="text-xs text-muted-foreground font-normal">(somente leitura)</span>
              </Label>
              <Input
                value={user.role === "admin" ? "Administrador" : "Usuário"}
                disabled
                className="bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
            </div>

            <Separator />

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> Nível de acesso
                </p>
                <p className="text-sm font-bold text-foreground">
                  {user.role === "admin" ? "Total" : "Padrão"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> Status
                </p>
                <p className="text-sm font-bold text-green-600">Ativo</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Coluna Direita: Alterar Senha ─────────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px oklch(0.145 0.03 245 / 0.07)" }}>
          {/* Header da seção */}
          <div className="px-6 py-4 border-b border-border/60 flex items-center gap-3" style={{ background: "oklch(0.97 0.005 245)" }}>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Alterar Senha</h2>
              <p className="text-xs text-muted-foreground">Mantenha sua conta segura</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Senha atual */}
            <div className="space-y-2">
              <Label htmlFor="senhaAtual" className="text-sm font-semibold">Senha atual</Label>
              <div className="relative">
                <Input
                  id="senhaAtual"
                  type={mostrarSenhaAtual ? "text" : "password"}
                  placeholder="Digite sua senha atual"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMostrarSenhaAtual(v => !v)}
                >
                  {mostrarSenhaAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nova senha */}
            <div className="space-y-2">
              <Label htmlFor="novaSenha" className="text-sm font-semibold">Nova senha</Label>
              <div className="relative">
                <Input
                  id="novaSenha"
                  type={mostrarNovaSenha ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMostrarNovaSenha(v => !v)}
                >
                  {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Indicador de força */}
              {novaSenha.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${novaSenha.length >= 1 ? (senhaForte ? "bg-green-500" : senhaMedia ? "bg-yellow-500" : "bg-red-400") : "bg-muted"}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${novaSenha.length >= 4 ? (senhaForte ? "bg-green-500" : senhaMedia ? "bg-yellow-500" : "bg-red-400") : "bg-muted"}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${senhaMedia || senhaForte ? (senhaForte ? "bg-green-500" : "bg-yellow-500") : "bg-muted"}`} />
                    <div className={`h-1.5 flex-1 rounded-full transition-colors ${senhaForte ? "bg-green-500" : "bg-muted"}`} />
                  </div>
                  <p className={`text-xs font-medium ${senhaForte ? "text-green-600" : senhaMedia ? "text-yellow-600" : "text-red-500"}`}>
                    {senhaForte ? "Senha forte" : senhaMedia ? "Senha média" : "Senha fraca"}
                  </p>
                </div>
              )}
            </div>

            {/* Confirmar senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmarSenha" className="text-sm font-semibold">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirmarSenha"
                  type={mostrarConfirmar ? "text" : "password"}
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className={`pr-10 ${confirmarSenha && novaSenha !== confirmarSenha ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMostrarConfirmar(v => !v)}
                >
                  {mostrarConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmarSenha && novaSenha !== confirmarSenha && (
                <p className="text-xs text-red-500">As senhas não coincidem</p>
              )}
              {confirmarSenha && novaSenha === confirmarSenha && senhaOk && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Senhas coincidem
                </p>
              )}
            </div>

            <Separator />

            <Button
              onClick={salvarSenha}
              disabled={changePasswordMutation.isPending || !senhaAtual || !novaSenha || !confirmarSenha}
              className="w-full gap-2 h-11 text-sm font-semibold"
            >
              <Lock className="w-4 h-4" />
              {changePasswordMutation.isPending ? "Alterando senha..." : "Confirmar nova senha"}
            </Button>

            {/* Dica de segurança */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Dicas de segurança</p>
              <ul className="space-y-0.5 text-blue-600 list-disc list-inside">
                <li>Use pelo menos 8 caracteres</li>
                <li>Combine letras, números e símbolos</li>
                <li>Não reutilize senhas antigas</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
