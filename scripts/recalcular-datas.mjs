/**
 * Script de recálculo de período aquisitivo, vencimento e dataLimite
 * para todos os colaboradores ativos.
 *
 * Regra CLT:
 *   - Período aquisitivo: começa na admissão, dura 1 ano
 *   - Vencimento: data em que o colaborador pode tirar férias (admissão + N anos completos)
 *   - Data limite: vencimento + 3 meses (prazo máximo para gozar)
 *
 * O script calcula o período aquisitivo ATUAL com base em hoje:
 *   - Encontra o aniversário de admissão mais recente que já passou
 *   - Esse é o início do período aquisitivo atual
 *   - Vencimento = início do período atual + 1 ano
 *   - Data limite = vencimento + 3 meses
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não encontrada.");
  process.exit(1);
}

// Parseia a URL do banco
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: u.username,
    password: u.password,
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  };
}

function toIsoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Dado a data de admissão e a data de hoje, calcula:
 * - periodoAquisitivo: início do período atual (aniversário mais recente)
 * - vencimento: fim do período atual / início do gozo (periodoAquisitivo + 1 ano)
 * - dataLimite: prazo máximo CLT (vencimento + 3 meses)
 */
function calcularDatas(admissaoStr, hojeStr) {
  const [ay, am, ad] = admissaoStr.split("-").map(Number);
  const [hy, hm, hd] = hojeStr.split("-").map(Number);

  // Quantos anos completos desde a admissão
  let anosCompletos = hy - ay;
  if (hm < am || (hm === am && hd < ad)) {
    anosCompletos--;
  }
  if (anosCompletos < 0) anosCompletos = 0;

  // Período aquisitivo atual = admissão + anosCompletos
  const paYear = ay + anosCompletos;
  const periodoAquisitivo = new Date(Date.UTC(paYear, am - 1, ad, 12, 0, 0));

  // Vencimento = periodoAquisitivo + 1 ano
  const vencimento = new Date(Date.UTC(paYear + 1, am - 1, ad, 12, 0, 0));

  // Data limite = vencimento + 3 meses
  const dataLimite = new Date(Date.UTC(paYear + 1, am - 1 + 3, ad, 12, 0, 0));

  return {
    periodoAquisitivo: toIsoDate(periodoAquisitivo),
    vencimento: toIsoDate(vencimento),
    dataLimite: toIsoDate(dataLimite),
  };
}

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DATABASE_URL));
  console.log("Conectado ao banco.");

  // Busca todos os colaboradores ativos com admissão preenchida
  const [rows] = await conn.execute(
    `SELECT id, nome, DATE(admissao) as admissao, DATE(periodoAquisitivo) as periodoAquisitivo,
            DATE(vencimento) as vencimento, DATE(dataLimite) as dataLimite, saldo, diasDireito
     FROM colaboradores WHERE status = 'ativo' AND admissao IS NOT NULL`
  );

  const hoje = new Date();
  const hojeStr = toIsoDate(hoje);
  console.log(`Hoje: ${hojeStr}`);
  console.log(`Colaboradores ativos com admissão: ${rows.length}`);

  let atualizados = 0;
  let erros = 0;

  for (const row of rows) {
    try {
      const admStr = String(row.admissao).split("T")[0];
      if (!admStr || admStr === "null") continue;

      const { periodoAquisitivo, vencimento, dataLimite } = calcularDatas(admStr, hojeStr);

      const paAtual = row.periodoAquisitivo ? String(row.periodoAquisitivo).split("T")[0] : null;
      const vencAtual = row.vencimento ? String(row.vencimento).split("T")[0] : null;
      const limiteAtual = row.dataLimite ? String(row.dataLimite).split("T")[0] : null;

      const mudou = paAtual !== periodoAquisitivo || vencAtual !== vencimento || limiteAtual !== dataLimite;

      if (mudou) {
        await conn.execute(
          `UPDATE colaboradores SET periodoAquisitivo = ?, vencimento = ?, dataLimite = ? WHERE id = ?`,
          [periodoAquisitivo, vencimento, dataLimite, row.id]
        );
        console.log(`[${row.id}] ${row.nome}`);
        console.log(`  admissão: ${admStr}`);
        console.log(`  periodoAquisitivo: ${paAtual} -> ${periodoAquisitivo}`);
        console.log(`  vencimento:        ${vencAtual} -> ${vencimento}`);
        console.log(`  dataLimite:        ${limiteAtual} -> ${dataLimite}`);
        atualizados++;
      }
    } catch (e) {
      console.error(`Erro no colaborador ${row.id} (${row.nome}):`, e.message);
      erros++;
    }
  }

  console.log(`\nConcluído: ${atualizados} atualizados, ${erros} erros.`);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
