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
export function shippingForCp(
  cp: string | undefined | null,
  wholesale = false,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): number {
  if (wholesale) return 0;
  // Modo "cotizar": el interior no muestra tarifa estimada, va "a cotizar".
  if (cfg.andreaniMode === "cotizar") return 0;
  const band = bandForCp(cp);
  return band ? cfg.andreani[band] : cfg.andreani.AMBA;
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
export const BATU_RATES: Record<BatuZone, { maxBultos: number; price: number }[]> = {
  1: [{ maxBultos: 2, price: 9900 }, { maxBultos: 4, price: 13200 }, { maxBultos: 7, price: 19800 }, { maxBultos: 10, price: 26400 }, { maxBultos: 15, price: 35200 }, { maxBultos: 20, price: 41800 }],
  2: [{ maxBultos: 2, price: 12100 }, { maxBultos: 4, price: 15400 }, { maxBultos: 7, price: 23100 }, { maxBultos: 10, price: 30800 }, { maxBultos: 15, price: 39600 }, { maxBultos: 20, price: 48400 }],
  3: [{ maxBultos: 2, price: 14300 }, { maxBultos: 4, price: 20900 }, { maxBultos: 7, price: 27500 }, { maxBultos: 10, price: 33000 }, { maxBultos: 15, price: 44000 }, { maxBultos: 20, price: 52800 }],
  4: [{ maxBultos: 2, price: 17600 }, { maxBultos: 4, price: 27500 }, { maxBultos: 7, price: 33000 }, { maxBultos: 10, price: 44000 }, { maxBultos: 15, price: 52800 }, { maxBultos: 20, price: 63800 }],
};

/* ─────────────────────────────────────────────────────────────
 * PESO AFORADO Y TARIFA POR TRAMO (Andreani "Paquetes")
 *
 * Relevado del panel Andreani Pymes el 10-sep-2026. Dos cosas que la tabla
 * vieja (plana ≤10 kg) no contemplaba y que cambian el número:
 *
 *  1. ANDREANI COBRA POR PESO AFORADO = max(peso real, volumen / 3000).
 *     Verificado: una caja de 60×60×60 cm sale lo MISMO con 1 kg que con
 *     20 kg ($164.476 a Neuquén). O sea: el aire se paga.
 *
 *  2. LA TARIFA ES POR PAQUETE, NO POR PEDIDO, y el primer tramo (≤20 kg) es
 *     un MÍNIMO PLANO. Pagar ese mínimo N veces es lo que hace impagable un
 *     pedido de varias cajas. Por eso CONSOLIDAR CONVIENE, y mucho: juntar
 *     cajas que ya vienen llenas no agrega volumen (el aforado se suma igual)
 *     pero se paga UN paquete en vez de N.
 *
 *     Medido a Neuquén, 6 cajas de cristalería (44×30×11, 3,4 kg c/u):
 *       · sueltas    → 6 × $54.222 = $325.332
 *       · en un bulto (66×60×22, 20,4 kg) → $88.387   (73% menos)
 *     Y 2 cajas de botella 330 ml: $176.774 sueltas vs $120.913 juntas.
 *
 *     Por eso el cálculo consolida: suma el aforado de todo el pedido y lo
 *     reparte en la MENOR cantidad de paquetes posible (50 kg cada uno). Es la
 *     configuración más barata que permite el servicio, y asume que DC despacha
 *     así. PENDIENTE DE CONFIRMAR CON MARCE: si en la práctica cada caja sale
 *     como paquete suelto, el costo real es bastante mayor.
 *
 * Tope del servicio: 50 kg por paquete y suma de lados ≤ 300 cm. Arriba de
 * eso el canal correcto es pallet, no paquetería → "a cotizar".
 * ───────────────────────────────────────────────────────────── */

/** Divisor de aforo de Andreani: cm³ por kg facturable. */
export const AFORO_DIVISOR = 3000;

/** Peso facturable de un bulto: el mayor entre el real y el volumétrico. */
export function aforadoKg(
  pesoKg: number | null | undefined,
  cm?: { largo?: number | null; ancho?: number | null; alto?: number | null } | null,
): number | null {
  const real = typeof pesoKg === "number" && pesoKg > 0 ? pesoKg : null;
  const l = cm?.largo ?? null, a = cm?.ancho ?? null, h = cm?.alto ?? null;
  const vol =
    l && a && h && l > 0 && a > 0 && h > 0 ? (l * a * h) / AFORO_DIVISOR : null;
  if (real === null && vol === null) return null;
  return Math.max(real ?? 0, vol ?? 0);
}

/** Tope de peso facturable por paquete (Andreani "Paquetes"). */
export const PAQUETE_MAX_KG = 50;

/**
 * Tope de peso facturable del PEDIDO ENTERO para seguir mostrando un estimado
 * de paquetería.
 *
 * Por qué 50 kg y no un número inventado: es el mismo umbral con el que
 * Andreani separa sus servicios ("Pallet: desde 50 kg en un mismo contenedor").
 * Arriba de eso el canal correcto deja de ser paquetería, y sumar paquete por
 * paquete da un número real pero inútil — 23 cajas de botella 330 ml a Neuquén
 * dan más de $2.000.000, cuando eso se despacha en pallet por una fracción.
 * Mostrarlo espantaría la venta con un precio que DC no va a cobrar.
 *
 * Es un corte PROVISORIO: se reemplaza por la comparación real contra la
 * tarifa de pallet cuando la tengamos cotizada.
 */
export const PEDIDO_MAX_KG = 50;

/** Tramos de peso facturable de la tarifa. El último tramo es el tope. */
export const WEIGHT_TIERS = [20, 35, 50] as const;

/** Tarifa A DOMICILIO por banda × tramo (ARS con IVA, panel Andreani 10-sep-2026).
 *  Índice = tramo de WEIGHT_TIERS. El primero coincide con SHIPPING_RATES. */
export const SHIPPING_RATES_BY_TIER: Record<ShippingBand, [number, number, number]> = {
  AMBA: [23074, 33895, 38534],
  B2: [43979, 70793, 91654],
  B3: [54222, 88387, 116788],
  B4: [66082, 108757, 145904],
};

/* ─────────────────────────────────────────────────────────────
 * CONFIG DE ENVÍOS EDITABLE (Sanity, singleton `shippingConfig`).
 * Las tarifas de arriba (SHIPPING_RATES / BATU_RATES) son los DEFAULTS.
 * Marce puede pisarlas desde el Studio; getShippingConfig() arma este
 * objeto (con fallback por campo a los defaults). Todo el cálculo de
 * envío toma un ShippingConfig, así el carrito, el checkout, el mensaje
 * de WhatsApp y el pedido server-side leen SIEMPRE los mismos valores.
 * ───────────────────────────────────────────────────────────── */

export interface ShippingConfig {
  /** Tramos de Batu por zona (CABA/GBA, envío propio). */
  batu: Record<BatuZone, { maxBultos: number; price: number }[]>;
  /** Tarifa de Andreani por banda (interior), tramo ≤20 kg. Legado: se
   *  conserva para no romper el Studio; el cálculo usa `andreaniByTier`. */
  andreani: Record<ShippingBand, number>;
  /** Tarifa de Andreani por banda × tramo de peso facturable (≤20 / ≤35 / ≤50 kg). */
  andreaniByTier?: Record<ShippingBand, [number, number, number]>;
  /** "estimado" = el interior muestra la tarifa de banda; "cotizar" = el
   *  interior va "a cotizar" (no se suma monto, se coordina por WhatsApp). */
  andreaniMode: "estimado" | "cotizar";
}

/** Config por defecto = las tarifas hardcodeadas actuales. Es el fallback si
 *  Sanity no tiene el documento o algún campo es inválido. */
export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  batu: BATU_RATES,
  andreani: SHIPPING_RATES,
  andreaniByTier: SHIPPING_RATES_BY_TIER,
  andreaniMode: "estimado",
};

