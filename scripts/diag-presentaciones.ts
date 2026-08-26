/**
 * Diagnóstico "¿por qué la ficha muestra el mismo precio para Individual /
 * Caja / Pallet?" (reporte de Marce, ago-2026, ej. Botella R - 500 ml).
 *
 * Para cada SKU cruza lo que hay en Sanity (presentaciones, precios por
 * presentación, precio base) con las filas de la planilla de precios
 * (`ProductosDC-Todos`: fila base + variantes con sufijo P / CP / CG) y marca
 * la causa más probable:
 *   [A] la planilla tiene el MISMO precio unitario en la fila base y en las
 *       variantes → no hay descuento por volumen cargado (dato, no código);
 *   [B] la cantidad de la presentación (texto "24un en Caja") no coincide con
 *       UxB de la fila variante (ej. 24 vs 20) → la web no linkea y cae al
 *       precio unitario base;
 *   [C] la planilla no tiene filas variante para ese SKU (o el sufijo no es
 *       P/CP/CG) → el sync no pudo cargar presentationPricing;
 *   [D] Sanity no tiene presentationPricing (falta correr el sync).
 *
 * Uso (en la Mac, .env.local con SANITY_API_WRITE_TOKEN y GOOGLE_SERVICE_ACCOUNT_JSON):
 *   npx tsx --env-file=.env.local scripts/diag-presentaciones.ts BOT500R
 *   npx tsx --env-file=.env.local scripts/diag-presentaciones.ts --name "botella r 500"
 */
import { google } from "googleapis";
import { sanityWriteClient } from "../src/lib/sanity";
import { parsePresentationUnits } from "../src/lib/presentations";
import { matchesSearch } from "../src/lib/search";

const SHEET_PRECIOS_ID =
  process.env.SHEET_PRECIOS_ID ?? "1rQoHe-bx5x8tBcEWgGGwyWIQi3zfUvYM5b7wYiLjdf0";
const TAB_PRECIOS = "ProductosDC-Todos";
const PRES_SUFFIX_RE = /(CP|CG|P)$/;

interface SanityRow {
  _id: string;
  sku: string;
  name: string;
  pricePublic?: number;
  priceWholesale?: number;
  unitsPerBulk?: number;
  unitsPerPallet?: number;
  presentations?: string[];
  presentationPricing?: {
    sku?: string;
    label?: string;
    unitsPerBulk?: number;
    pricePublic?: number;
    priceWholesale?: number;
  }[];
}

function normKey(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  return s && Number.isFinite(n) ? n : null;
}
const fmt = (n: number | null | undefined) =>
  typeof n === "number" ? `$${Math.round(n).toLocaleString("es-AR")}` : "—";

