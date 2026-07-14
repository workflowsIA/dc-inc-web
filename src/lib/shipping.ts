/**
 * Costo de envío estimado — Andreani (a domicilio, ≤10 kg, origen Villa Maipú).
 *
 * Relevado del panel Andreani Pymes (cuenta DC Inc) el 13-jul-2026.
 * La tarifa negociada tiene 4 BANDAS de precio (no 8 zonas) y es PLANA hasta
 * ~10 kg → el costo NO depende del peso (mientras sea ≤10 kg), sólo del destino.
 * Online vende sólo minorista ≤10 kg; envíos más pesados / pallets cierran por
 * WhatsApp. Se muestra como ESTIMADO y se confirma al cerrar el pedido.
 *
 * La banda se infiere del CP con rangos aproximados (los CP argentinos se pisan
 * en algunos bordes, pero al ser un estimado confirmado al cierre, alcanza).
 */

export type ShippingBand = "AMBA" | "B2" | "B3" | "B4";

/** Tarifa "a domicilio" (≤10 kg) por banda, en ARS. */
export const SHIPPING_RATES: Record<ShippingBand, number> = {
  AMBA: 23074, // CABA + GBA (conurbano)
  B2: 43979, // Buenos Aires interior + Centro (Córdoba, Santa Fe, Entre Ríos, La Pampa)
  B3: 54222, // Cuyo (Mendoza, San Juan, San Luis) + Patagonia + NEA (Chaco, Corrientes, Misiones, Formosa)
  B4: 66082, // NOA (Salta, Jujuy, Tucumán, Catamarca, Sgo. del Estero, La Rioja)
};

/** Etiqueta legible de cada banda (para UI / debug). */
export const SHIPPING_BAND_LABEL: Record<ShippingBand, string> = {
  AMBA: "CABA y GBA",
  B2: "Buenos Aires interior y Centro",
  B3: "Cuyo, Patagonia y NEA",
  B4: "NOA",
};

/** Tarifa más barata — para el "Envío desde $X" cuando aún no se conoce el destino. */
export const SHIPPING_FROM = SHIPPING_RATES.AMBA;

