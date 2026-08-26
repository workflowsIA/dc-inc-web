/**
 * Linkeo de filas de la planilla de precios (`ProductosDC-Todos`) a productos.
 *
 * La planilla tiene UNA FILA POR PRESENTACIÓN: la fila base (Unidad, UxB = 1)
 * y, debajo, las variantes (Caja / Pallet / Paquete / Manga / Personalizada…)
 * con el MISMO SKU base + un sufijo. Acá vive la lógica pura (sin red) que
 * decide qué fila es base, qué fila es variante y de quién.
 *
 * Convención REAL de sufijos relevada el 26-ago-2026 sobre las 1054 filas:
 *   Envases      P = Pallet · C = Caja · CP / CG = Caja (LAS473) · CP = "Pallet caja"
 *                (botellones) → el LABEL sale de la descripción, no del sufijo.
 *   Tapas        C = Caja (2000-12000 u) · B = Paquete/bolsa (10-100 u) ·
 *                M = Manga (tapas de lata) · P = Personalizado (precintos)
 *                + colores de tapa corona como sufijos compuestos:
 *                TC27C + LNB / LPB / … ("Paquete · Lisa Negra"), TC27PL + PB / DB…
 *   Cajas cartón P = Personalizada · PP = Personalizada (pool) ·
 *                E / CF / CFE / CIE / CAE = Envoltorio x20 de cada arte.
 *   Cristalería  base = SKU+UN (unidad) y caja = SKU+CA. En Sanity el SKU está
 *                pelado (NAJT0340), así que "UN" es un ALIAS de fila base.
 *   Packs        en la planilla llevan un "1" final (BARRIPACK1) y en Sanity no.
 *   Algunas bases terminan en U (BBSLA700FU) y sus variantes no llevan la U.
 *
 * Regla de linkeo (evita falsos positivos como TR28P / TGRP / TC27C, que son
 * SKUs BASE que terminan en letras de sufijo):
 *   una fila variante (UxB > 1) se linkea al SKU base MÁS LARGO que exista
 *   como fila base (UxB ≤ 1) y sea prefijo estricto del SKU de la variante.
 *   Si ningún base es prefijo, la variante queda "sin base" y se reporta.
 *
 * Antes (`/(CP|CG|P)$/`) solo se linkeaban 77 de 619 variantes: por eso la
 * lata 473 (CP/CG) tenía todos los precios y la botella 355 / mini barrica
 * (sufijo C) no ofrecían caja o la mostraban al precio unitario base.
 */

export interface SheetPriceRow {
  sku: string;
  /** "Insumos: Unidad, Caja y Pallet" — descripción de la fila */
  name: string;
  unitsPerBulk: number | null;
  price: number | null;
}

export interface LinkedPresentation {
  /** SKU de la fila variante (va al pedido, reprecio server-side) */
  sku: string;
  /** Tipo de presentación: Caja / Pallet / Paquete / Manga / Personalizada… */
  label: string;
  /** Distintivo dentro del mismo tipo (ej. color de tapa "Lisa Negra"), si hay */
  variant?: string;
  unitsPerBulk: number;
  price: number;
}

export interface LinkResult {
  /** clave de producto (SKU tal como está en Sanity, o alias) → fila base */
  bases: Map<string, SheetPriceRow>;
  /** clave de producto → variantes (Caja/Pallet/…) ordenadas de menor a mayor */
  presentations: Map<string, LinkedPresentation[]>;
  /** variantes (UxB > 1) sin ninguna fila base que sea prefijo → no se ofrecen */
  unlinked: SheetPriceRow[];
}

/** Excepciones de linkeo: prefijo de variante → SKU base real. Solo para las
 *  filas cuyo SKU no comparte prefijo con su base (ej. tapa corona premium
 *  impresa: base TC27PIVA, paquetes por color TC27PIROB / TC27PIVIB…). */
const BASE_ALIASES: Record<string, string> = {
  TC27PI: "TC27PIVA",
};

export function isBaseRow(r: { unitsPerBulk: number | null }): boolean {
  return r.unitsPerBulk === null || r.unitsPerBulk <= 1;
}

/**
 * Otras claves bajo las que puede estar el producto de una fila base:
 *   NAJT0340UN → NAJT0340 (cristalería) · BARRIPACK1 → BARRIPACK (packs) ·
 *   BBSLA700FU → BBSLA700F (bases con U de "unidad").
 * El alias solo vale si ese SKU pelado NO es una fila por sí mismo.
 */
export function baseAliases(sku: string): string[] {
  const out: string[] = [];
  if (sku.length > 3 && sku.endsWith("UN")) out.push(sku.slice(0, -2));
  else if (sku.length > 2 && /[A-Z]1$/.test(sku)) out.push(sku.slice(0, -1));
  else if (sku.length > 2 && /[A-Z]U$/.test(sku)) out.push(sku.slice(0, -1));
  return out;
}

/** Segmentos de la descripción ("330 ml - BOTELLA R - … - Caja"). */
function segments(name: string): string[] {
  return name
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s(/])([a-záéíóúñ])/g, (m, p, c) => p + c.toUpperCase());
}

/**
 * Tipo de presentación a partir de la descripción de la fila variante
 * (último segmento, ej. "Caja", "Pallet caja", "Paquete", "Manga - Pallet",
 * "PERSONALIZADAS - POOL", "CUIDADO-FRAGIL - ENVOLTORIO"). Cae al sufijo si
 * la descripción no dice nada reconocible.
 */