async function readSheet(): Promise<Record<string, unknown>[]> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON en .env.local");
  const jsonStr = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
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
  const headers = values[0].map(normKey);
  return values.slice(1).map((row) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) o[h] = row[i];
    });
    return o;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const byName = args.indexOf("--name");
  let products: SanityRow[];
  const FIELDS = `_id, sku, name, pricePublic, priceWholesale, unitsPerBulk, unitsPerPallet, presentations,
    presentationPricing[]{ sku, label, unitsPerBulk, pricePublic, priceWholesale }`;
  if (byName >= 0) {
    // Mismo matcheo por palabras que el buscador de la web (todas las palabras,
    // en cualquier orden, sin acentos). `match` de GROQ no sirve para esto.
    const q = args[byName + 1] ?? "";
    const all = await sanityWriteClient.fetch<SanityRow[]>(`*[_type == "product"]{ ${FIELDS} }`);
    products = all.filter((p) => matchesSearch(`${p.name} ${p.sku}`, q));
  } else {
    const skus = args.filter((a) => !a.startsWith("--"));
    if (!skus.length) {
      console.error("Uso: diag-presentaciones.ts <SKU...>  |  --name \"texto del nombre\"");
      process.exit(1);
    }
    products = await sanityWriteClient.fetch<SanityRow[]>(
      `*[_type == "product" && sku in $skus]{ ${FIELDS} }`,
      { skus },
    );
  }
  if (!products.length) {
    console.log("No encontré productos en Sanity con ese criterio.");
    return;
  }
  const rows = await readSheet();

  for (const p of products) {
    console.log(`\n══════ ${p.sku} — ${p.name} ══════`);
    console.log(`Sanity: pricePublic=${fmt(p.pricePublic)} priceWholesale=${fmt(p.priceWholesale)} unitsPerBulk=${p.unitsPerBulk ?? "—"} unitsPerPallet=${p.unitsPerPallet ?? "—"}`);
    console.log(`Sanity presentations (texto → unidades que entiende la web):`);
    const presUnits = (p.presentations ?? []).map((s) => ({ s, n: parsePresentationUnits(s) }));
    if (!presUnits.length) console.log("   (ninguna → la ficha solo ofrece Individual)");
    for (const x of presUnits) console.log(`   "${x.s}" → ${x.n} u`);
    console.log(`Sanity presentationPricing (lo que cargó el sync):`);
    const pp = p.presentationPricing ?? [];
    if (!pp.length) console.log("   (vacío) → [D] falta correr el sync o [C] la planilla no tiene variantes");
    for (const e of pp)
      console.log(`   ${e.sku ?? "?"} ${e.label ?? ""} UxB=${e.unitsPerBulk ?? "?"} pub/u=${fmt(e.pricePublic)} may/u=${fmt(e.priceWholesale)}`);

    // Planilla: fila base + variantes
    const base = p.sku.trim();
    const sheetRows = rows.filter((r) => {
      const sku = String(r["sku"] ?? r["codigo"] ?? "").trim();
      if (!sku) return false;
      if (sku === base) return true;
      const m = sku.match(PRES_SUFFIX_RE);
      return !!m && sku.slice(0, sku.length - m[1].length) === base;
    });
    console.log(`Planilla ${TAB_PRECIOS} (filas cuyo SKU es ${base} o ${base}+P/CP/CG):`);
    if (!sheetRows.length) console.log("   (ninguna) → [C] el SKU de Sanity no está en la planilla");
    const unitPrices: number[] = [];
    for (const r of sheetRows) {
      const sku = String(r["sku"] ?? r["codigo"]).trim();
      const uxb = toNum(r["uxb"] ?? r["unidad por bulto"]);
      const pu = toNum(r["precio unitario"]);
      if (pu !== null) unitPrices.push(pu);
      console.log(`   ${sku.padEnd(14)} UxB=${String(uxb ?? "—").padEnd(6)} precio unitario=${fmt(pu)}  ${String(r["insumos: unidad, caja y pallet"] ?? r["descripcion"] ?? "")}`);
    }

    // Diagnóstico
    const flags: string[] = [];
    if (unitPrices.length > 1 && new Set(unitPrices.map((n) => Math.round(n))).size === 1)
      flags.push("[A] la planilla tiene el MISMO precio unitario en todas las filas → no hay descuento por volumen cargado. Es dato: Marce tiene que bajar el markup de Caja/Pallet en la planilla.");
    const sheetUxb = new Set(
      sheetRows.map((r) => toNum(r["uxb"] ?? r["unidad por bulto"])).filter((n): n is number => n !== null && n > 1),
    );
    for (const x of presUnits) {
      if (x.n > 1 && !sheetUxb.has(x.n) && !pp.some((e) => e.unitsPerBulk === x.n))
        flags.push(`[B] la presentación "${x.s}" (${x.n} u) no coincide con ninguna fila de la planilla (UxB: ${[...sheetUxb].join(", ") || "—"}) → la web cae al precio unitario base. Alinear el texto de la presentación en Sanity o el UxB en la planilla.`);
    }
    const variantRows = sheetRows.filter((r) => String(r["sku"] ?? r["codigo"]).trim() !== base);
    if (!variantRows.length && sheetRows.length)
      flags.push("[C] la planilla solo tiene la fila base: sin filas Caja/Pallet (sufijo P/CP/CG) no hay precio por presentación.");
    if (variantRows.length && !pp.length)
      flags.push("[D] la planilla tiene variantes pero Sanity no tiene presentationPricing → correr el sync (npm run sync:sheet).");
    console.log(flags.length ? `\nDiagnóstico:\n - ${flags.join("\n - ")}` : "\nDiagnóstico: todo consistente — si la ficha igual muestra precios iguales, avisar (sería código).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
