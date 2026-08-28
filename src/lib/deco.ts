/**
 * Decorado (serigrafía) como extra de la ficha — fase 1 (ago-2026).
 *
 * La planilla de precios tiene la tarifa de decorado POR TRAMO de cantidad:
 * una fila por tramo con SKU = prefijo de familia/caras + dígitos, UxB = unidades
 * mínimas del tramo y "Precio unitario" = precio por pieza decorada en ese tramo.
 *   DBC11xx / DBC21xx  botellas 330-500 ml, 1 cara / 2 caras (1 color)
 *   DBG11xx / DBG21xx  botellas 660-1000 ml
 *   DG111xx / DG121xx  botellón 1 L
 *   DG211xx / DG221xx  botellón 2 L
 *   DC11xx             cristalería, 1 color (DC12..15 = 2-5 colores, fase 2)
 *   DCMYM1 / DCMYM2    montaje y horneado por trabajo (1 cara / 2 caras) —
 *                      NO se cobra en la web: la tarifa por pieza "1 cara /
 *                      1 color" ya incluye gráfica + montaje + horneado. Esas
 *                      filas solo aplican cuando DC decora con una gráfica del
 *                      cliente que ya tiene en stock (casi nunca; Marce, 28-ago).
 * OJO: los dígitos del SKU NO siempre son las unidades (DG12124 es el tramo de
 * 15 u): la cantidad mínima del tramo es la columna UxB.
 *
 * El sync arma con esto el singleton `decoPricing` en Sanity (solo lectura) y
 * cada producto dice a qué familia pertenece (`decoFamily`, inferida por
 * scripts/assign-deco-family.ts y editable en el Studio). La ficha cotiza con
 * `decoQuote()` y agrega el decorado como una línea aparte del carrito (SKU del
 * tramo, qty = piezas), que es como Marce lo tiene en su sistema.
 */

export type DecoFamily =
  | "botella-chica"
  | "botella-grande"
  | "botellon-1l"
  | "botellon-2l"
  | "cristaleria";

export const DECO_FAMILY_LABEL: Record<DecoFamily, string> = {
  "botella-chica": "Botellas 330 a 500 ml",
  "botella-grande": "Botellas 660 a 1000 ml",
  "botellon-1l": "Botellón 1 litro",
  "botellon-2l": "Botellón 2 litros",
  cristaleria: "Cristalería (copas y vasos)",
};

export interface DecoTier {
  sku: string;
  minUnits: number;
  /** precio NETO por pieza decorada en este tramo */
  pricePerUnit: number;
}

export interface DecoOption {
  family: DecoFamily;
  /** 1 = una cara, 2 = dos caras (siempre 1 color en fase 1) */
  sides: 1 | 2;
  label: string;
  /** Legado: montaje y horneado (DCMYM1 / DCMYM2). Desde el 28-ago no se
   *  carga ni se cobra (incluido en la tarifa por pieza); quedan opcionales
   *  para leer documentos viejos del singleton sin romper. */
  setupSku?: string;
  setupPrice?: number;
  tiers: DecoTier[];
}

export interface DecoPricing {
  options: DecoOption[];
}

const PREFIXES: { re: RegExp; family: DecoFamily; sides: 1 | 2 }[] = [
  { re: /^DBC11\d+$/, family: "botella-chica", sides: 1 },
  { re: /^DBC21\d+$/, family: "botella-chica", sides: 2 },
  { re: /^DBG11\d+$/, family: "botella-grande", sides: 1 },
  { re: /^DBG21\d+$/, family: "botella-grande", sides: 2 },
  { re: /^DG111\d+$/, family: "botellon-1l", sides: 1 },
  { re: /^DG121\d+$/, family: "botellon-1l", sides: 2 },
  { re: /^DG211\d+$/, family: "botellon-2l", sides: 1 },
  { re: /^DG221\d+$/, family: "botellon-2l", sides: 2 },
  { re: /^DC11\d+$/, family: "cristaleria", sides: 1 },
];

export function decoOptionLabel(sides: 1 | 2): string {
  return sides === 2 ? "2 caras · 1 color" : "1 cara · 1 color";
}

