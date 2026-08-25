/**
 * Sincronización Sheet → Sanity (precios + stock).
 * Core reusable: lo llaman el script CLI (scripts/sync-sheet-to-sanity.ts) y el
 * route handler de cron (src/app/api/sync-sheet/route.ts).
 *
 * Fuentes (ver vault: entregables/mapeo-sheet-sanity-junio-2026.md):
 *   PRECIOS → "Lista de precios productos - DC Inc 2026" / `ProductosDC-Todos`
 *     Sku → sku · Precio unitario (NETO) → pricePublic = priceWholesale · UxB → unitsPerBulk
 *   STOCK   → "Presupuestos | inventario | Actual" / `Productos_Inventario_DC`
 *     Sku → sku · Stock Venta (fila base) → stockQty · Minimos stock → stockMin
 *
 * ⚠️ Reestructura de la planilla (jul 2026): Marce pasó a modelo costo+markup
 * (COSTO DOLAR × dólar tab "Dolar" × MARK UP → SIN IVA; × 1,21 → CON IVA) con
 * UNA FILA POR PRESENTACIÓN (Unidad/Caja/Pallet; SKU con sufijo P/CP/CG).
 * Los precios canónicos son "CON IVA - Web" y "SIN IVA - Presupuesto"; la
 * columna vieja " Precio unitario " quedó como referencia histórica (stale) y
 * solo se usa de fallback. Las filas de variantes (UNIDAD POR BULTO > 1) se
 * indexan para matchear SKUs existentes pero NO crean drafts.
 */
import { google } from "googleapis";
import { sanityWriteClient } from "./sanity";

const SHEET_PRECIOS_ID =
  process.env.SHEET_PRECIOS_ID ?? "1rQoHe-bx5x8tBcEWgGGwyWIQi3zfUvYM5b7wYiLjdf0";
const SHEET_INVENTARIO_ID =
  process.env.SHEET_INVENTARIO_ID ?? "1IArDR92PfChhzAHHKsI-6KLY0xo63ERr7u07vNP_U8M";
const TAB_PRECIOS = "ProductosDC-Todos";
const TAB_INVENTARIO = "Productos_Inventario_DC";

export interface SyncSummary {
  pricesRead: number;
  stockRead: number;
  productsInSanity: number;
  patched: number;
  skipped: number;
  noMatch: string[];
  /** Detalle de los productos de Sanity cuyo SKU no matchea ninguna fila de las planillas.
   *  Útil para documentar/triage (ver scripts/sync-sheet-to-sanity.ts → reports/skus-sin-match.csv). */
  noMatchDetails: { _id: string; sku: string; name: string; slug: string }[];
  dryRun: boolean;
  changes?: { sku: string; set: Record<string, unknown> }[];
  /** SKUs de la planilla de precios que NO existían en Sanity → creados como
   *  borradores (drafts) para dar de alta desde el Studio ("Nuevos desde la planilla"). */
  createdDrafts: { sku: string; name: string }[];
}

// ---- helpers ----

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
  const s = String(v)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cleanSku(v: unknown): string {
  return String(v ?? "").trim();
}

function rowsToObjects(values: unknown[][]): Record<string, unknown>[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(normKey);
  return values.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i];
    });
    return obj;
  });
}

async function getSheetsClient(readOnly = true) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Falta GOOGLE_SERVICE_ACCOUNT_JSON (JSON o base64 de la service account de Google).",
    );
  }
  const jsonStr = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf-8");
  const credentials = JSON.parse(jsonStr);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      readOnly
        ? "https://www.googleapis.com/auth/spreadsheets.readonly"
        : "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  return google.sheets({ version: "v4", auth });
}

