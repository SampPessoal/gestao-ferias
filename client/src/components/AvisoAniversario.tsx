import { useState } from "react";
import { Link } from "wouter";
import { Cake, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

/** Data de hoje no fuso do navegador, em YYYY-MM-DD. */
function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const nomeBonito = (n: string) => n.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase()).replace(/\s(De|Da|Do|Dos|Das|E)\s/g, (m) => m.toLowerCase());

/** Aviso no topo das telas nos dias de aniversário de colaboradores ativos. Some ao fechar, até o dia seguinte. */
export function AvisoAniversario() {
  const hoje = hojeLocal();
  const chave = `aviso-aniversario-fechado-${hoje}`;
  const [fechado, setFechado] = useState(() => {
    try { return localStorage.getItem(chave) === "1"; } catch { return false; }
  });
  const mes = Number(hoje.slice(5, 7));
  const dia = Number(hoje.slice(8, 10));
  const { data = [] } = trpc.aniversariantes.useQuery({ mes }, { staleTime: 60 * 60 * 1000, enabled: !fechado });
  const deHoje = (data as { id: number; nome: string; dia: number; anoNascimento: number }[]).filter((a) => a.dia === dia);
  if (fechado || deHoje.length === 0) return null;

  const ano = Number(hoje.slice(0, 4));
  const nomes = deHoje.map((a) => `${nomeBonito(a.nome)} (${ano - a.anoNascimento} anos)`);
  const texto = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

  const fechar = () => {
    try { localStorage.setItem(chave, "1"); } catch { /* sem armazenamento: fecha só nesta sessão */ }
    setFechado(true);
  };

  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
      style={{ background: "oklch(0.97 0.03 15)", borderColor: "oklch(0.88 0.07 15)", color: "oklch(0.38 0.12 15)" }}>
      <Cake className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        <span className="font-semibold">Hoje é aniversário de </span>
        {texto} 🎉{" "}
        <Link href="/relacao-aniversarios" className="whitespace-nowrap font-medium underline underline-offset-2">Ver aniversários do mês</Link>
      </p>
      <button type="button" onClick={fechar} aria-label="Fechar aviso de aniversário"
        className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