export function presentationLabel(name: string, suffix: string): string {
  const n = name.toLowerCase();
  if (/pallet\s*caja/.test(n)) return "Pallet caja";
  if (/\bpool\b/.test(n)) return "Personalizada (pool)";
  if (/personaliza/.test(n)) return "Personalizada";
  if (/envoltorio/.test(n)) return "Envoltorio";
  if (/manga/.test(n)) return "Manga";
  if (/paquete|bolsa/.test(n)) return "Paquete";
  if (/caja\s*grande/.test(n)) return "Caja grande";
  if (/pallet/.test(n)) return "Pallet";
  if (/caja/.test(n)) return "Caja";
  switch (suffix) {
    case "P":
      return "Pallet";
    case "CG":
      return "Caja grande";
    case "C":
    case "CP":
    case "CA":
      return "Caja";
    case "B":
      return "Paquete";
    case "M":
      return "Manga";
    case "PP":
      return "Personalizada (pool)";
    default:
      return "Bulto";
  }
}

/** Palabras que describen el tipo de presentación y NO son distintivo. */
const NOISE =
  /^(unidad|caja|caja\s*grande|pallet|pallet\s*caja|paquete|manga|bolsa|personalizad[ao]s?|pool|envoltorio|personalizado|\d+\s*un)$/i;

/**
 * Distintivo de la variante = segmentos de su descripción que NO están en la
 * descripción de la base ni describen el tipo de presentación.
 * "ESTANDAR - LISA - NEGRA - TAPA CORONA - 26 mm - Paquete" vs base
 * "ESTANDAR - TAPA CORONA - 26 mm - Unidad" → "Lisa Negra".
 */
export function presentationVariant(baseName: string, name: string): string | undefined {
  const baseSegs = new Set(segments(baseName).map((s) => s.toLowerCase()));
  const extra = segments(name)
    .filter((s) => !baseSegs.has(s.toLowerCase()) && !NOISE.test(s))
    .map((s) => titleCase(s));
  return extra.length ? extra.join(" ") : undefined;
}

/**
 * Indexa las filas de la planilla: bases (por clave de producto, con alias
 * UN / 1 / U) y variantes linkeadas al base más largo que sea prefijo.
 */
export function linkPresentations(rows: SheetPriceRow[]): LinkResult {
  const bases = new Map<string, SheetPriceRow>();
  const rawSkus = new Set(rows.map((r) => r.sku));

  // Filas "caja" de cristalería con UxB = 1 (mini latas: LBML148CA junto a
  // LBML148UN) no son ni base ni variante vendible → se ignoran.
  const isFakeCajaBase = (r: SheetPriceRow) =>
    r.sku.endsWith("CA") && rawSkus.has(r.sku.slice(0, -2) + "UN");

  // 1) Filas base por su SKU tal cual. Primera fila con precio gana.
  for (const r of rows) {
    if (!r.sku || !isBaseRow(r) || r.price === null || isFakeCajaBase(r)) continue;
    if (!bases.has(r.sku)) bases.set(r.sku, r);
  }
  // 2) Alias (NAJT0340UN → NAJT0340…) solo si el SKU pelado no es fila propia.
  for (const r of rows) {
    if (!r.sku || !isBaseRow(r) || r.price === null || isFakeCajaBase(r)) continue;
    for (const a of baseAliases(r.sku)) {
      if (!rawSkus.has(a) && !bases.has(a)) bases.set(a, r);
    }
  }

  // Prefijos candidatos → clave de producto. Incluye las claves de `bases`
  // (SKU real y alias: así C70LGX24CFE linkea a C70LGX24CF1 vía "C70LGX24CF",
  // y no a C70LGX24) y las excepciones explícitas.
  const prefixToKey = new Map<string, string>();
  for (const key of bases.keys()) prefixToKey.set(key, key);
  for (const [alias, real] of Object.entries(BASE_ALIASES)) {
    if (bases.has(real) && !prefixToKey.has(alias)) prefixToKey.set(alias, real);
  }
  const prefixes = [...prefixToKey.keys()].sort((a, b) => b.length - a.length);

  // Una misma fila base puede vivir bajo varias claves (NAJT0340UN y NAJT0340;
  // C70LGX24CF1 y C70LGX24CF): sus variantes se publican bajo TODAS, con la
  // misma lista, para que la búsqueda por SKU de Sanity siempre las encuentre.
  const keysByRow = new Map<SheetPriceRow, string[]>();
  for (const [key, row] of bases) {
    const l = keysByRow.get(row);
    if (l) l.push(key);
    else keysByRow.set(row, [key]);
  }

  // 3) Variantes → base por prefijo más largo.
  const presentations = new Map<string, LinkedPresentation[]>();
  const unlinked: SheetPriceRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.sku || isBaseRow(r) || r.price === null || r.unitsPerBulk === null) continue;
    if (seen.has(r.sku)) continue;
    seen.add(r.sku);
    const prefix = prefixes.find((p) => r.sku.startsWith(p) && r.sku !== p);
    if (!prefix) {
      unlinked.push(r);
      continue;
    }
    const base = bases.get(prefixToKey.get(prefix) as string) as SheetPriceRow;
    const suffix = r.sku.slice(prefix.length);
    const variant = presentationVariant(base.name, r.name);
    const entry: LinkedPresentation = {
      sku: r.sku,
      label: presentationLabel(r.name, suffix),
      ...(variant ? { variant } : {}),
      unitsPerBulk: r.unitsPerBulk,
      price: r.price,
    };
    const keys = keysByRow.get(base) ?? [];
    let list = presentations.get(keys[0]);
    if (!list) {
      list = [];
      for (const k of keys) presentations.set(k, list);
    }
    list.push(entry);
  }
  for (const list of new Set(presentations.values())) {
    list.sort((a, b) => a.unitsPerBulk - b.unitsPerBulk || a.sku.localeCompare(b.sku));
  }
  return { bases, presentations, unlinked };
}
