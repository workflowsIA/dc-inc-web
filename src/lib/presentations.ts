/**
 * Cantidad de unidades de una presentación a partir de su etiqueta
 * ("24un en Caja", "Pallet x 2.025", "Caja 12 u (500 ml)").
 *
 * Antes se tomaba el PRIMER número que apareciera en el texto: una etiqueta
 * como "500 ml x 24 en Caja" daba 500 unidades por caja (y un total de caja
 * de $1M+). Ahora:
 *   - se ignoran los números seguidos de una medida (ml, cc, l, cl, mm, cm,
 *     g, gr, kg, oz, %);
 *   - se prefiere el número acompañado de "u"/"un"/"unid"/"unidades"/"piezas"
 *     o precedido de "x";
 *   - si no hay ninguno así, el último número que quede.
 * Devuelve 1 si no encuentra nada (unidad).
 */
const MEASURE = /^(ml|cc|cl|lt?|mm|cm|gr?|kg|oz|%)/i;
const UNIT_WORD = /^(u|un|unid|unids|unidad|unidades|pz|pzas|piezas|bot|botellas|latas|copas|vasos)\b/i;

export function parsePresentationUnits(label: string): number {
  if (!label) return 1;
  // "2.025" → "2025" (miles con punto). No tocamos "0,5" ni decimales con coma.
  const s = label.replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2");
  const re = /(\d+)/g;
  const candidates: { n: number; unitWord: boolean; afterX: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const after = s.slice(m.index + m[1].length).replace(/^\s+/, "");
    const before = s.slice(0, m.index).replace(/\s+$/, "");
    if (MEASURE.test(after)) continue; // "500 ml" → medida, no cantidad
    candidates.push({
      n,
      unitWord: UNIT_WORD.test(after),
      afterX: /[x×]$/i.test(before),
    });
  }
  if (!candidates.length) return 1;
  const strong = candidates.find((c) => c.unitWord || c.afterX);
  return (strong ?? candidates[candidates.length - 1]).n;
}

/** Opción de compra derivada de la planilla de precios. */
export interface PresentationOption {
  /** "Caja x20", "Pallet x1.350", "Paquete x100 · Lisa Negra" */
  label: string;
  units: number;
  /** SKU de la fila variante en la planilla (para reprecio server-side) */
  sku?: string;
  /** clave estable para listas/lookup: el SKU de la fila o, si falta, las unidades */
  key: string;
}

/**
 * Presentaciones que se OFRECEN a la venta: exactamente las filas Caja/Pallet
 * que tiene el producto en la planilla de precios (`presentationPricing`, lo
 * carga el sync). No todos los productos se venden en todas las presentaciones:
 * si la planilla no tiene fila de caja, no hay caja. (Antes los chips salían
 * del texto "Presentaciones" heredado de Wix, que ofrecía cajas inexistentes.)
 * Ordenadas de menor a mayor, sin repetir cantidades. No incluye la unidad.
 */
export function presentationOptions(
  pricing:
    | { sku?: string; label?: string; variant?: string; unitsPerBulk?: number }[]
    | undefined,
): PresentationOption[] {
  // Se dedupe por SKU de fila (no por unidades): dos filas pueden tener las
  // mismas unidades y ser presentaciones distintas (paquete x100 por color).
  const byKey = new Map<string, PresentationOption>();
  for (const pp of pricing ?? []) {
    const units = pp.unitsPerBulk ?? 0;
    if (!Number.isFinite(units) || units <= 1) continue;
    const key = pp.sku?.trim() || String(units);
    if (byKey.has(key)) continue;
    const base = (pp.label ?? "").trim() || "Bulto";
    const variant = (pp.variant ?? "").trim();
    byKey.set(key, {
      label: `${base} x${units.toLocaleString("es-AR")}${variant ? ` · ${variant}` : ""}`,
      units,
      sku: pp.sku,
      key,
    });
  }
  return [...byKey.values()].sort(
    (a, b) => a.units - b.units || a.label.localeCompare(b.label, "es"),
  );
}