/** Letra de columna A1 a partir de índice 0. */
function colLetter(idx: number): string {
  let n = idx;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

async function readTab(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  spreadsheetId: string,
  tab: string,
): Promise<Record<string, unknown>[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tab,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return rowsToObjects((res.data.values ?? []) as unknown[][]);
}

interface PriceRow {
  pricePublic: number | null;
  priceWholesale: number | null;
  unitsPerBulk: number | null;
  /** DESCRIPCION de la planilla — nombre tentativo para productos nuevos. */
  name: string;
  /** true si la fila es una presentación Caja/Pallet (UNIDAD POR BULTO > 1).
   *  Matchea SKUs existentes pero no crea drafts (evita inundar el Studio
   *  con variantes LAS473P/CP/CG que en la web son opciones del producto). */
  isVariant: boolean;
}

function buildPriceMap(rows: Record<string, unknown>[]): Map<string, PriceRow> {
  const map = new Map<string, PriceRow>();
  for (const r of rows) {
    const sku = cleanSku(r["sku"] ?? r["codigo"]);
    if (!sku) continue;
    // Fuente: pestana "ProductosDC-Todos". "Precio unitario" es el precio NETO
    // (sin IVA) por unidad de cada presentacion (fila base + SKUs con sufijo
    // P/CP/CG). Es la fuente unica: publico y mayorista salen del mismo neto
    // (el cliente final muestra +IVA una sola vez; el mayorista muestra neto).
    // Asi se arregla el IVA doble sin dividir nada. Ver dc-inc-web-iva-doble.
    const precioUnit = toNum(r["precio unitario"]);
    const pricePublic = precioUnit;
    const priceWholesale = precioUnit;
    const unitsPerBulk = toNum(r["uxb"] ?? r["unidad por bulto"]);
    const name = String(
      r["insumos: unidad, caja y pallet"] ?? r["descripcion"] ?? "",
    ).trim();
    const isVariant = unitsPerBulk !== null && unitsPerBulk > 1;
    if (!map.has(sku) && pricePublic !== null) {
      map.set(sku, { pricePublic, priceWholesale, unitsPerBulk, name, isVariant });
    }
  }
  return map;
}

/**
 * Precio por PRESENTACIÓN (bulto: Caja / Pallet) para reflejar el descuento por
 * volumen en la web. En la planilla nueva cada producto tiene una fila por
 * presentación; la variante lleva el SKU base + sufijo:
 *   P → Pallet · CP → Caja · CG → Caja (grande).  (ej: LAS473 base → LAS473CP
 *   caja UxB=88, LAS473P pallet UxB=6224).
 *
 * SUPUESTO (a confirmar contra la planilla real):
 *  - El SKU de la variante = SKU base + uno de {P, CP, CG} al final. Derivamos el
 *    SKU base quitando ese sufijo. Si un SKU base terminara legítimamente en esas
 *    letras habría ambigüedad; NO se rompe el match actual porque las filas base
 *    (Unidad, UxB=1) se siguen indexando por su SKU completo en buildPriceMap, y
 *    acá solo tocamos filas variante (UxB > 1).
 *  - "CON IVA - Web" / "SIN IVA - Presupuesto" de la fila variante son precios
 *    POR UNIDAD a ese markup (misma base que los del producto), no el total del
 *    bulto. El buy-box los pasa por resolveDisplayPrice y multiplica por unidades,
 *    igual que hoy con el precio unitario.
 *  - `label` (Caja/Pallet) se deriva del sufijo; el buy-box linkea cada fila con
 *    su presentación por unitsPerBulk (primario) y por label (fallback).
 */
const PRES_SUFFIX_RE = /(CP|CG|P)$/;

function presLabelFromSuffix(suffix: string): string {
  return suffix === "P" ? "Pallet" : "Caja"; // CP / CG → Caja
}

export interface PresentationPricing {
  sku: string;
  label: string;
  unitsPerBulk: number;
  pricePublic: number | null;
  priceWholesale: number | null;
}

function buildPresentationPricingMap(
  rows: Record<string, unknown>[],
): Map<string, PresentationPricing[]> {
  const map = new Map<string, PresentationPricing[]>();
  const seen = new Set<string>(); // dedupe por SKU de variante (primera gana)
  for (const r of rows) {
    const sku = cleanSku(r["sku"] ?? r["codigo"]);
    if (!sku) continue;
    const unitsPerBulk = toNum(r["uxb"] ?? r["unidad por bulto"]);
    // Solo filas variante (Caja/Pallet). La fila base (Unidad) trae UxB = 1.
    if (unitsPerBulk === null || unitsPerBulk <= 1) continue;
    const m = sku.match(PRES_SUFFIX_RE);
    if (!m) continue; // sin sufijo reconocible → no la podemos linkear al base
    const base = sku.slice(0, sku.length - m[1].length);
    if (!base) continue;
    if (seen.has(sku)) continue;
    seen.add(sku);
    // ProductosDC-Todos: "Precio unitario" NETO por presentacion. Publico y
    // mayorista = mismo neto (ver buildPriceMap). Ver dc-inc-web-iva-doble.
    const precioUnit = toNum(r["precio unitario"]);
    const pricePublic = precioUnit;
    const priceWholesale = precioUnit;
    if (pricePublic === null && priceWholesale === null) continue; // fila sin precio útil
    const entry: PresentationPricing = {
      sku,
      label: presLabelFromSuffix(m[1]),
      unitsPerBulk,
      pricePublic,
      priceWholesale,
    };
    const list = map.get(base);
    if (list) list.push(entry);
    else map.set(base, [entry]);
  }
  // Orden estable: menor a mayor bulto (Caja antes que Pallet).
  for (const list of map.values())
    list.sort((a, b) => a.unitsPerBulk - b.unitsPerBulk);
  return map;
}

interface StockRow {
  stockQty: number | null;
  stockMin: number | null;
}

function buildStockMap(rows: Record<string, unknown>[]): Map<string, StockRow> {
  const map = new Map<string, StockRow>();
  for (const r of rows) {
    const sku = cleanSku(r["sku"]);
    if (!sku) continue;
    const uxb = toNum(r["uxb"]);
    const stockQty = toNum(r["stock venta"]);
    const stockMin = toNum(r["minimos stock"]);
    if (stockQty === null) continue;
    const isBase = uxb === null || uxb === 0; // fila "Totales" del modelo
    if (isBase) map.set(sku, { stockQty, stockMin });
    else if (!map.has(sku)) map.set(sku, { stockQty, stockMin });
  }
  return map;
}

function deriveStockLevel(
  qty: number | null,
  min: number | null,
): "ok" | "low" | "out" | null {
  if (qty === null) return null;
  if (qty <= 0) return "out";
  if (min !== null && qty <= min) return "low";
  return "ok";
}

// ---- main ----

export async function runSheetSync(opts: { dryRun?: boolean } = {}): Promise<SyncSummary> {
  const dryRun = !!opts.dryRun;
  const sheets = await getSheetsClient();
  const [priceRows, stockRows] = await Promise.all([
    readTab(sheets, SHEET_PRECIOS_ID, TAB_PRECIOS),
    readTab(sheets, SHEET_INVENTARIO_ID, TAB_INVENTARIO),
  ]);
  const priceMap = buildPriceMap(priceRows);
  const stockMap = buildStockMap(stockRows);
  const presentationPricingMap = buildPresentationPricingMap(priceRows);

  const products: { _id: string; sku: string; name?: string; slug?: string }[] =
    await sanityWriteClient.fetch(
      `*[_type == "product" && defined(sku)]{ _id, sku, name, "slug": slug.current }`,
    );

  let patched = 0;
  let skipped = 0;
  const noMatch: string[] = [];
  const noMatchDetails: SyncSummary["noMatchDetails"] = [];
  const changes: { sku: string; set: Record<string, unknown> }[] = [];
  const tx = sanityWriteClient.transaction();

  for (const p of products) {
    const price = priceMap.get(p.sku);
    const stock = stockMap.get(p.sku);
    if (!price && !stock) {
      noMatch.push(p.sku);
      noMatchDetails.push({
        _id: p._id,
        sku: p.sku,
        name: p.name ?? "",
        slug: p.slug ?? "",
      });
      continue;
    }
    const set: Record<string, unknown> = {};
    if (price?.pricePublic != null) set.pricePublic = price.pricePublic;
    if (price?.priceWholesale != null) set.priceWholesale = price.priceWholesale;
    // La fila base de la planilla nueva trae UNIDAD POR BULTO = 1 (es la fila
    // "Unidad"); pisar con 1 rompería el buy-box por bulto enriquecido de Wix.
    if (price?.unitsPerBulk != null && price.unitsPerBulk > 1)
      set.unitsPerBulk = price.unitsPerBulk;
    // Precio por presentación (caja/pallet) del producto base → descuento por
    // volumen en el buy-box. _key por variante para el patch idempotente.
    const presPricing = presentationPricingMap.get(p.sku);
    if (presPricing && presPricing.length > 0) {
      set.presentationPricing = presPricing.map((e) => ({
        _key: e.sku.replace(/[^A-Za-z0-9._-]/g, "-"),
        ...e,
      }));
    }
    if (stock?.stockQty != null) set.stockQty = stock.stockQty;
    if (stock?.stockMin != null) set.stockMin = stock.stockMin;
    const level = deriveStockLevel(stock?.stockQty ?? null, stock?.stockMin ?? null);
    if (level) set.stockLevel = level;

    if (Object.keys(set).length === 0) {
      skipped++;
      continue;
    }
    patched++;
    changes.push({ sku: p.sku, set });
    if (!dryRun) tx.patch(p._id, (patch) => patch.set(set));
  }

  if (!dryRun && patched > 0) {
    await tx.commit({ visibility: "async" });
  }

  // --- Productos NUEVOS en la planilla (SKU con precio que no existe en Sanity) ---
  // Se crean como BORRADORES (draft) con los datos de la planilla: no aparecen
  // en la web hasta que alguien les complete foto/categoría y los publique.
  // Bandeja en el Studio: Catálogo → Productos → "Nuevos desde la planilla".
  // Idempotente: id determinístico + createIfNotExists (no pisa ediciones a medias).
  const knownSkus = new Set(products.map((p) => p.sku));
  const createdDrafts: SyncSummary["createdDrafts"] = [];
  for (const [sku, price] of priceMap) {
    if (knownSkus.has(sku)) continue;
    if (price.isVariant) continue; // presentación Caja/Pallet → no es un producto nuevo
    const name = price.name || sku;
    const stock = stockMap.get(sku);
    const level = deriveStockLevel(stock?.stockQty ?? null, stock?.stockMin ?? null);
    createdDrafts.push({ sku, name });
    if (dryRun) continue;
    const idSafe = sku.replace(/[^A-Za-z0-9._-]/g, "-");
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96);
    await sanityWriteClient.createIfNotExists({
      _id: `drafts.product-sheet-${idSafe}`,
      _type: "product",
      sku,
      name,
      slug: { _type: "slug", current: slug || idSafe.toLowerCase() },
      ...(price.pricePublic != null ? { pricePublic: price.pricePublic } : {}),
      ...(price.priceWholesale != null ? { priceWholesale: price.priceWholesale } : {}),
      ...(price.unitsPerBulk != null ? { unitsPerBulk: price.unitsPerBulk } : {}),
      ...(presentationPricingMap.get(sku)?.length
        ? {
            presentationPricing: presentationPricingMap
              .get(sku)!
              .map((e) => ({ _key: e.sku.replace(/[^A-Za-z0-9._-]/g, "-"), ...e })),
          }
        : {}),
      ...(stock?.stockQty != null ? { stockQty: stock.stockQty } : {}),
      ...(stock?.stockMin != null ? { stockMin: stock.stockMin } : {}),
      ...(level ? { stockLevel: level } : {}),
      fromSheet: true,
    });
  }

  return {
    pricesRead: priceMap.size,
    stockRead: stockMap.size,
    productsInSanity: products.length,
    patched,
    skipped,
    noMatch,
    noMatchDetails,
    dryRun,
    changes: dryRun ? changes : undefined,
    createdDrafts,
  };
}

