import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "./lib/trpc";
import { lazy, Suspense } from "react";
import DashboardLayout from "./components/DashboardLayout";
import { useSystemAuth } from "./hooks/useSystemAuth";

// Lazy loading: cada página só é carregada quando o usuário navega até ela
// Reduz o bundle inicial e acelera o primeiro carregamento do sistema
const NotFound          = lazy(() => import("@/pages/NotFound"));
const Dashboard         = lazy(() => import("./pages/Dashboard"));
const Colaboradores     = lazy(() => import("./pages/Colaboradores"));
const ColaboradorDetalhe = lazy(() => import("./pages/ColaboradorDetalhe"));
const Setores           = lazy(() => import("./pages/Setores"));
const SetorDetalhe      = lazy(() => import("./pages/SetorDetalhe"));
const Relatorio         = lazy(() => import("./pages/Relatorio"));
const RelacaoFerias     = lazy(() => import("./pages/RelacaoFerias"));
const RelacaoAbonos     = lazy(() => import("./pages/RelacaoAbonos"));
const RelacaoAtestados  = lazy(() => import("./pages/RelacaoAtestados"));
const SystemLogin       = lazy(() => import("./pages/SystemLogin"));
const Cadastros         = lazy(() => import("./pages/Cadastros"));
const MeuPerfil         = lazy(() => import("@/pages/MeuPerfil"));
const RelacaoSeguroVida = lazy(() => import("@/pages/RelacaoSeguroVida"));
const RelacaoBeneficios = lazy(() => import("@/pages/RelacaoBeneficios"));
const Ferias            = lazy(() => import("@/pages/Ferias"));
const FeriasDetalhe     = lazy(() => import("@/pages/FeriasDetalhe"));
const Calendario        = lazy(() => import("@/pages/Calendario"));
const PlanilhaVRVT      = lazy(() => import("@/pages/PlanilhaVRVT"));
const Feriados          = lazy(() => import("@/pages/Feriados"));
const ExamesPeriodicos  = lazy(() => import("@/pages/ExamesPeriodicos"));
const PlanoSaude        = lazy(() => import("@/pages/PlanoSaude"));
const FolhaMes          = lazy(() => import("@/pages/FolhaMes"));
const MovimentacaoMes   = lazy(() => import("@/pages/MovimentacaoMes"));
const AuxiliosBonusPanel = lazy(() => import("@/pages/AuxiliosBonusPanel"));

// Spinner de carregamento de página (usado pelo Suspense)
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

// AppShell: renderiza DashboardLayout UMA vez só, envolvendo todas as rotas protegidas
// Isso evita que o layout seja desmontado/remontado a cada navegação
function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useSystemAuth();
  const utils = trpc.useUtils();

  if (isLoading) return <PageLoader />;
  if (!isLoggedIn) return (
    <Suspense fallback={<PageLoader />}>
      <SystemLogin onSuccess={() => utils.systemUsers.me.invalidate()} />
    </Suspense>
  );
  return <>{children}</>;
}

function ProtectedLayout({ children, adminOnly = false, noPadding = false }: { children: React.ReactNode; adminOnly?: boolean; noPadding?: boolean }) {
  const { isAdmin } = useSystemAuth();
  if (adminOnly && !isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <p className="text-lg font-semibold text-destructive">Acesso restrito</p>
      <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
    </div>
  );
  return <>{children}</>;
}

// Skeleton leve para conteúdo de página (mantém o layout/sidebar visível)
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
      <div className="h-4 w-72 rounded bg-muted animate-pulse" />
      <div className="mt-4 grid grid-cols-1 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  );
}

function Router() {
  return (
    <AppShell>
      <DashboardLayout>
        <Suspense fallback={<PageSkeleton />}>
          <Switch>
            <Route path="/" component={() => <Dashboard />} />
            <Route path="/colaboradores" component={() => <Colaboradores />} />
            <Route path="/colaboradores/:id" component={({ params }) => <ColaboradorDetalhe id={Number(params.id)} />} />
            <Route path="/setores" component={() => <Setores />} />
            <Route path="/setores/:id" component={({ params }) => <SetorDetalhe id={Number(params.id)} />} />
            <Route path="/relatorio" component={() => <Relatorio />} />
            <Route path="/ferias" component={() => <Ferias />} />
            <Route path="/ferias/:id" component={({ params }) => <FeriasDetalhe id={Number(params.id)} />} />
            <Route path="/calendario" component={() => <Calendario />} />
            <Route path="/relacao-ferias" component={() => <RelacaoFerias />} />
            <Route path="/relacao-abonos" component={() => <RelacaoAbonos />} />
            <Route path="/relacao-atestados" component={() => <RelacaoAtestados />} />
            <Route path="/cadastros" component={() => <ProtectedLayout adminOnly><Cadastros /></ProtectedLayout>} />
            <Route path="/meu-perfil" component={() => <MeuPerfil />} />
            <Route path="/seguro-vida" component={() => <RelacaoSeguroVida />} />
            <Route path="/relacao-beneficios" component={() => <RelacaoBeneficios />} />
            <Route path="/planilha-vrvt" component={() => <PlanilhaVRVT />} />
            <Route path="/feriados" component={() => <Feriados />} />
            <Route path="/exames-periodicos" component={() => <ExamesPeriodicos />} />
            <Route path="/plano-saude" component={() => <PlanoSaude />} />
            <Route path="/folha-mes" component={() => <FolhaMes />} />
            <Route path="/movimentacao-mes" component={() => <MovimentacaoMes />} />
            <Route path="/auxilios-bonus" component={() => <AuxiliosBonusPanel />} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </DashboardLayout>
    </AppShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