/** Precio Batu por zona + cantidad de bultos (usa el tramo cuyo tope ≥ bultos). */
export function batuShipping(
  zone: BatuZone,
  bultos: number,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): number {
  const rows = cfg.batu[zone] ?? DEFAULT_SHIPPING_CONFIG.batu[zone];
  const b = Math.max(1, bultos);
  return (rows.find((r) => b <= r.maxBultos) ?? rows[rows.length - 1]).price;
}

/**
 * Costo de UN bulto de `kg` facturables a esa banda. null = fuera de tabla.
 *
 * Precisión: exacto en los puntos medidos. En el extremo superior del rango
 * (cerca de 50 kg por volumen) Andreani deja de usar tramos y pasa a cobrar
 * lineal por volumen, así que ahí el tramo queda ~3-4% por debajo del precio
 * real (medido: $120.913 vs $116.788 de tabla). Como el envío se muestra
 * SIEMPRE como estimado y se confirma al cerrar, se acepta.
 */
export function rateForBulto(
  band: ShippingBand,
  kg: number,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): number | null {
  if (!(kg > 0) || kg > PAQUETE_MAX_KG) return null;
  const tiers = cfg.andreaniByTier?.[band] ?? SHIPPING_RATES_BY_TIER[band];
  const i = WEIGHT_TIERS.findIndex((max) => kg <= max);
  return i < 0 ? null : tiers[i];
}