// ---------------------------------------------------------------------------
// Venta web → resta stock en la planilla (único flujo web → Sheet de d-005)
// ---------------------------------------------------------------------------

/**
 * Descuenta stock en la planilla tras un PAGO CONFIRMADO (webhook Nave o pago
 * simulado). Best-effort: nunca lanza (un fallo acá no puede romper la
 * confirmación del cobro).
 *
 * GATED por STOCK_SALE_ON_PAYMENT=1. Mientras la columna objetivo sea fórmula
 * ("Stock Venta" hoy), applyStockSale la saltea y solo loguea. Cuando Marce dé
 * el OK a la columna "Ventas web": setear STOCK_SALE_COLUMN y listo.
 */
export async function stockSaleAfterPayment(
  order: { orderNumber?: string; items?: { sku?: string; unidades?: number }[] },
  tag: string,
): Promise<void> {
  if (process.env.STOCK_SALE_ON_PAYMENT !== "1") return;
  const items = (order.items ?? [])
    .filter((i) => i.sku && (i.unidades ?? 0) > 0)
    .map((i) => ({ sku: i.sku as string, unidades: i.unidades as number }));
  if (items.length === 0) return;
  try {
    const res = await applyStockSale(items);
    console.log(
      `[${tag}] stock-sale pedido ${order.orderNumber ?? "?"}: aplicados=${res.applied.length}` +
        (res.skippedFormula.length ? ` fórmula(skip)=${res.skippedFormula.join(",")}` : "") +
        (res.notFound.length ? ` sin fila=${res.notFound.join(",")}` : ""),
    );
  } catch (err) {
    console.error(`[${tag}] stock-sale falló (pedido ${order.orderNumber ?? "?"}):`, err);
  }
}

