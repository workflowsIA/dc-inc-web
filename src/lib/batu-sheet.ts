/**
 * Tarifario de DESPACHO BATU leído de la planilla de precios.
 *
 * Por qué existe (Marce, 11-sep-2026): "Es Neto, pero es importante que este
 * tarifario lo tomes desde la hoja ProductosDC-Todos. Donde están los
 * productos, también están los servicios. Fila 1001 a 1047 está lo de Batu.
 * Incluso tiene precio en columna minorista y también en mayorista."
 *
 * Hasta ese día la tarifa de Batu vivía hardcodeada en shipping.ts (relevada a
 * mano del tarifario de julio) y editable a mano en el Studio. Dos problemas:
 * se desactualizaba sola, y estaba cargada como si fuera precio FINAL cuando en
 * realidad es NETO — o sea que el sitio venía cobrando 21% de menos en todos
 * los envíos de CABA y GBA. Ahora el sync la trae de la planilla en cada
 * corrida y el IVA se suma en shipping.ts (ver BATU_RATES_ARE_NET).
 *
 * Formato de las filas (SKU): DBZ<zona><desde>A<hasta>[G]
 *   DBZ11A2    → zona 1, de 1 a 2 bultos
 *   DBZ111A15  → zona 1, de 11 a 15 bultos
 *   DBZ19A10G  → zona 1, de 9 a 10 bultos GRANDES
 * La zona es SIEMPRE un dígito (1-4) y el resto son los topes del tramo, así
 * que "111A15" se lee zona 1 + tramo 11-15 sin ambigüedad.
 *
 * Precios (los dos NETOS, por viaje, UxB = 1):
 *   pricePublic    = "Precio unitario MINORISTA" (trae el 7% de Nave)
 *   priceWholesale = "Precio unitario MAYORISTA"
 * Hoy el cálculo usa el minorista: el mayorista compra con envío "a cotizar"
 * (ver shippingEstimate), así que su tarifa se guarda como referencia y no se
 * cobra desde la web.
 *
 * BULTOS GRANDES: la planilla tiene una segunda escala, más cara y con tramos
 * más cortos, para los bultos grandes. Se parsea y se devuelve aparte, pero el
 * cálculo TODAVÍA NO LA USA: falta que Marce defina cómo se cobra un pedido
 * mixto (2 grandes + 3 chicos, ¿un despacho de cada uno, o todo por la escala
 * grande?). Es la misma pregunta que abrió él con las latas —livianas pero
 * voluminosas— el 11-sep. Cuando la conteste, se engancha acá.
 */

export type BatuZoneNum = 1 | 2 | 3 | 4;

export interface BatuTramo {
  /** Tope del tramo: hasta N bultos. */
  maxBultos: number;
  /** NETO por viaje, minorista (el que cobra la web). */
  price: number;
  /** NETO por viaje, mayorista (referencia; hoy no se cobra desde la web). */
  priceWholesale?: number;
  /** SKU de la fila de la planilla, para poder rastrear de dónde salió. */
  sku: string;
}

export interface BatuSheetRates {
  /** Escala normal, por zona. */
  zones: Record<BatuZoneNum, BatuTramo[]>;
  /** Escala de bultos GRANDES, por zona. Todavía no se usa en el cálculo. */
  grandes: Record<BatuZoneNum, BatuTramo[]>;
  /** Filas DBZ que no se pudieron interpretar (SKU con otro formato). */
  unparsed: string[];
}

const RE = /^DBZ([1-4])(\d+)A(\d+)(G)?$/;

function empty(): Record<BatuZoneNum, BatuTramo[]> {
  return { 1: [], 2: [], 3: [], 4: [] };
}

/**
 * Arma el tarifario de Batu a partir de las filas de la planilla ya
 * normalizadas por toPriceRows() (precios NETOS por unidad, UxB = 1).
 */
export function parseBatuRates(
  rows: {
    sku: string;
    pricePublic: number | null;
    priceWholesale: number | null;
  }[],
): BatuSheetRates {
  const zones = empty();
  const grandes = empty();
  const unparsed: string[] = [];

  for (const r of rows) {
    const sku = (r.sku ?? "").trim().toUpperCase();
    if (!sku.startsWith("DBZ")) continue;
    const m = RE.exec(sku);
    if (!m) {
      unparsed.push(sku);
      continue;
    }
    // El precio que cobra la web es el minorista; si la planilla no lo trae
    // para ese tramo, se cae al mayorista antes que dejar el tramo afuera.
    const price = r.pricePublic ?? r.priceWholesale;
    if (price === null || !(price > 0)) {
      unparsed.push(sku);
      continue;
    }
    const zone = Number(m[1]) as BatuZoneNum;
    const maxBultos = Number(m[3]);
    if (!Number.isFinite(maxBultos) || maxBultos <= 0) {
      unparsed.push(sku);
      continue;
    }
    const target = m[4] ? grandes : zones;
    const list = target[zone];
    if (list.some((t) => t.maxBultos === maxBultos)) continue;
    list.push({
      maxBultos,
      price,
      ...(r.priceWholesale != null && r.priceWholesale > 0
        ? { priceWholesale: r.priceWholesale }
        : {}),
      sku,
    });
  }

  for (const t of [zones, grandes]) {
    for (const z of [1, 2, 3, 4] as BatuZoneNum[]) {
      t[z].sort((a, b) => a.maxBultos - b.maxBultos);
    }
  }
  return { zones, grandes, unparsed };
}

/** true si el tarifario leído sirve para reemplazar al hardcodeado: las cuatro
 *  zonas con al menos un tramo. Con menos que eso NO se pisa la config (mejor
 *  la tarifa vieja que media tabla). */
export function isCompleteBatuRates(r: BatuSheetRates): boolean {
  return ([1, 2, 3, 4] as BatuZoneNum[]).every((z) => r.zones[z].length > 0);
}