/** Arma la tarifa a partir de las filas de la planilla (sku, UxB, precio). */
export function buildDecoPricing(
  rows: { sku: string; unitsPerBulk: number | null; price: number | null }[],
): DecoPricing {
  const byKey = new Map<string, DecoOption>();
  for (const r of rows) {
    if (!r.sku || r.price === null) continue;
    // DCMYM1/2 (montaje y horneado) se ignoran a propósito: ya está incluido
    // en la tarifa por pieza. Ver nota de cabecera.
    const p = PREFIXES.find((x) => x.re.test(r.sku));
    if (!p || r.unitsPerBulk === null || r.unitsPerBulk <= 1) continue;
    const key = `${p.family}#${p.sides}`;
    let opt = byKey.get(key);
    if (!opt) {
      opt = { family: p.family, sides: p.sides, label: decoOptionLabel(p.sides), tiers: [] };
      byKey.set(key, opt);
    }
    if (!opt.tiers.some((t) => t.sku === r.sku)) {
      opt.tiers.push({ sku: r.sku, minUnits: r.unitsPerBulk, pricePerUnit: r.price });
    }
  }
  const options = [...byKey.values()];
  for (const o of options) o.tiers.sort((a, b) => a.minUnits - b.minUnits);
  options.sort((a, b) => a.family.localeCompare(b.family) || a.sides - b.sides);
  return { options };
}

export interface DecoQuote {
  option: DecoOption;
  tier: DecoTier;
  units: number;
  /** neto por pieza */
  perUnit: number;
  /** neto del decorado de todas las piezas */
  piecesTotal: number;
  /** neto de montaje y horneado — siempre 0 (incluido en la tarifa por pieza) */
  setup: number;
  /** neto total del decorado (= piezas) */
  total: number;
}

/** Opciones de decorado disponibles para una familia (1 cara, 2 caras…). */
export function decoOptionsFor(pricing: DecoPricing | null | undefined, family: DecoFamily | undefined) {
  if (!pricing || !family) return [];
  return pricing.options.filter((o) => o.family === family && o.tiers.length > 0);
}

/** Cantidad mínima para decorar con esta opción (primer tramo). */
export function decoMinUnits(option: DecoOption): number {
  return option.tiers[0]?.minUnits ?? Infinity;
}

/**
 * Cotiza el decorado de `units` piezas con la opción dada: toma el tramo más
 * alto cuyo mínimo no supere la cantidad. Devuelve null si la cantidad está
 * por debajo del primer tramo.
 */
export function decoQuote(option: DecoOption, units: number): DecoQuote | null {
  let tier: DecoTier | undefined;
  for (const t of option.tiers) if (units >= t.minUnits) tier = t;
  if (!tier) return null;
  const piecesTotal = tier.pricePerUnit * units;
  // Montaje y horneado NO se suma: la tarifa por pieza ya lo incluye.
  return { option, tier, units, perUnit: tier.pricePerUnit, piecesTotal, setup: 0, total: piecesTotal };
}

/**
 * Familia de decorado inferida de categoría + nombre (capacidad en ml).
 * Se usa para la carga inicial (scripts/assign-deco-family.ts); después se
 * edita en el Studio. Devuelve undefined si no aplica (latas, tapas, cajas…).
 */
export function inferDecoFamily(p: { category?: string; name?: string }): DecoFamily | undefined {
  const cat = (p.category ?? "").toLowerCase();
  const name = p.name ?? "";
  const m = name.replace(/\./g, "").match(/(\d+)\s*(ml|cc|cm3|l)\b/i);
  let ml: number | undefined;
  if (m) ml = m[2].toLowerCase() === "l" ? parseInt(m[1], 10) * 1000 : parseInt(m[1], 10);
  if (/pack|caja|valij/i.test(name)) return undefined;
  if (cat.startsWith("botellon")) {
    if (ml === undefined) return undefined;
    return ml <= 1000 ? "botellon-1l" : "botellon-2l";
  }
  if (cat.startsWith("botella")) {
    if (ml === undefined) return undefined;
    return ml <= 500 ? "botella-chica" : "botella-grande";
  }
  if (cat.startsWith("copas")) return "cristaleria";
  return undefined;
}