/** Un bulto del carrito, ya resuelto a peso facturable. */
export interface Bulto {
  /** peso facturable (aforado). null = no sabemos cuánto pesa ese producto */
  kg: number | null;
  /** cuántos bultos iguales */
  cantidad: number;
}

export interface ShippingQuote {
  /** total estimado; 0 cuando hay que cotizar */
  total: number;
  /** true → no se puede estimar, va "a cotizar" */
  toQuote: boolean;
  /** por qué hay que cotizar (para el cartel y para el pedido) */
  reason?: "sin-peso" | "bulto-grande" | "pedido-grande" | "mayorista";
}

/**
 * Envío al interior (Andreani): suma bulto por bulto.
 * Va "a cotizar" si algún producto no tiene peso cargado o si un bulto pasa
 * los 50 kg facturables (ahí corresponde pallet, no paquetería).
 */
export function andreaniQuote(
  cp: string | undefined | null,
  bultos: Bulto[],
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): ShippingQuote {
  const band = bandForCp(cp) ?? "AMBA";
  let kgTotal = 0;
  for (const b of bultos) {
    const n = Math.max(0, Math.round(b.cantidad));
    if (n === 0) continue;
    if (b.kg === null) return { total: 0, toQuote: true, reason: "sin-peso" };
    // Un solo bulto que ya no entra en paquetería (caja enorme o pallet).
    if (b.kg > PAQUETE_MAX_KG) return { total: 0, toQuote: true, reason: "bulto-grande" };
    kgTotal += b.kg * n;
  }
  if (kgTotal <= 0) return { total: 0, toQuote: false };
  // Pedido grande: ya no es paquetería (ver PEDIDO_MAX_KG).
  if (kgTotal > PEDIDO_MAX_KG) return { total: 0, toQuote: true, reason: "pedido-grande" };
  // Se consolida en la menor cantidad de paquetes posible y se reparte parejo,
  // que es la configuración más barata del servicio (ver nota de cabecera).
  const paquetes = Math.max(1, Math.ceil(kgTotal / PAQUETE_MAX_KG));
  const rate = rateForBulto(band, kgTotal / paquetes, cfg);
  if (rate === null) return { total: 0, toQuote: true, reason: "bulto-grande" };
  return { total: rate * paquetes, toQuote: false };
}

/**
 * Estimador de envío unificado (cliente final).
 *  - Mayorista → 0 ("a cotizar").
 *  - Si eligió zona Batu (CABA/GBA) → tarifa propia por zona × bultos.
 *  - Si no → Andreani por peso facturable, bulto por bulto.
 */
export function shippingEstimate(
  opts: {
    cp?: string | null;
    batuZone?: BatuZone | null;
    bultos?: number;
    wholesale?: boolean;
    /** desglose por bulto para la tarifa por peso (interior) */
    detalle?: Bulto[];
  },
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): ShippingQuote {
  const { cp, batuZone, bultos = 1, wholesale = false, detalle } = opts;
  if (wholesale) return { total: 0, toQuote: true, reason: "mayorista" };
  // CABA/GBA con envío propio: tarifa por zona × bultos (más barata que
  // Andreani y ya escala con la cantidad).
  if (batuZone) return { total: batuShipping(batuZone, bultos, cfg), toQuote: false };
  if (cfg.andreaniMode === "cotizar") return { total: 0, toQuote: true };
  return andreaniQuote(cp, detalle ?? [{ kg: null, cantidad: bultos }], cfg);
}