/** Extrae el CP numérico de 4 dígitos de un texto ("1650", "B1650ABC", "cp 1650"). */
function parseCp(cp: string | undefined | null): number | null {
  if (!cp) return null;
  const m = String(cp).match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

/**
 * Infiere la banda de tarifa a partir del CP. Rangos aproximados por provincia;
 * los verificados en el relevamiento (CABA 1000, Lanús 1824, Mar del Plata 7600,
 * Córdoba 5000, Mendoza 5500, Neuquén 8300, Resistencia 3500, Salta 4400) caen
 * en la banda correcta. Devuelve null si el CP no es válido.
 */
export function bandForCp(cp: string | undefined | null): ShippingBand | null {
  const n = parseCp(cp);
  if (n === null) return null;
  if (n >= 1000 && n <= 1499) return "AMBA"; // CABA
  if (n >= 1600 && n <= 1900) return "AMBA"; // GBA (conurbano)
  if (n >= 3300 && n <= 3799) return "B3"; // NEA
  if (n >= 4000 && n <= 4999) return "B4"; // NOA
  if (n >= 5000 && n <= 5299) return "B2"; // Córdoba
  if (n >= 5300 && n <= 5399) return "B4"; // La Rioja
  if (n >= 5400 && n <= 5999) return "B3"; // Cuyo
  if (n >= 8200 && n <= 9999) return "B3"; // Patagonia
  // Buenos Aires interior + Santa Fe/Entre Ríos + Bs As sur + La Pampa
  if ((n >= 1500 && n <= 3299) || (n >= 3800 && n <= 3999) || (n >= 6000 && n <= 8199)) {
    return "B2";
  }
  return null;
}

/**
 * Costo de envío estimado por banda de CP (interior / fallback).
 *  - Mayorista → 0 (el envío se cotiza aparte, "a cotizar").
 *  - Cliente final → tarifa de la banda del CP.
 *  - CP desconocido/vacío → AMBA (la más barata) como default provisorio.
 */
export function shippingForCp(cp: string | undefined | null, wholesale = false): number {
  if (wholesale) return 0;
  const band = bandForCp(cp);
  return band ? SHIPPING_RATES[band] : SHIPPING_RATES.AMBA;
}

/* ─────────────────────────────────────────────────────────────
 * DESPACHO BATU — envío propio DC Inc dentro de CABA / GBA.
 * Tarifa por ZONA (partido) × CANTIDAD DE BULTOS. Columna PÚBLICO
 * del tarifario de Marce (13-jul-2026). Más barato que Andreani local.
 * ───────────────────────────────────────────────────────────── */

export type BatuZone = 1 | 2 | 3 | 4;

/** Partidos de cada zona (para el selector del checkout). */
export const BATU_ZONE_OPTIONS: { zone: BatuZone; label: string }[] = [
  { zone: 1, label: "Zona 1 — CABA, Vicente López, San Isidro, San Martín, Tres de Febrero, Villa Adelina" },
  { zone: 2, label: "Zona 2 — Lanús, Lomas, Avellaneda, Morón, Hurlingham, San Fernando, Ituzaingó, La Matanza (N)" },
  { zone: 3, label: "Zona 3 — Quilmes, Tigre, Moreno, Merlo, San Miguel, Malvinas Argentinas, Berazategui, Florencio Varela, Almirante Brown, José C. Paz, La Matanza (S)" },
  { zone: 4, label: "Zona 4 — La Plata, Pilar, Escobar, Ezeiza, Canning" },
];

/** Tarifa PÚBLICO por zona: tramos de cantidad de bultos (hasta N → precio). */
const BATU_RATES: Record<BatuZone, { maxBultos: number; price: number }[]> = {
  1: [{ maxBultos: 2, price: 9900 }, { maxBultos: 4, price: 13200 }, { maxBultos: 7, price: 19800 }, { maxBultos: 10, price: 26400 }, { maxBultos: 15, price: 35200 }, { maxBultos: 20, price: 41800 }],
  2: [{ maxBultos: 2, price: 12100 }, { maxBultos: 4, price: 15400 }, { maxBultos: 7, price: 23100 }, { maxBultos: 10, price: 30800 }, { maxBultos: 15, price: 39600 }, { maxBultos: 20, price: 48400 }],
  3: [{ maxBultos: 2, price: 14300 }, { maxBultos: 4, price: 20900 }, { maxBultos: 7, price: 27500 }, { maxBultos: 10, price: 33000 }, { maxBultos: 15, price: 44000 }, { maxBultos: 20, price: 52800 }],
  4: [{ maxBultos: 2, price: 17600 }, { maxBultos: 4, price: 27500 }, { maxBultos: 7, price: 33000 }, { maxBultos: 10, price: 44000 }, { maxBultos: 15, price: 52800 }, { maxBultos: 20, price: 63800 }],
};

/** Precio Batu por zona + cantidad de bultos (usa el tramo cuyo tope ≥ bultos). */
export function batuShipping(zone: BatuZone, bultos: number): number {
  const rows = BATU_RATES[zone];
  const b = Math.max(1, bultos);
  return (rows.find((r) => b <= r.maxBultos) ?? rows[rows.length - 1]).price;
}

/**
 * Estimador de envío unificado (cliente final).
 *  - Mayorista → 0 ("a cotizar").
 *  - Si eligió zona Batu (CABA/GBA) → tarifa propia por zona × bultos.
 *  - Si no → banda de CP (interior / fallback).
 */
export function shippingEstimate(opts: {
  cp?: string | null;
  batuZone?: BatuZone | null;
  bultos?: number;
  wholesale?: boolean;
}): number {
  const { cp, batuZone, bultos = 1, wholesale = false } = opts;
  if (wholesale) return 0;
  if (batuZone) return batuShipping(batuZone, bultos);
  return shippingForCp(cp, wholesale);
}
