import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

export type SystemUser = {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "usuario";
};

export function useSystemAuth() {
  const { data: user, isPending, fetchStatus, refetch } = trpc.systemUsers.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // No react-query v5, isLoading = isPending && fetchStatus === "fetching"
  const isFetching = isPending && fetchStatus === "fetching";

  // Timeout de segurança: se demorar mais de 10s, para de mostrar loading
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!isFetching) { setTimedOut(false); return; }
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [isFetching]);

  const isLoading = isFetching && !timedOut;

  return {
    user: user ?? null,
    isLoading,
    isAdmin: user?.role === "admin",
    isLoggedIn: !!user,
    refetch,
  };
}
