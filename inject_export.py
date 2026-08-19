#!/usr/bin/env python3
with open("client/src/pages/MovimentacaoMes.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# ─── 1. Inject export helpers before "export default function MovimentacaoMes" ───
HELPERS = '''// ─── Helpers de exportação ────────────────────────────────────────────────────
function buildSheetSeguroVida(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Data": fmtDate(r.data), "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetAuxNotebook(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Data Início": fmtDate(r.dataInicio), "Valor (R$)": r.valor != null ? Number(r.valor).toFixed(2) : "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetPlanoSaude(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Plano": r.tipoPlano ?? "", "Categoria": r.categoria ?? "", "Dt. Nascimento": fmtDate(r.dataNascimento), "Valor (R$)": r.valor != null ? Number(r.valor).toFixed(2) : "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetValeTransporte(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetAuxCreche(rows: any[]) {
  return rows.map(r => ({ "Colaborador": r.nomeColaborador ?? "", "Empresa": r.empresa ?? "", "Tipo": r.tipo === "incluir" ? "Incluir" : "Excluir", "Nome do Filho": r.nomeFilho ?? "", "Dt. Nasc. Filho": fmtDate(r.dataNascimentoFilho), "Valor (R$)": r.valor != null ? Number(r.valor).toFixed(2) : "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}
function buildSheetBonus(rows: any[]) {
  return rows.map(r => ({ "Indicador": r.nomeIndicador ?? "", "Indicado": r.nomeIndicado ?? "", "Empresa": r.empresa ?? "", "Admissão Indicado": fmtDate(r.dataAdmissaoIndicado), "Pgto. Previsto": fmtDate(r.dataPagamentoPrevisto), "Pgto. Efetivo": fmtDate(r.dataPagamentoEfetivo), "Valor Bônus (R$)": r.valorBonus != null ? Number(r.valorBonus).toFixed(2) : "", "Status": r.status ?? "", "Observação": r.observacao ?? "", "Registrado por": r.createdByNome ?? "" }));
}

function appendXlsxSheet(wb: XLSX.WorkBook, rows: Record<string, string>[], sheetName: string) {
  if (rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([["Nenhum registro neste mês"]]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
}

function buildPdfHtml(titulo: string, competencia: string, empresa: string, secoes: { nome: string; headers: string[]; rows: string[][] }[]) {
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bahia" });
  const empresaLabel = empresa ? ` — ${empresa}` : "";
  const secoesHtml = secoes.map(s => {
    if (s.rows.length === 0) return `<div class="section"><h2>${s.nome}</h2><p class="empty">Nenhum registro neste mês.</p></div>`;
    const thead = s.headers.map(h => `<th>${h}</th>`).join("");
    const tbody = s.rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join("")}</tr>`).join("");
    return `<div class="section"><h2>${s.nome} <span class="count">${s.rows.length} registro${s.rows.length !== 1 ? "s" : ""}</span></h2><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
  }).join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
<style>@page{size:A4 landscape;margin:12mm 10mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:9px;color:#1e293b}.header{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#0f172a 100%);color:white;padding:14px 18px;border-radius:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}.header h1{font-size:15px;font-weight:800}.header .meta{font-size:8px;opacity:.7;margin-top:3px}.section{margin-bottom:18px;page-break-inside:avoid}.section h2{font-size:11px;font-weight:700;color:#1e3a5f;border-left:3px solid #3b82f6;padding-left:8px;margin-bottom:6px}.section h2 .count{font-size:8px;font-weight:400;color:#64748b;margin-left:6px}.empty{font-size:9px;color:#94a3b8;padding:6px 0}table{width:100%;border-collapse:collapse;margin-bottom:4px}thead tr{background:#1e293b;color:white}thead th{padding:5px 7px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:5px 7px;border-bottom:1px solid #e2e8f0;font-size:8.5px}tbody td:first-child{font-weight:600}.footer{margin-top:12px;font-size:7.5px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px}</style></head><body>
<div class="header"><div><h1>${titulo}${empresaLabel}</h1><div class="meta">Competência: ${competencia} · Gerado em ${now}</div></div></div>
${secoesHtml}
<div class="footer">Gestão de RH — Sistema de Recursos Humanos · Salvador/BA · Documento gerado automaticamente</div>
</body></html>`;
}

'''

target = "export default function MovimentacaoMes() {"
content = content.replace(target, HELPERS + target, 1)

# ─── 2. Inject state + logic inside the function, after the anosDisponiveis useMemo ───
OLD_BLOCK = """  const anosDisponiveis = useMemo(() => {
    const a = [];
    for (let y = 2024; y <= hoje.getFullYear() + 1; y++) a.push(y);
    return a;
  }, []);

  return ("""

NEW_BLOCK = """  const anosDisponiveis = useMemo(() => {
    const a = [];
    for (let y = 2024; y <= hoje.getFullYear() + 1; y++) a.push(y);
    return a;
  }, []);

  const competencia = `${MESES[mes - 1]} / ${ano}`;
  const nomeArquivo = `Movimentacao-${MESES[mes - 1].toUpperCase()}-${ano}${empresa ? "-" + empresa : ""}`;

  // Dados da aba atual (passados pelas abas via callback)
  const [dadosAbaAtual, setDadosAbaAtual] = useState<any[]>([]);

  // Query lazy para exportar todas as abas de uma vez
  const exportAllQuery = trpc.movimentacao.exportAll.useQuery(
    { empresa: empresa || undefined, mes, ano },
    { enabled: false }
  );

  const exportarExcelAbaAtual = () => {
    const wb = XLSX.utils.book_new();
    const abaInfo = ABAS.find(a => a.id === abaAtiva);
    const sheetName = abaInfo?.label ?? abaAtiva;
    let rows: Record<string, string>[] = [];
    if (abaAtiva === "seguroVida") rows = buildSheetSeguroVida(dadosAbaAtual);
    else if (abaAtiva === "auxNotebook") rows = buildSheetAuxNotebook(dadosAbaAtual);
    else if (abaAtiva === "planoSaude") rows = buildSheetPlanoSaude(dadosAbaAtual);
    else if (abaAtiva === "valeTransporte") rows = buildSheetValeTransporte(dadosAbaAtual);
    else if (abaAtiva === "auxCreche") rows = buildSheetAuxCreche(dadosAbaAtual);
    else if (abaAtiva === "bonusIndicacao") rows = buildSheetBonus(dadosAbaAtual);
    appendXlsxSheet(wb, rows, sheetName);
    XLSX.writeFile(wb, `${nomeArquivo}-${sheetName}.xlsx`);
    toast.success("Excel exportado!");
  };

  const exportarExcelTodas = async () => {
    const result = await exportAllQuery.refetch();
    if (!result.data) { toast.error("Erro ao buscar dados"); return; }
    const d = result.data;
    const wb = XLSX.utils.book_new();
    appendXlsxSheet(wb, buildSheetSeguroVida(d.seguroVida), "Seguro de Vida");
    appendXlsxSheet(wb, buildSheetAuxNotebook(d.auxNotebook), "Auxílio Notebook");
    appendXlsxSheet(wb, buildSheetPlanoSaude(d.planoSaude), "Plano de Saúde");
    appendXlsxSheet(wb, buildSheetValeTransporte(d.valeTransporte), "Vale Transporte");
    appendXlsxSheet(wb, buildSheetAuxCreche(d.auxCreche), "Auxílio Creche");
    appendXlsxSheet(wb, buildSheetBonus(d.bonusIndicacao), "Bônus por Indicação");
    XLSX.writeFile(wb, `${nomeArquivo}-COMPLETO.xlsx`);
    toast.success("Excel completo exportado!");
  };

  const exportarPdfAbaAtual = () => {
    const abaInfo = ABAS.find(a => a.id === abaAtiva);
    const titulo = `Movimentação do Mês — ${abaInfo?.label ?? abaAtiva}`;
    let secao: { nome: string; headers: string[]; rows: string[][] };
    const rows = dadosAbaAtual;
    if (abaAtiva === "seguroVida") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Data", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.data), r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "auxNotebook") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Data Início", "Valor (R$)", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.dataInicio), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "planoSaude") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Plano", "Categoria", "Valor (R$)", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.tipoPlano ?? "", r.categoria ?? "", r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "valeTransporte") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.observacao ?? "", r.createdByNome ?? ""]) };
    else if (abaAtiva === "auxCreche") secao = { nome: abaInfo!.label, headers: ["Colaborador", "Empresa", "Tipo", "Nome do Filho", "Dt. Nasc. Filho", "Valor (R$)", "Observação", "Registrado por"], rows: rows.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.nomeFilho ?? "", fmtDate(r.dataNascimentoFilho), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) };
    else secao = { nome: abaInfo!.label, headers: ["Indicador", "Indicado", "Empresa", "Admissão", "Pgto. Previsto", "Valor (R$)", "Status", "Registrado por"], rows: rows.map((r: any) => [r.nomeIndicador ?? "", r.nomeIndicado ?? "", r.empresa ?? "", fmtDate(r.dataAdmissaoIndicado), fmtDate(r.dataPagamentoPrevisto), r.valorBonus != null ? `R$ ${Number(r.valorBonus).toFixed(2)}` : "", r.status ?? "", r.createdByNome ?? ""]) };
    const html = buildPdfHtml(titulo, competencia, empresa, [secao]);
    const win = window.open("", "_blank");
    if (!win) { toast.error("Bloqueio de pop-up detectado. Permita pop-ups para este site."); return; }
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
    toast.success("PDF pronto para impressão!");
  };

  const exportarPdfTodas = async () => {
    const result = await exportAllQuery.refetch();
    if (!result.data) { toast.error("Erro ao buscar dados"); return; }
    const d = result.data;
    const secoes = [
      { nome: "Seguro de Vida", headers: ["Colaborador", "Empresa", "Tipo", "Data", "Observação", "Registrado por"], rows: d.seguroVida.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.data), r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Auxílio Notebook", headers: ["Colaborador", "Empresa", "Tipo", "Data Início", "Valor (R$)", "Observação", "Registrado por"], rows: d.auxNotebook.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", fmtDate(r.dataInicio), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Plano de Saúde", headers: ["Colaborador", "Empresa", "Tipo", "Plano", "Categoria", "Valor (R$)", "Observação", "Registrado por"], rows: d.planoSaude.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.tipoPlano ?? "", r.categoria ?? "", r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Vale Transporte", headers: ["Colaborador", "Empresa", "Tipo", "Observação", "Registrado por"], rows: d.valeTransporte.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Auxílio Creche", headers: ["Colaborador", "Empresa", "Tipo", "Nome do Filho", "Dt. Nasc. Filho", "Valor (R$)", "Observação", "Registrado por"], rows: d.auxCreche.map((r: any) => [r.nomeColaborador ?? "", r.empresa ?? "", r.tipo === "incluir" ? "Incluir" : "Excluir", r.nomeFilho ?? "", fmtDate(r.dataNascimentoFilho), r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : "", r.observacao ?? "", r.createdByNome ?? ""]) },
      { nome: "Bônus por Indicação", headers: ["Indicador", "Indicado", "Empresa", "Admissão", "Pgto. Previsto", "Valor (R$)", "Status", "Registrado por"], rows: d.bonusIndicacao.map((r: any) => [r.nomeIndicador ?? "", r.nomeIndicado ?? "", r.empresa ?? "", fmtDate(r.dataAdmissaoIndicado), fmtDate(r.dataPagamentoPrevisto), r.valorBonus != null ? `R$ ${Number(r.valorBonus).toFixed(2)}` : "", r.status ?? "", r.createdByNome ?? ""]) },
    ];
    const html = buildPdfHtml("Movimentação do Mês — Completo", competencia, empresa, secoes);
    const win = window.open("", "_blank");
    if (!win) { toast.error("Bloqueio de pop-up detectado. Permita pop-ups para este site."); return; }
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
    toast.success("PDF completo pronto para impressão!");
  };

  return ("""

if OLD_BLOCK in content:
    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    print("Block 2 replaced OK")
else:
    print("ERROR: Block 2 not found")

with open("client/src/pages/MovimentacaoMes.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
