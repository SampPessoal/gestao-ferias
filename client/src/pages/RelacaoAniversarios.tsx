import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";
import { Cake, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomeEmpresa = (e: string) => (e ? e.charAt(0) + e.slice(1).toLowerCase() : "—");
const doisDigitos = (n: number) => String(n).padStart(2, "0");

type Aniversariante = { id: number; nome: string; dataNascimento: string; dia: number; anoNascimento: number; empresa: string; setor: string };

export default function RelacaoAniversarios() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [empresa, setEmpresa] = useState("todas");
  const [busca, setBusca] = useState("");

  const { data = [], isLoading } = trpc.aniversariantes.useQuery({ mes });
  const lista = data as Aniversariante[];

  const empresas = useMemo(() => Array.from(new Set(lista.map((a) => a.empresa).filter(Boolean))).sort(), [lista]);
  const filtrada = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return lista.filter((a) => (empresa === "todas" || a.empresa === empresa) && (!b || a.nome.toUpperCase().includes(b)));
  }, [lista, empresa, busca]);

  // Situação de cada aniversário em relação a hoje (só faz sentido no mês/ano corrente)
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diasAte = (dia: number) => Math.round((new Date(ano, mes - 1, dia).getTime() - hojeZero.getTime()) / 86400000);
  const situacao = (dia: number): "hoje" | "proximo" | "passou" | "futuro" => {
    const d = diasAte(dia);
    if (d === 0) return "hoje";
    if (d < 0) return "passou";
    if (d <= 7) return "proximo";
    return "futuro";
  };
  const qtdHoje = filtrada.filter((a) => situacao(a.dia) === "hoje").length;
  const qtdProx = filtrada.filter((a) => situacao(a.dia) === "proximo").length;
  const ehMesAtual = mes === hoje.getMonth() + 1 && ano === hoje.getFullYear();

  const mudarMes = (delta: number) => {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAno(a);
  };

  const exportar = () => {
    const linhas = filtrada.map((a) => ({
      Dia: `${doisDigitos(a.dia)}/${doisDigitos(mes)}`,
      Nome: a.nome,
      Completa: `${ano - a.anoNascimento} anos`,
      Empresa: nomeEmpresa(a.empresa),
      Setor: a.setor,
    }));
    const ws = XLSX.utils.json_to_sheet(linhas); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aniversários");
    XLSX.writeFile(wb, `aniversarios_${MESES[mes - 1].toLowerCase()}_${ano}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="rounded-2xl overflow-hidden" style={{
        background: "linear-gradient(135deg, oklch(0.14 0.07 254) 0%, oklch(0.17 0.015 240) 100%)",
        border: "1px solid oklch(0.25 0.09 252)", boxShadow: "0 4px 24px oklch(0.22 0.08 250 / 0.18)",
      }}>
        <div className="px-7 py-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{
            background: "linear-gradient(135deg, oklch(0.60 0.17 15), oklch(0.52 0.18 5))", boxShadow: "0 4px 12px oklch(0.50 0.17 10 / 0.30)",
          }}>
            <Cake className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Relação de Aniversários</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.65 0.008 240)" }}>Aniversariantes do mês, em ordem de dia</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-[150px] text-center font-semibold">{MESES[mes - 1]} {ano}</span>
        <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight className="h-4 w-4" /></Button>
        {!ehMesAtual && (
          <Button variant="ghost" size="sm" onClick={() => { setMes(hoje.getMonth() + 1); setAno(hoje.getFullYear()); }}>Mês atual</Button>
        )}
        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {empresas.map((e) => <SelectItem key={e} value={e}>{nomeEmpresa(e)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportar} disabled={!filtrada.length}>
          <Download className="w-4 h-4 mr-1" />Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Aniversariantes no mês</p>
          <p className="text-2xl font-bold mt-1">{filtrada.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Hoje ({doisDigitos(hoje.getDate())}/{doisDigitos(hoje.getMonth() + 1)})</p>
          <p className="text-2xl font-bold mt-1">{ehMesAtual ? qtdHoje : "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
          <p className="text-2xl font-bold mt-1">{qtdProx}</p>
        </CardContent></Card>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> : filtrada.length === 0 ? (
          <CardContent className="py-10 text-center text-muted-foreground">Nenhum aniversariante em {MESES[mes - 1].toLowerCase()}{busca || empresa !== "todas" ? " com esse filtro" : ""}.</CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Dia</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Completa</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Setor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrada.map((a) => {
                  const s = situacao(a.dia);
                  const d = diasAte(a.dia);
                  const passou = s === "passou";
                  return (
                    <TableRow key={a.id} className={s === "hoje" ? "bg-rose-50 dark:bg-rose-950/30" : passou ? "text-muted-foreground" : ""}>
                      <TableCell>
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                          s === "hoje" ? "bg-rose-500 text-white" : s === "proximo" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200" : "bg-muted"}`}>
                          {doisDigitos(a.dia)}
                        </span>
                      </TableCell>
                      <TableCell className={passou ? "" : "font-medium"}>
                        {a.nome}
                        {s === "hoje" && <Badge className="ml-2 bg-rose-500 hover:bg-rose-500">Hoje 🎂</Badge>}
                        {s === "proximo" && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">em {d} dia{d > 1 ? "s" : ""}</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{ano - a.anoNascimento} anos</TableCell>
                      <TableCell>{nomeEmpresa(a.empresa)}</TableCell>
                      <TableCell>{a.setor || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
