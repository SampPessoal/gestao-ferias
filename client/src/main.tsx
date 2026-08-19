import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { PrivacyProvider } from "./contexts/PrivacyContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados considerados frescos por 2 minutos — evita re-fetch em cada navegação
      staleTime: 2 * 60_000,
      // Mantém cache por 10 minutos após o componente desmontar
      gcTime: 10 * 60_000,
      // Não re-fetcha ao focar a janela (evita queries desnecessárias ao trocar de aba)
      refetchOnWindowFocus: false,
      // Retry apenas 1 vez em caso de erro
      retry: 1,
      // Não re-fetcha ao reconectar (evita burst de queries após perda de rede)
      refetchOnReconnect: false,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // Não logar dados sensíveis no console em produção
    if (import.meta.env.DEV) console.error("[API Query Error]", error);
  }
});
queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    // Não logar dados sensíveis no console em produção
    if (import.meta.env.DEV) console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Fallback para preview em iframe onde cookies são bloqueados:
        // após o login, o token JWT é salvo no sessionStorage e enviado como Bearer token.
        try {
          // Token do sistema próprio (gf_sys_session)
          const sysToken = localStorage.getItem("gf_sys_token");
          if (sysToken) {
            return { Authorization: `Bearer ${sysToken}` };
          }
          // Fallback legado: token do OAuth do Manus
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <App />
      </PrivacyProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
