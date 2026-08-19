import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, LogIn, Users, CalendarDays, Shield, Bell,
  BarChart3, Wallet, FileText, Palmtree, CheckCircle2
} from "lucide-react";

interface SystemLoginProps {
  onSuccess: () => void;
}

const FEATURES = [
  { icon: CalendarDays, title: "Controle de Férias CLT", desc: "Períodos aquisitivos, vencimentos e planejamento" },
  { icon: Users, title: "Gestão de Colaboradores", desc: "Cadastro completo com ficha técnica e histórico" },
  { icon: Bell, title: "Alertas Automáticos", desc: "Notificações de férias vencidas e a vencer" },
  { icon: Wallet, title: "Benefícios e VR/VT", desc: "Controle de vale-refeição, transporte e auxílios" },
  { icon: BarChart3, title: "Relatórios Gerenciais", desc: "Exportação CSV por setor ou geral" },
  { icon: FileText, title: "Atestados e Abonos", desc: "Registro e controle de afastamentos" },
  { icon: Shield, title: "Seguro de Vida", desc: "Gestão de apólices e beneficiários" },
  { icon: CalendarDays, title: "Calendário de Eventos", desc: "Feriados de Salvador, Bahia e Brasil" },
];

export default function SystemLogin({ onSuccess }: SystemLoginProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);

  const utils = trpc.useUtils();
  const loginMutation = trpc.systemUsers.login.useMutation({
    onSuccess: async (data) => {
      // Salva o token no sessionStorage para funcionar mesmo quando cookies são bloqueados (preview em iframe)
      try {
        if (data.token) {
          localStorage.setItem("gf_sys_token", data.token);
        }
      } catch {
        // sessionStorage indisponível
      }
      toast.success(`Bem-vindo, ${data.nome}!`);
      await utils.systemUsers.me.invalidate();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "E-mail ou senha incorretos.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      toast.error("Preencha o e-mail e a senha.");
      return;
    }
    loginMutation.mutate({ email: email.trim(), senha });
  };

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ background: "oklch(0.98 0.005 248)" }}>
      {/* ── Painel esquerdo ── */}
      <div
        className="hidden lg:flex lg:w-[58%] xl:w-[60%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, oklch(0.20 0.09 252) 0%, oklch(0.26 0.11 250) 55%, oklch(0.18 0.08 255) 100%)"
        }}
      >
        {/* Elementos decorativos */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ background: "oklch(0.50 0.18 252)" }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.06]"
          style={{ background: "oklch(0.55 0.15 248)" }} />
        <div className="absolute top-1/3 right-16 w-64 h-64 rounded-full opacity-[0.04]"
          style={{ background: "oklch(0.50 0.18 252)" }} />
        {/* Grade de pontos */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img
              src="/manus-storage/logo-gestao-rh_c85a262f.png"
              alt="Gestão de RH"
              className="w-12 h-12 rounded-2xl object-contain shadow-lg"
              style={{ background: "oklch(0.18 0.06 252)" }}
            />
            <div>
              <p className="text-white font-bold text-xl leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                Gestão de RH
              </p>
              <p className="text-white/40 text-xs tracking-wide uppercase">Sistema de Recursos Humanos</p>
            </div>
          </div>
        </div>

        {/* Título central */}
        <div className="relative z-10 space-y-10">
          <div>
            <h2 className="text-5xl font-bold text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              Tudo que o seu<br />
              <span style={{ color: "oklch(0.72 0.18 210)" }}>RH precisa</span><br />
              em um só lugar.
            </h2>
            <p className="text-white/55 mt-4 text-base leading-relaxed max-w-md">
              Gerencie colaboradores, férias, benefícios, atestados e muito mais com eficiência e segurança.
            </p>
          </div>

          {/* Grid de funcionalidades */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl p-3 transition-colors"
                style={{
                  background: "oklch(1 0 0 / 0.04)",
                  border: "1px solid oklch(1 0 0 / 0.07)"
                }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: "oklch(0.65 0.18 210 / 0.20)",
                    border: "1px solid oklch(0.65 0.18 210 / 0.30)"
                  }}>
                  <f.icon className="w-4 h-4" style={{ color: "oklch(0.72 0.18 210)" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-white/90 text-xs font-semibold leading-tight break-words">{f.title}</p>
                  <p className="text-white/40 text-xs mt-0.5 leading-snug break-words">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-white/25 text-xs">© 2025 Gestão de RH · Todos os direitos reservados</p>
          <div className="flex items-center gap-1.5 text-white/30 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400/60" />
            <span>Sistema seguro</span>
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-background overflow-y-auto">
        {/* Logo mobile */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <img
            src="/manus-storage/logo-gestao-rh_c85a262f.png"
            alt="Gestão de RH"
            className="w-11 h-11 rounded-2xl object-contain"
            style={{ background: "oklch(0.18 0.06 252)" }}
          />
          <p className="font-bold text-xl text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            Gestão de RH
          </p>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Cabeçalho */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Bem-vindo de volta
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          {/* Card do formulário */}
          <div
            className="rounded-2xl p-8 space-y-6"
            style={{
              background: "oklch(1 0 0)",
              border: "1px solid oklch(0.92 0.01 248)",
              boxShadow: "0 8px 40px oklch(0.145 0.03 248 / 0.10), 0 2px 8px oklch(0.145 0.03 248 / 0.06)"
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={loginMutation.isPending}
                  className="h-12 rounded-xl text-sm"
                  style={{ border: "1.5px solid oklch(0.88 0.01 248)" }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha" className="text-sm font-semibold text-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showSenha ? "text" : "password"}
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="current-password"
                    disabled={loginMutation.isPending}
                    className="h-12 rounded-xl text-sm pr-12"
                    style={{ border: "1.5px solid oklch(0.88 0.01 248)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                    tabIndex={-1}
                  >
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-semibold text-sm gap-2 mt-2 text-white"
                disabled={loginMutation.isPending}
                style={{
                  background: "linear-gradient(135deg, oklch(0.25 0.09 248) 0%, oklch(0.32 0.12 260) 100%)",
                  boxShadow: "0 4px 16px oklch(0.25 0.09 248 / 0.40)"
                }}
              >
                {loginMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Entrar no sistema
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Não tem acesso?{" "}
            <span className="text-foreground font-semibold">
              Entre em contato com o administrador
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
