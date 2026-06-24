/**
 * Propone el CODIGO correcto para los productos de Sanity cuyo `sku` quedó basura
 * tras el import de Wix (los 113 "sin match" del sync Sheet→Sanity).
 *
 * Estrategia: cruza el `name` de cada producto sin match contra la `DESCRIPCION`
 * de la planilla de precios (`Precios Insumos`), por similitud normalizada de tokens.
 * NO escribe nada — solo genera reports/sku-fix-propuesta.csv para revisión manual.
 *
 * Uso:  npm run sku:propose
 * Después de revisar el CSV, se aplica con scripts/apply-sku-fix.ts (a crear).
 *
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON · SANITY_API_WRITE_TOKEN (mismas del sync).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { google } from "googleapis";
import { sanityWriteClient } from "../src/lib/sanity";

const SHEET_PRECIOS_ID =
  process.env.SHEET_PRECIOS_ID ?? "1rQoHe-bx5x8tBcEWgGGwyWIQi3zfUvYM5b7wYiLjdf0";
const TAB_PRECIOS = "Precios Insumos";

// ---- helpers de normalización / matching ----
function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca acentos
    .replace(/[^a-z0-9]+/g, " ") // todo lo no alfanumérico → espacio
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

const STOP = new Set(["ml", "de", "para", "con", "tipo", "y"]);

/** Cobertura: qué fracción de los tokens del NOMBRE aparece en la DESCRIPCION.
 *  La descripción de la planilla es verbosa (vidrio/ambar/premium/unidad…), así que
 *  un Jaccard simétrico penaliza matches correctos. La cobertura name→desc es más justa.
 *  Los números (tamaño en ml) son discriminantes fuertes: si el nombre tiene un número
 *  y la descripción NO lo tiene, penaliza fuerte. */
function score(name: string, desc: string): number {
  const tn = tokens(name).filter((t) => !STOP.has(t));
  const td = new Set(tokens(desc));
  if (tn.length === 0 || td.size === 0) return 0;
  let inter = 0;
  for (const t of tn) if (td.has(t)) inter++;
  let cov = inter / tn.length;
  // chequeo de tamaño: números presentes en el nombre deben estar en la descripción
  const numsName = tn.filter((t) => /^\d+$/.test(t));
  if (numsName.length) {
    const allNumsMatch = numsName.every((n) => td.has(n));
    if (!allNumsMatch) cov *= 0.5;
  }
  return Math.min(1, cov);
}

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function readPrecios(): Promise<{ codigo: string; descripcion: string }[]> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON.");
  const jsonStr = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf-8");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(jsonStr),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_PRECIOS_ID,
    range: TAB_PRECIOS,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = (res.data.values ?? []) as unknown[][];
  if (values.length < 2) return [];
  const headers = values[0].map((h) => norm(h));
  const iCod = headers.indexOf("codigo");
  const iDesc = headers.indexOf("descripcion");
  if (iCod < 0 || iDesc < 0)
    throw new Error("No encuentro columnas CODIGO/DESCRIPCION en Precios Insumos.");
  const out: { codigo: string; descripcion: string }[] = [];
  for (let r = 1; r < values.length; r++) {
    const codigo = String(values[r][iCod] ?? "").trim();
    const descripcion = String(values[r][iDesc] ?? "").trim();
    if (!codigo || !descripcion) continue;
    if (codigo.startsWith("product_")) continue; // ignorar basura
    out.push({ codigo, descripcion });
  }
  return out;
}

async function main() {
  console.log("\n🔎 Proponiendo CODIGO para los SKUs sin match\n");
  const precios = await readPrecios();
  console.log(`   Filas de precios con CODIGO+DESCRIPCION: ${precios.length}`);

  const productos: { _id: string; sku: string; name?: string }[] =
    await sanityWriteClient.fetch(
      `*[_type == "product" && defined(sku) && sku match "product_*"]{ _id, sku, name }`,
    );
  console.log(`   Productos sin match (sku basura): ${productos.length}\n`);

  type Row = {
    _id: string;
    name: string;
    sku_actual: string;
    codigo_propuesto: string;
    descripcion_match: string;
    score: number;
  };
  const rows: Row[] = [];
  for (const p of productos) {
    const name = p.name ?? "";
    let best = { codigo: "", descripcion: "", s: 0, comp: 0 };
    for (const c of precios) {
      const s = score(name, c.descripcion);
      if (s === 0) continue;
      // tiebreak: preferir fila "Unidad" (código base) y descripción más corta
      const unidad = /unidad/i.test(c.descripcion) ? 0.03 : 0;
      const lenPenalty = tokens(c.descripcion).length * 0.0005;
      const comp = s + unidad - lenPenalty;
      if (comp > best.comp)
        best = { codigo: c.codigo, descripcion: c.descripcion, s, comp };
    }
    rows.push({
      _id: p._id,
      name,
      sku_actual: p.sku,
      codigo_propuesto: best.s > 0 ? best.codigo : "",
      descripcion_match: best.descripcion,
      score: Math.round(best.s * 100) / 100,
    });
  }

  // Ordenar por score ascendente: los de baja confianza primero (para revisar).
  rows.sort((a, b) => a.score - b.score);

  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "sku-fix-propuesta.csv");
  const header =
    "# Propuesta de correccion de SKU para los productos sin match.\n" +
    "# REVISAR a mano: 'score' = confianza del match (1 = exacto). Ordenado de menor a mayor.\n" +
    "# Vaciar 'codigo_propuesto' en las filas que esten mal antes de aplicar.\n" +
    `# Generado: ${new Date().toISOString()} - Total: ${rows.length}\n` +
    "score,name,codigo_propuesto,descripcion_match,sku_actual,_id\n";
  const body = rows
    .map((r) =>
      [
        String(r.score),
        r.name,
        r.codigo_propuesto,
        r.descripcion_match,
        r.sku_actual,
        r._id,
      ]
        .map(escapeCsv)
        .join(","),
    )
    .join("\n");
  writeFileSync(path, header + body + "\n", "utf-8");

  const altos = rows.filter((r) => r.score >= 0.8).length;
  const medios = rows.filter((r) => r.score >= 0.5 && r.score < 0.8).length;
  const bajos = rows.filter((r) => r.score < 0.5).length;
  console.log(`   Confianza alta (≥0.8): ${altos}`);
  console.log(`   Confianza media (0.5–0.8): ${medios}`);
  console.log(`   Confianza baja (<0.5): ${bajos}  ← revisar sí o sí`);
  console.log(`\n   📄 ${path}\n`);
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
