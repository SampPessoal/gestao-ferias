import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { PrivacyValue } from "@/components/PrivacyValue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Receipt, RefreshCw, Printer, Download, Search,
  Building2, TrendingDown, Wallet, Heart, Shield,
  ChevronDown, ChevronUp, Info, Layers, Umbrella,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const EMPRESAS = ["FREIRE", "JOANES", "SUDOESTE", "SOLAR"] as const;
type Empresa = typeof EMPRESAS[number];

const EMPRESA_CORES: Record<Empresa, string> = {
  FREIRE: "bg-blue-500",
  JOANES: "bg-zinc-500",
  SUDOESTE: "bg-stone-500",
  SOLAR: "bg-neutral-500",
};

function fmt(v: number | null | undefined) {
  const n = v == null || isNaN(Number(v)) ? 0 : Number(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasUteisDefault(mes: number, ano: number): number {
  let count = 0;
  const d = new Date(ano, mes - 1, 1);
  while (d.getMonth() === mes - 1) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

type FolhaRow = {
  id: number;
  colaboradorId: number;
  empresa: string;
  mes: number;
  ano: number;
  nomeColaborador?: string | null;
  setorNome?: string | null;
  setorId?: number | null;
  descontoVR: number;
  tipoDescontoVR: string;
  totalVRMes: number;
  descontoPlanoSaude: number;
  descontoSeguroVida: number;
  planoTitular?: string | null;
  mensalidadeTitular?: number | null;
  valorBasePlano?: number | null;
  subsidioEmpresa?: number | null;
  totalDependentes?: number | null;
  totalDescontos: number;
  diasFerias?: number | null;
  diasVendidosFerias?: number | null;
  observacao?: string | null;
  geradoEm?: Date | string | null;
};

// ─── Bloco de setor ─────────────────────────────────────────────────────────
function SetorBloco({
  setorNome, rows, onDetalhe, mesVRRef,
}: {
  setorNome: string;
  rows: FolhaRow[];
  onDetalhe: (r: FolhaRow) => void;
  mesVRRef: string;
}) {
  const totalSetor = rows.reduce((a, r) => a + (r.totalDescontos ?? 0), 0);
  return (
    <div className="space-y-1">
      {/* Cabeçalho do setor */}
      <div className="flex items-center gap-2 px-1 py-1">
        <Layers className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{setorNome}</span>
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          {rows.length} colab. · {fmt(totalSetor)}
        </span>
      </div>
      {/* Tabela do setor */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Colaborador</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs hidden md:table-cell">VR Total</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center justify-end gap-1 cursor-help">
                        Desc. VR <Info className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>VR ref. {mesVRRef} — 10% do total, R$1 fixo ou R$0 conforme regra</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center justify-end gap-1 cursor-help">
                        Plano Saúde <Info className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Titular: empresa subsidia 70% do Prata QC. Colaborador paga 30% do Prata QC + diferença se plano superior. Dependentes: 100% do valor da tabela.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center justify-end gap-1 cursor-help">
                        Seg. Vida <Info className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Valor mensal do seguro de vida descontado na folha</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center justify-center gap-1 cursor-help">
                        Férias <Info className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Dias gozados e dias vendidos (abono pecuniário) no mês</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
              <th className="text-right px-3 py-2 font-bold text-foreground text-xs">Total</th>
              <th className="text-center px-3 py-2 text-xs print:hidden w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-border/40 transition-colors hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/5"}`}
              >
                <td className="px-3 py-2.5 font-medium text-foreground text-sm">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block max-w-[200px] truncate cursor-default">{r.nomeColaborador}</span>
                      </TooltipTrigger>
                      <TooltipContent>{r.nomeColaborador}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground text-xs hidden md:table-cell">
                  {fmt(r.totalVRMes)}
                </td>
                <td className="px-3 py-2.5 text-right text-xs">
                  <span className="font-medium text-foreground">{fmt(r.descontoVR)}</span>
                  {r.tipoDescontoVR === "fixo1" && (
                    <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4">R$1</Badge>
                  )}
                  {r.tipoDescontoVR === "zero" && (
                    <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4 text-muted-foreground">isento</Badge>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-medium text-foreground">
                  {fmt(r.descontoPlanoSaude)}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-medium text-foreground">
                  {fmt(r.descontoSeguroVida)}
                </td>
                <td className="px-3 py-2.5 text-center text-xs">
                  {(r.diasFerias ?? 0) > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold text-blue-400">{r.diasFerias}d gozados</span>
                      {(r.diasVendidosFerias ?? 0) > 0 && (
                        <span className="text-[10px] text-blue-400">{r.diasVendidosFerias}d vendidos</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-xs">
                  <span
                    className="font-bold"
                    style={{ color: r.totalDescontos > 0 ? "oklch(0.75 0.15 80)" : undefined }}
                  >
                    {fmt(r.totalDescontos)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center print:hidden">
                  <Button
                    variant="ghost" size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onDetalhe(r)}
                  >
                    <Info className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border font-semibold text-xs">
                <td className="px-3 py-2 text-foreground" colSpan={2}>Subtotal {setorNome}</td>
                <td className="px-3 py-2 text-right text-foreground">
                  {fmt(rows.reduce((a, r) => a + (r.descontoVR ?? 0), 0))}
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {fmt(rows.reduce((a, r) => a + (r.descontoPlanoSaude ?? 0), 0))}
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {fmt(rows.reduce((a, r) => a + (r.descontoSeguroVida ?? 0), 0))}
                </td>
                <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                  {rows.filter(r => (r.diasFerias ?? 0) > 0).length > 0 && (
                    <span>{rows.filter(r => (r.diasFerias ?? 0) > 0).length} em férias</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: "oklch(0.75 0.15 80)" }}>
                  {fmt(rows.reduce((a, r) => a + (r.totalDescontos ?? 0), 0))}
                </td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Função de impressão por empresa ────────────────────────────────────────
function imprimirEmpresa(
  empresa: string,
  setores: { setorNome: string; rows: FolhaRow[] }[],
  mes: number,
  ano: number,
  mesVRRef: string,
) {
  const totalRows = setores.flatMap(s => s.rows);
  const fmtBRL = (v: number | null | undefined) => {
    const n = v == null || isNaN(Number(v)) ? 0 : Number(v);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };
  const MESES_NOMES = ["Janeiro","Fevereiro","Mar\u00e7o","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const mesNome = MESES_NOMES[mes - 1] ?? mes;

  const setoresHTML = setores.map(s => {
    const linhas = s.rows.map(r => `
      <tr>
        <td>${r.nomeColaborador ?? ""}</td>
        <td class="right">${fmtBRL(r.totalVRMes)}</td>
        <td class="right">${fmtBRL(r.descontoVR)}</td>
        <td class="right">${fmtBRL(r.descontoPlanoSaude)}</td>
        <td class="right">${fmtBRL(r.descontoSeguroVida)}</td>
        <td class="center">${(r.diasFerias ?? 0) > 0 ? `${r.diasFerias}d gozados${(r.diasVendidosFerias ?? 0) > 0 ? ` / ${r.diasVendidosFerias}d vendidos` : ""}` : "\u2014"}</td>
        <td class="right bold">${fmtBRL(r.totalDescontos)}</td>
      </tr>`).join("");
    const subtotalVR = s.rows.reduce((a, r) => a + (r.descontoVR ?? 0), 0);
    const subtotalPS = s.rows.reduce((a, r) => a + (r.descontoPlanoSaude ?? 0), 0);
    const subtotalSV = s.rows.reduce((a, r) => a + (r.descontoSeguroVida ?? 0), 0);
    const subtotalTotal = s.rows.reduce((a, r) => a + (r.totalDescontos ?? 0), 0);
    return `
      <tr class="setor-header"><td colspan="7">${s.setorNome}</td></tr>
      ${linhas}
      <tr class="subtotal">
        <td><em>Subtotal ${s.setorNome}</em></td>
        <td class="right">\u2014</td>
        <td class="right">${fmtBRL(subtotalVR)}</td>
        <td class="right">${fmtBRL(subtotalPS)}</td>
        <td class="right">${fmtBRL(subtotalSV)}</td>
        <td class="center">\u2014</td>
        <td class="right bold">${fmtBRL(subtotalTotal)}</td>
      </tr>`;
  }).join("");

  const totalVR = totalRows.reduce((a, r) => a + (r.descontoVR ?? 0), 0);
  const totalPS = totalRows.reduce((a, r) => a + (r.descontoPlanoSaude ?? 0), 0);
  const totalSV = totalRows.reduce((a, r) => a + (r.descontoSeguroVida ?? 0), 0);
  const totalGeral = totalRows.reduce((a, r) => a + (r.totalDescontos ?? 0), 0);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Folha ${mesNome}/${ano} \u2014 ${empresa}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
    h1 { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
    .subtitle { font-size: 11px; color: #555; margin-bottom: 16px; }
    .info-bar { display: flex; gap: 32px; background: #f5f5f5; border-radius: 6px; padding: 8px 14px; margin-bottom: 18px; font-size: 11px; }
    .info-bar .label { color: #666; font-size: 10px; }
    .info-bar .value { font-weight: bold; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a1a2e; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    tr.setor-header td { background: #e8e8e8; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 8px; }
    tr.subtotal td { background: #f0f0f0; font-style: italic; border-top: 1px solid #ccc; }
    tr.total-geral td { background: #1a1a2e; color: #fff; font-weight: bold; font-size: 12px; }
    td.bold { font-weight: bold; }
    .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: right; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Folha de Descontos \u2014 ${empresa}</h1>
  <p class="subtitle">Compet\u00eancia: ${mesNome}/${ano} &nbsp;\u2022&nbsp; VR de refer\u00eancia: ${mesVRRef} &nbsp;\u2022&nbsp; ${totalRows.length} colaboradores</p>
  <div class="info-bar">
    <div><div class="label">Desconto VR</div><div class="value">${fmtBRL(totalVR)}</div></div>
    <div><div class="label">Plano de Sa\u00fade</div><div class="value">${fmtBRL(totalPS)}</div></div>
    <div><div class="label">Seguro de Vida</div><div class="value">${fmtBRL(totalSV)}</div></div>
    <div><div class="label">Total Geral</div><div class="value" style="color:#b45309">${fmtBRL(totalGeral)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Colaborador</th>
        <th class="right">VR Total</th>
        <th class="right">Desc. VR</th>
        <th class="right">Plano Sa\u00fade</th>
        <th class="right">Seg. Vida</th>
        <th class="center">F\u00e9rias</th>
        <th class="right">Total Desc.</th>
      </tr>
    </thead>
    <tbody>
      ${setoresHTML}
      <tr class="total-geral">
        <td>TOTAL GERAL ${empresa}</td>
        <td class="right">\u2014</td>
        <td class="right">${fmtBRL(totalVR)}</td>
        <td class="right">${fmtBRL(totalPS)}</td>
        <td class="right">${fmtBRL(totalSV)}</td>
        <td class="center">\u2014</td>
        <td class="right">${fmtBRL(totalGeral)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} \u2022 GestãoFérias RH</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ─── Bloco de empresa ────────────────────────────────────────────────────────
function EmpresaBloco({
  empresa, setores, resumoEmp, expandido, onToggle, onGerar, gerandoEmpresa, gerandoPending, onDetalhe, mesVRRef, mes, ano,
}: {
  empresa: Empresa;
  setores: { setorNome: string; rows: FolhaRow[] }[];
  resumoEmp: any;
  expandido: boolean;
  onToggle: () => void;
  onGerar: () => void;
  gerandoEmpresa: Empresa | null;
  gerandoPending: boolean;
  onDetalhe: (r: FolhaRow) => void;
  mesVRRef: string;
  mes: number;
  ano: number;
}) {
  const totalRows = setores.flatMap(s => s.rows);
  const totalDescontos = totalRows.reduce((a, r) => a + (r.totalDescontos ?? 0), 0);

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      border: "1px solid oklch(0.25 0.09 252)",
      boxShadow: "0 2px 8px oklch(0.22 0.08 250 / 0.07)",
    }}>
      {/* Header empresa */}
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer select-none print:cursor-default"
        style={{ background: "linear-gradient(135deg, oklch(0.14 0.07 254), oklch(0.17 0.015 240))" }}
        onClick={onToggle}
      >
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${EMPRESA_CORES[empresa]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">{empresa}</p>
          <p className="text-xs mt-0.5" style={{ color: "oklch(0.60 0.008 240)" }}>
            {totalRows.length} colaboradores
          </p>
        </div>
        {/* Totais resumidos */}
        <div className="hidden sm:flex items-center gap-6 mr-4">
          {resumoEmp && (
            <>
              <div className="text-right">
                <p className="text-[10px] text-white/50">VR</p>
                <p className="text-sm font-semibold text-white/80">{fmt(resumoEmp.totalDescontoVR)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/50">Plano Saúde</p>
                <p className="text-sm font-semibold text-white/80">{fmt(resumoEmp.totalDescontoPS)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/50">Seg. Vida</p>
                <p className="text-sm font-semibold text-white/80">{fmt(resumoEmp.totalDescontoSV ?? 0)}</p>
              </div>
            </>
          )}
          <div className="text-right">
            <p className="text-[10px] text-white/50">Total</p>
            <p className="text-base font-bold" style={{ color: "oklch(0.75 0.15 80)" }}>{fmt(totalDescontos)}</p>
          </div>
        </div>
        {/* Botão gerar */}
        <Button
          size="sm" variant="outline"
          className="border-white/20 text-white hover:bg-white/10 bg-transparent text-xs h-7 print:hidden shrink-0"
          disabled={gerandoPending}
          onClick={e => { e.stopPropagation(); onGerar(); }}
        >
          {gerandoEmpresa === empresa ? <Spinner className="w-3 h-3 mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Gerar
        </Button>
        {totalRows.length > 0 && (
          <Button
            size="sm" variant="outline"
            className="border-white/20 text-white hover:bg-white/10 bg-transparent text-xs h-7 print:hidden shrink-0"
            onClick={e => { e.stopPropagation(); imprimirEmpresa(empresa, setores, mes, ano, mesVRRef); }}
          >
            <Printer className="w-3 h-3 mr-1" />
            Imprimir
          </Button>
        )}
        <div className="print:hidden shrink-0">
          {expandido ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </div>
      </div>

      {/* Setores */}
      {expandido && (
        <div className="bg-background p-4 space-y-5">
          {setores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum colaborador. Clique em "Gerar" para calcular.
            </p>
          ) : (
            setores.map(s => (
              <SetorBloco key={s.setorNome} setorNome={s.setorNome} rows={s.rows} onDetalhe={onDetalhe} mesVRRef={mesVRRef} />
            ))
          )}
          {/* Total da empresa */}
          {totalRows.length > 0 && (
            <div className="flex justify-end">
              <div
                className="rounded-xl px-5 py-3 flex items-center gap-6"
                style={{ background: "oklch(0.13 0.01 260)" }}
              >
                <div className="text-center">
                  <p className="text-[10px] text-white/50">VR</p>
                  <p className="text-sm font-bold text-white">{fmt(totalRows.reduce((a, r) => a + (r.descontoVR ?? 0), 0))}</p>
                </div>
                <Separator orientation="vertical" className="h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] text-white/50">Plano Saúde</p>
                  <p className="text-sm font-bold text-white">{fmt(totalRows.reduce((a, r) => a + (r.descontoPlanoSaude ?? 0), 0))}</p>
                </div>
                <Separator orientation="vertical" className="h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] text-white/50">Seg. Vida</p>
                  <p className="text-sm font-bold text-white">{fmt(totalRows.reduce((a, r) => a + (r.descontoSeguroVida ?? 0), 0))}</p>
                </div>
                <Separator orientation="vertical" className="h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-[10px] text-white/50">Total {empresa}</p>
                  <p className="text-base font-bold" style={{ color: "oklch(0.75 0.15 80)" }}>{fmt(totalDescontos)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function FolhaMes() {
  // Folha de agosto/2026 (folha de julho já foi paga)
  const [mes, setMes] = useState(8);
  const [ano, setAno] = useState(2026);
  const [empresaFiltro, setEmpresaFiltro] = useState<Empresa | "TODAS">("TODAS");
  const [busca, setBusca] = useState("");
  const [diasUteis, setDiasUteis] = useState(21); // agosto/2026 tem 21 dias úteis
  const [gerandoEmpresa, setGerandoEmpresa] = useState<Empresa | null>(null);
  const [expandidoEmpresa, setExpandidoEmpresa] = useState<Record<string, boolean>>({});
  const [modalDetalhe, setModalDetalhe] = useState<FolhaRow | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: folha = [], isLoading: loadingFolha, refetch } = trpc.folhaMes.list.useQuery({
    mes, ano,
    empresa: empresaFiltro !== "TODAS" ? empresaFiltro : undefined,
  });
  const { data: resumo = [], refetch: refetchResumo } = trpc.folhaMes.resumo.useQuery({ mes, ano });

  const gerarMutation = trpc.folhaMes.gerar.useMutation({
    onSuccess: (data) => {
      toast.success(`Folha gerada: ${data.gerados} colaboradores processados${data.erros > 0 ? `, ${data.erros} erros` : ""}`);
      refetch();
      refetchResumo();
      setGerandoEmpresa(null);
    },
    onError: (e) => {
      toast.error("Erro ao gerar folha: " + e.message);
      setGerandoEmpresa(null);
    },
  });

  function handleGerar(empresa: Empresa) {
    setGerandoEmpresa(empresa);
    gerarMutation.mutate({ mes, ano, empresa, diasUteis });
  }

  function handleGerarTodas() {
    const empresas = [...EMPRESAS];
    let idx = 0;
    function next() {
      if (idx >= empresas.length) return;
      const emp = empresas[idx++];
      setGerandoEmpresa(emp);
      gerarMutation.mutate({ mes, ano, empresa: emp, diasUteis }, { onSettled: () => next() });
    }
    next();
  }

  // Filtrar por busca
  const folhaFiltrada = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return (folha as FolhaRow[]).filter(r =>
      !q || r.nomeColaborador?.toLowerCase().includes(q) ||
      r.setorNome?.toLowerCase().includes(q)
    );
  }, [folha, busca]);

  // Agrupar: empresa → setor → colaboradores
  const agrupado = useMemo(() => {
    const empMap = new Map<string, Map<string, FolhaRow[]>>();
    for (const r of folhaFiltrada) {
      if (!empMap.has(r.empresa)) empMap.set(r.empresa, new Map());
      const setorKey = r.setorNome ?? "Sem Setor";
      const setorMap = empMap.get(r.empresa)!;
      if (!setorMap.has(setorKey)) setorMap.set(setorKey, []);
      setorMap.get(setorKey)!.push(r);
    }
    return Array.from(empMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([empresa, setorMap]) => ({
        empresa: empresa as Empresa,
        setores: Array.from(setorMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([setorNome, rows]) => ({
            setorNome,
            rows: rows.sort((a, b) => (a.nomeColaborador ?? "").localeCompare(b.nomeColaborador ?? "")),
          })),
      }));
  }, [folhaFiltrada]);

  const totalGeral = useMemo(() => resumo.reduce((acc, r) => acc + r.totalDescontos, 0), [resumo]);
  const totalVR = useMemo(() => resumo.reduce((acc, r) => acc + r.totalDescontoVR, 0), [resumo]);
  const totalPS = useMemo(() => resumo.reduce((acc, r) => acc + r.totalDescontoPS, 0), [resumo]);
  const totalSV = useMemo(() => resumo.reduce((acc, r) => acc + ((r as any).totalDescontoSV ?? 0), 0), [resumo]);
  // Mês de referência do VR (mês anterior à folha)
  const mesVRRef = useMemo(() => {
    const primeiro = (folha as FolhaRow[])[0];
    if (primeiro && (primeiro as any).mesVRReferencia) {
      const m = (primeiro as any).mesVRReferencia as number;
      const a = (primeiro as any).anoVRReferencia as number;
      return `${MESES[m - 1]}/${a}`;
    }
    // fallback: calcular do mês selecionado
    const mRef = mes === 1 ? 12 : mes - 1;
    const aRef = mes === 1 ? ano - 1 : ano;
    return `${MESES[mRef - 1]}/${aRef}`;
  }, [folha, mes, ano]);

  function handlePrint() {
    const nomeMes = MESES[mes - 1];
    const empresasParaImprimir = empresaFiltro === "TODAS" ? [...EMPRESAS] : [empresaFiltro];
    const fmtBRL = (v: number | null | undefined) => {
      const n = v == null || isNaN(Number(v)) ? 0 : Number(v);
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const blocosHTML = empresasParaImprimir.map(empresa => {
      const grupoEmp = agrupado.find(g => g.empresa === empresa);
      const setores = grupoEmp?.setores ?? [];
      const totalRows = setores.flatMap(s => s.rows);
      if (totalRows.length === 0) return "";

      const totalVRDesc = totalRows.reduce((a, r) => a + (r.descontoVR ?? 0), 0);
      const totalPS = totalRows.reduce((a, r) => a + (r.descontoPlanoSaude ?? 0), 0);
      const totalSV = totalRows.reduce((a, r) => a + (r.descontoSeguroVida ?? 0), 0);
      const totalGeral = totalRows.reduce((a, r) => a + (r.totalDescontos ?? 0), 0);

      const setoresHTML = setores.map(s => {
        const linhas = s.rows.map(r => `
          <tr>
            <td>${r.nomeColaborador ?? ""}</td>
            <td class="right">${fmtBRL(r.totalVRMes)}</td>
            <td class="right">${fmtBRL(r.descontoVR)}</td>
            <td class="right">${fmtBRL(r.descontoPlanoSaude)}</td>
            <td class="right">${fmtBRL(r.descontoSeguroVida)}</td>
            <td class="center">${(r.diasFerias ?? 0) > 0 ? `${r.diasFerias}d${(r.diasVendidosFerias ?? 0) > 0 ? ` +${r.diasVendidosFerias}v` : ""}` : "\u2014"}</td>
            <td class="right bold">${fmtBRL(r.totalDescontos)}</td>
          </tr>`).join("");
        const stVR = s.rows.reduce((a, r) => a + (r.descontoVR ?? 0), 0);
        const stPS = s.rows.reduce((a, r) => a + (r.descontoPlanoSaude ?? 0), 0);
        const stSV = s.rows.reduce((a, r) => a + (r.descontoSeguroVida ?? 0), 0);
        const stTotal = s.rows.reduce((a, r) => a + (r.totalDescontos ?? 0), 0);
        return `
          <tr class="setor-header"><td colspan="7">${s.setorNome}</td></tr>
          ${linhas}
          <tr class="subtotal">
            <td><em>Subtotal ${s.setorNome}</em></td>
            <td class="right">\u2014</td>
            <td class="right">${fmtBRL(stVR)}</td>
            <td class="right">${fmtBRL(stPS)}</td>
            <td class="right">${fmtBRL(stSV)}</td>
            <td class="center">\u2014</td>
            <td class="right bold">${fmtBRL(stTotal)}</td>
          </tr>`;
      }).join("");

      return `
        <div class="empresa-bloco">
          <h2>${empresa}</h2>
          <p class="subtitle">Compet\u00eancia: ${nomeMes}/${ano} \u2022 VR ref.: ${mesVRRef} \u2022 ${totalRows.length} colaboradores</p>
          <div class="info-bar">
            <div><div class="label">Desconto VR</div><div class="value">${fmtBRL(totalVRDesc)}</div></div>
            <div><div class="label">Plano de Sa\u00fade</div><div class="value">${fmtBRL(totalPS)}</div></div>
            <div><div class="label">Seguro de Vida</div><div class="value">${fmtBRL(totalSV)}</div></div>
            <div><div class="label">Total Geral</div><div class="value highlight">${fmtBRL(totalGeral)}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th class="right">VR Total</th>
                <th class="right">Desc. VR</th>
                <th class="right">Plano Sa\u00fade</th>
                <th class="right">Seg. Vida</th>
                <th class="center">F\u00e9rias</th>
                <th class="right">Total Desc.</th>
              </tr>
            </thead>
            <tbody>
              ${setoresHTML}
              <tr class="total-geral">
                <td>TOTAL ${empresa}</td>
                <td class="right">\u2014</td>
                <td class="right">${fmtBRL(totalVRDesc)}</td>
                <td class="right">${fmtBRL(totalPS)}</td>
                <td class="right">${fmtBRL(totalSV)}</td>
                <td class="center">\u2014</td>
                <td class="right">${fmtBRL(totalGeral)}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} \u2022 Gest\u00e3oF\u00e9rias RH</div>
        </div>`;
    }).filter(Boolean).join("");

    if (!blocosHTML) {
      toast.error("Nenhum dado para imprimir. Gere a folha primeiro.");
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Folha do M\u00eas \u2014 ${nomeMes}/${ano}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
    h2 { font-size: 16px; font-weight: bold; margin-bottom: 2px; color: #1a1a2e; }
    .subtitle { font-size: 11px; color: #555; margin-bottom: 12px; }
    .info-bar { display: flex; gap: 32px; background: #f5f5f5; border-radius: 6px; padding: 8px 14px; margin-bottom: 16px; font-size: 11px; }
    .info-bar .label { color: #666; font-size: 10px; }
    .info-bar .value { font-weight: bold; font-size: 13px; }
    .info-bar .value.highlight { color: #b45309; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a1a2e; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    tr.setor-header td { background: #e8e8e8; font-weight: bold; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; padding: 4px 8px; }
    tr.subtotal td { background: #f0f0f0; font-style: italic; border-top: 1px solid #ccc; }
    tr.total-geral td { background: #1a1a2e; color: #fff; font-weight: bold; font-size: 12px; }
    td.bold { font-weight: bold; }
    .footer { margin-top: 16px; font-size: 10px; color: #888; text-align: right; }
    .empresa-bloco { margin-bottom: 40px; }
    @media print {
      body { padding: 10px; }
      .empresa-bloco { page-break-after: always; margin-bottom: 0; }
      .empresa-bloco:last-child { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  ${blocosHTML}
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=960,height=800");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      toast.error("Bloqueador de pop-up ativo. Permita pop-ups para este site e tente novamente.");
    }
  }

  function handleExportExcel() {
    const header = [
      "Colaborador", "Empresa", "Setor",
      "VR Total", "Desconto VR", "Tipo VR",
      "Desconto Plano Saúde", "Desconto Seguro Vida",
      "Férias (dias gozados)", "Férias (dias vendidos)",
      "Total Descontos", "Plano", "Observação",
    ];
    const rows = folhaFiltrada.map(r => [
      r.nomeColaborador ?? "",
      r.empresa,
      r.setorNome ?? "",
      String(r.totalVRMes ?? 0),
      String(r.descontoVR ?? 0),
      r.tipoDescontoVR === "pct10" ? "10%" : r.tipoDescontoVR === "fixo1" ? "R$1" : "R$0",
      String(r.descontoPlanoSaude ?? 0),
      String(r.descontoSeguroVida ?? 0),
      String(r.diasFerias ?? 0),
      String(r.diasVendidosFerias ?? 0),
      String(r.totalDescontos ?? 0),
      r.planoTitular ?? "",
      r.observacao ?? "",
    ]);
    const csv = [header, ...rows].map(row => row.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folha-mes-${mes.toString().padStart(2, "0")}-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const empresasExibir = empresaFiltro === "TODAS" ? EMPRESAS : [empresaFiltro];

  return (
    <div className="min-h-screen bg-background" ref={printRef}>
      {/* Header */}
      <div
        className="relative overflow-hidden print:hidden"
        style={{ background: "linear-gradient(135deg, oklch(0.13 0.01 260) 0%, oklch(0.17 0.015 260) 100%)" }}
      >
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, oklch(0.7 0.15 80) 0%, transparent 50%), radial-gradient(circle at 80% 50%, oklch(0.5 0.1 260) 0%, transparent 50%)",
        }} />
        <div className="relative px-6 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg, oklch(0.75 0.15 80), oklch(0.65 0.18 60))" }}>
                <Receipt className="w-7 h-7 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Folha do Mês</h1>
                <p className="text-sm mt-0.5" style={{ color: "oklch(0.65 0.05 260)" }}>
                  Descontos consolidados por colaborador — VR · Plano de Saúde · Seguro de Vida
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handlePrint}
                className="border-white/20 text-white hover:bg-white/10 bg-transparent">
                <Printer className="w-4 h-4 mr-2" />Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}
                className="border-white/20 text-white hover:bg-white/10 bg-transparent">
                <Download className="w-4 h-4 mr-2" />Exportar Excel
              </Button>
            </div>
          </div>

          {/* Controles */}
          <div className="mt-6 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/60 font-medium">Mês</span>
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger className="w-36 bg-white/10 border-white/20 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/60 font-medium">Ano</span>
              <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
                <SelectTrigger className="w-28 bg-white/10 border-white/20 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/60 font-medium">Dias Úteis</span>
              <Input
                type="number" min={1} max={31} value={diasUteis}
                onChange={e => setDiasUteis(Number(e.target.value))}
                className="w-20 bg-white/10 border-white/20 text-white h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-white/60 font-medium">Empresa</span>
              <Select value={empresaFiltro} onValueChange={v => setEmpresaFiltro(v as any)}>
                <SelectTrigger className="w-52 bg-white/10 border-white/20 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGerarTodas}
              disabled={gerarMutation.isPending}
              className="h-9 font-semibold"
              style={{ background: "linear-gradient(135deg, oklch(0.75 0.15 80), oklch(0.65 0.18 60))", color: "black" }}
            >
              {gerarMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Gerar Folha
            </Button>
          </div>
          {/* Badge de referência VR */}
          <div className="mt-4 flex items-center gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: "oklch(0.22 0.04 80 / 0.7)", border: "1px solid oklch(0.75 0.15 80 / 0.4)", color: "oklch(0.85 0.12 80)" }}
            >
              <Wallet className="w-3.5 h-3.5" />
              VR de referência: <span className="font-bold">{mesVRRef}</span>
            </div>
            <span className="text-xs text-white/40">
              (folha de {MESES[mes - 1]}/{ano} usa a planilha de VR de {mesVRRef})
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          <Card className="border-0 shadow-sm" style={{ background: "oklch(0.13 0.01 260)", color: "white" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4" style={{ color: "oklch(0.75 0.15 80)" }} />
                <span className="text-xs text-white/60">Total Descontos</span>
              </div>
              <p className="text-xl font-bold" style={{ color: "oklch(0.75 0.15 80)" }}><PrivacyValue value={fmt(totalGeral)} iconSize={13} /></p>
              <p className="text-xs text-white/40 mt-0.5">{MESES[mes - 1]} {ano}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Desconto VR</span>
              </div>
              <p className="text-xl font-bold text-foreground"><PrivacyValue value={fmt(totalVR)} iconSize={13} /></p>
              <p className="text-xs text-muted-foreground mt-0.5">Ref. {mesVRRef}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Plano de Saúde</span>
              </div>
              <p className="text-xl font-bold text-foreground"><PrivacyValue value={fmt(totalPS)} iconSize={13} /></p>
              <p className="text-xs text-muted-foreground mt-0.5">Titulares + Dependentes</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Seguro de Vida</span>
              </div>
              <p className="text-xl font-bold text-foreground"><PrivacyValue value={fmt(totalSV)} iconSize={13} /></p>
              <p className="text-xs text-muted-foreground mt-0.5">{folha.length} colaboradores</p>
            </CardContent>
          </Card>
        </div>

        {/* Barra de busca */}
        <div className="flex items-center gap-3 print:hidden">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador ou setor..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Estado vazio */}
        {!loadingFolha && folha.length === 0 && (
          <Card className="border-dashed border-2 border-muted">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Receipt className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-base font-medium text-muted-foreground">
                Nenhuma folha gerada para {MESES[mes - 1]} {ano}
              </p>
              <p className="text-sm text-muted-foreground/70">
                Clique em "Gerar Folha" para calcular os descontos automaticamente
              </p>
            </CardContent>
          </Card>
        )}

        {loadingFolha && (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-8 h-8" />
          </div>
        )}

        {/* Blocos por empresa */}
        {!loadingFolha && empresasExibir.map(empresa => {
          const grupoEmp = agrupado.find(g => g.empresa === empresa);
          const setores = grupoEmp?.setores ?? [];
          const resumoEmp = resumo.find(r => r.empresa === empresa);
          const expandido = expandidoEmpresa[empresa] !== false;

          return (
            <EmpresaBloco
              key={empresa}
              empresa={empresa}
              setores={setores}
              resumoEmp={resumoEmp}
              expandido={expandido}
              onToggle={() => setExpandidoEmpresa(prev => ({ ...prev, [empresa]: !expandido }))}
              onGerar={() => handleGerar(empresa)}
              gerandoEmpresa={gerandoEmpresa}
              gerandoPending={gerarMutation.isPending}
              onDetalhe={setModalDetalhe}
              mesVRRef={mesVRRef}
              mes={mes}
              ano={ano}
            />
          );
        })}

        {/* Total geral */}
        {folha.length > 0 && (
          <div className="flex justify-end print:block">
            <div className="rounded-xl px-6 py-4 flex items-center gap-6 flex-wrap"
              style={{ background: "oklch(0.13 0.01 260)" }}>
              <div className="text-center">
                <p className="text-xs text-white/50">Total VR</p>
                <p className="text-lg font-bold text-white"><PrivacyValue value={fmt(totalVR)} iconSize={13} /></p>
              </div>
              <Separator orientation="vertical" className="h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-white/50">Total Plano Saúde</p>
                <p className="text-lg font-bold text-white"><PrivacyValue value={fmt(totalPS)} iconSize={13} /></p>
              </div>
              <Separator orientation="vertical" className="h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-white/50">Total Seguro Vida</p>
                <p className="text-lg font-bold text-white"><PrivacyValue value={fmt(totalSV)} iconSize={13} /></p>
              </div>
              <Separator orientation="vertical" className="h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-white/50">Total Geral de Descontos</p>
                <p className="text-2xl font-bold" style={{ color: "oklch(0.75 0.15 80)" }}><PrivacyValue value={fmt(totalGeral)} iconSize={14} /></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalhe */}
      <Dialog open={!!modalDetalhe} onOpenChange={() => setModalDetalhe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {modalDetalhe?.nomeColaborador}
            </DialogTitle>
          </DialogHeader>
          {modalDetalhe && (
            <div className="space-y-3 text-sm">
              {/* VR */}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Vale Refeição
                </p>
                <div className="flex justify-between text-muted-foreground">
                  <span>VR total do mês</span>
                  <span className="font-medium text-foreground">{fmt(modalDetalhe.totalVRMes)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tipo de desconto</span>
                  <Badge variant="outline" className="text-xs">
                    {modalDetalhe.tipoDescontoVR === "pct10" ? "10%" :
                      modalDetalhe.tipoDescontoVR === "fixo1" ? "R$ 1,00 fixo" : "Isento (R$ 0,00)"}
                  </Badge>
                </div>
                <div className="flex justify-between font-semibold border-t border-border pt-2">
                  <span>Desconto VR</span>
                  <span style={{ color: "oklch(0.75 0.15 80)" }}>{fmt(modalDetalhe.descontoVR)}</span>
                </div>
              </div>

              {/* Plano de Saúde */}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Plano de Saúde
                </p>
                {modalDetalhe.planoTitular ? (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Plano do titular</span>
                      <span className="font-medium text-foreground text-xs">{modalDetalhe.planoTitular}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Mensalidade titular</span>
                      <span>{fmt(modalDetalhe.mensalidadeTitular)}</span>
                    </div>
                    {(modalDetalhe.valorBasePlano ?? 0) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Prata QC (base subsídio)</span>
                        <span>{fmt(modalDetalhe.valorBasePlano)}</span>
                      </div>
                    )}
                    {(modalDetalhe.subsidioEmpresa ?? 0) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subsídio empresa (70%)</span>
                        <span className="text-blue-600">− {fmt(modalDetalhe.subsidioEmpresa)}</span>
                      </div>
                    )}
                    {(modalDetalhe.totalDependentes ?? 0) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Dependentes (100%)</span>
                        <span>{fmt(modalDetalhe.totalDependentes)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">Sem plano de saúde cadastrado</p>
                )}
                <div className="flex justify-between font-semibold border-t border-border pt-2">
                  <span>Desconto Plano Saúde</span>
                  <span style={{ color: "oklch(0.75 0.15 80)" }}>{fmt(modalDetalhe.descontoPlanoSaude)}</span>
                </div>
              </div>

              {/* Seguro de Vida */}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Seguro de Vida
                </p>
                <div className="flex justify-between font-semibold">
                  <span>Desconto Seguro de Vida</span>
                  <span style={{ color: "oklch(0.75 0.15 80)" }}>{fmt(modalDetalhe.descontoSeguroVida)}</span>
                </div>
              </div>

              {/* Férias */}
              {(modalDetalhe.diasFerias ?? 0) > 0 && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
                  <p className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Umbrella className="w-4 h-4 text-blue-400" /> Férias no Mês
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dias gozados</span>
                    <span className="font-semibold text-blue-400">{modalDetalhe.diasFerias} dias</span>
                  </div>
                  {(modalDetalhe.diasVendidosFerias ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dias vendidos (abono pecuniário)</span>
                      <span className="font-semibold text-blue-400">{modalDetalhe.diasVendidosFerias} dias</span>
                    </div>
                  )}
                </div>
              )}
              {/* Total */}
              <div className="rounded-lg p-4 flex justify-between items-center font-bold text-base"
                style={{ background: "oklch(0.13 0.01 260)" }}>
                <span className="text-white">Total de Descontos</span>
                <span style={{ color: "oklch(0.75 0.15 80)" }}>{fmt(modalDetalhe.totalDescontos)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
