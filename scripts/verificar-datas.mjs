/**
 * Verifica as datas recalculadas de alguns colaboradores via fetch à API local
 */
const BASE = "http://localhost:3000";

async function main() {
  // Busca colaboradores via API
  const res = await fetch(`${BASE}/api/trpc/colaboradores.list?input=${encodeURIComponent(JSON.stringify({ json: { page: 1, limit: 5, status: "ativo" } }))}`);
  const data = await res.json();
  const colabs = data?.result?.data?.json?.colaboradores ?? [];
  
  for (const c of colabs.slice(0, 5)) {
    const adm = c.admissao ? new Date(c.admissao).toLocaleDateString('pt-BR') : '—';
    const pa = c.periodoAquisitivo ? new Date(c.periodoAquisitivo).toLocaleDateString('pt-BR') : '—';
    const venc = c.vencimento ? new Date(c.vencimento).toLocaleDateString('pt-BR') : '—';
    const lim = c.dataLimite ? new Date(c.dataLimite).toLocaleDateString('pt-BR') : '—';
    console.log(`${c.nome}`);
    console.log(`  Admissão: ${adm} | Período: ${pa} | Vencimento: ${venc} | Limite: ${lim}`);
  }
}

main().catch(console.error);