export interface SaleItem {
  sku: string;
  unidades: number;
}

export interface StockSaleResult {
  applied: { sku: string; before: number; after: number }[];
  skippedFormula: string[]; // celdas que son fórmula → no se pisan (las descuenta Marce)
  notFound: string[]; // SKUs sin fila base en el inventario
  dryRun: boolean;
}

/**
 * Resta `unidades` al stock de cada SKU en `Productos_Inventario_DC`.
 * Escribe sobre la fila base (UxB vacío) en la columna configurada
 * (STOCK_SALE_COLUMN, default "Stock Venta").
 *
 * NO destructivo: si la celda de stock es una fórmula (ej. suma de depósitos),
 * NO la sobreescribe — la agrega a `skippedFormula` para que se descuente a mano.
 * Cuando confirmemos con Marce que esa columna es escribible (o agreguemos una
 * columna "Ventas web" dedicada), apuntamos STOCK_SALE_COLUMN ahí.
 */
export async function applyStockSale(
  items: SaleItem[],
  opts: { dryRun?: boolean } = {},
): Promise<StockSaleResult> {
  const dryRun = !!opts.dryRun;
  const targetCol = process.env.STOCK_SALE_COLUMN ?? "stock venta";
  const sheets = await getSheetsClient(false); // scope de escritura

  // Leemos valores calculados y fórmulas en paralelo para detectar celdas-fórmula.
  const [valsRes, formRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_INVENTARIO_ID,
      range: TAB_INVENTARIO,
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_INVENTARIO_ID,
      range: TAB_INVENTARIO,
      valueRenderOption: "FORMULA",
    }),
  ]);
  const vals = (valsRes.data.values ?? []) as unknown[][];
  const forms = (formRes.data.values ?? []) as unknown[][];
  if (vals.length < 2) throw new Error("Inventario vacío o ilegible.");

  const headers = vals[0].map(normKey);
  const colSku = headers.indexOf("sku");
  const colUxb = headers.indexOf("uxb");
  const colStock = headers.indexOf(normKey(targetCol));
  if (colSku < 0 || colStock < 0) {
    throw new Error(`No encuentro columnas 'sku' / '${targetCol}' en ${TAB_INVENTARIO}.`);
  }

  // Índice de la fila base por SKU (UxB vacío/0).
  const baseRowBySku = new Map<string, number>();
  for (let r = 1; r < vals.length; r++) {
    const sku = cleanSku(vals[r][colSku]);
    if (!sku) continue;
    const uxb = toNum(vals[r][colUxb]);
    if ((uxb === null || uxb === 0) && !baseRowBySku.has(sku)) {
      baseRowBySku.set(sku, r);
    }
  }

  const applied: StockSaleResult["applied"] = [];
  const skippedFormula: string[] = [];
  const notFound: string[] = [];
  const updates: { range: string; values: number[][] }[] = [];

  for (const { sku, unidades } of items) {
    const r = baseRowBySku.get(cleanSku(sku));
    if (r === undefined) {
      notFound.push(sku);
      continue;
    }
    const formula = String(forms[r]?.[colStock] ?? "");
    if (formula.trim().startsWith("=")) {
      skippedFormula.push(sku);
      continue;
    }
    const before = toNum(vals[r][colStock]) ?? 0;
    // Modo "subtract" (default): la columna es el stock → se resta la venta.
    // Modo "accumulate": la columna es un contador de ventas (ej. "Ventas web")
    // → se suma; la planilla de Marce descuenta con su propia fórmula.
    const after =
      process.env.STOCK_SALE_MODE === "accumulate"
        ? before + (Number(unidades) || 0)
        : Math.max(0, before - (Number(unidades) || 0));
    applied.push({ sku, before, after });
    updates.push({
      range: `${TAB_INVENTARIO}!${colLetter(colStock)}${r + 1}`,
      values: [[after]],
    });
  }

  if (!dryRun && updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_INVENTARIO_ID,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }

  return { applied, skippedFormula, notFound, dryRun };
}
