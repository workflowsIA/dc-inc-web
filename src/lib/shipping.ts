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

/**
 * Normaliza un CP argentino escrito de cualquier forma ("5.515", "5 515",
 * "M5515ABC", "C1425DKA") al string de 4 dígitos ("5515"). Saca todo lo que no
 * sea dígito y exige que queden EXACTAMENTE 4, entre 1000 y 9999 — si el
 * cliente escribió el punto de mil ("5.515") o le agregó la letra del CPA
 * ("M5515ABC"), igual se reconoce; si el resultado tiene menos o más de 4
 * dígitos ("551", "55155") o cae fuera de rango ("0123"), es basura y se
 * devuelve null: MEJOR pedir el CP de nuevo que inventarle una banda.
 */
export function normalizeCp(cp: string | undefined | null): string | null {
  if (!cp) return null;
  const digits = String(cp).replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const n = parseInt(digits, 10);
  if (n < 1000 || n > 9999) return null;
  return digits;
}

/** ¿`cp` normaliza a un código postal de 4 dígitos válido? */
export function isValidCp(cp: string | undefined | null): boolean {
  return normalizeCp(cp) !== null;
}

/** Extrae el CP numérico de 4 dígitos de un texto ("1650", "B1650ABC", "5.515"). */
function parseCp(cp: string | undefined | null): number | null {
  const norm = normalizeCp(cp);
  return norm ? parseInt(norm, 10) : null;
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
 *  - CP inválido/vacío → 0. Ya NO cae a AMBA como default provisorio: sin un
 *    CP válido no hay banda que cobrar, y mostrar la más barata como si fuera
 *    el costo real termina cobrando de menos (caso Maipú, Mendoza: CP "5.515"
 *    mal tipeado se cobró como AMBA en vez de B3). Quien llame a esta función
 *    debe tratar el 0 como "no se puede estimar todavía", nunca como "gratis".
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
  return band ? cfg.andreani[band] : 0;
}

/* ─────────────────────────────────────────────────────────────
 * DESPACHO BATU — envío propio DC Inc dentro de CABA / GBA.
 * Tarifa por ZONA (partido) × CANTIDAD DE BULTOS. Columna PÚBLICO
 * del tarifario de Marce (13-jul-2026). Más barato que Andreani local.
 * ───────────────────────────────────────────────────────────── */

export type BatuZone = 1 | 2 | 3 | 4;

/** Partidos de cada zona (para el selector del checkout). */
/**
 * ¿El CP admite envío propio (Batu)? Batu solo reparte en CABA + GBA, que son
 * los CP 1000–1999. Sin CP válido no hay con qué contradecir la zona → true.
 */
export function cpAllowsBatu(cp: string | undefined | null): boolean {
  const n = parseCp(cp);
  return n === null || (n >= 1000 && n <= 1999);
}

/**
 * Zona Batu que efectivamente se cobra: EL CP PISA A LA ZONA. Caso real
 * #394100-OO6 (25-sep-2026): cliente de El Carmen, Jujuy (CP 4603) que dejó el
 * selector en "Zona 1" (el default) y se le cotizó Batu en vez de Andreani.
 * Si el CP es válido y no es de CABA/GBA, se ignora la zona y se usa el CP.
 */
export function effectiveBatuZone(
  cp: string | undefined | null,
  zone: BatuZone | null | undefined,
): BatuZone | null {
  if (!zone) return null;
  return cpAllowsBatu(cp) ? zone : null;
}

export const BATU_ZONE_OPTIONS: { zone: BatuZone; label: string }[] = [
  { zone: 1, label: "Zona 1 — CABA, Vicente López, San Isidro, San Martín, Tres de Febrero, Villa Adelina" },
  { zone: 2, label: "Zona 2 — Lanús, Lomas, Avellaneda, Morón, Hurlingham, San Fernando, Ituzaingó, La Matanza (N)" },
  { zone: 3, label: "Zona 3 — Quilmes, Tigre, Moreno, Merlo, San Miguel, Malvinas Argentinas, Berazategui, Florencio Varela, Almirante Brown, José C. Paz, La Matanza (S)" },
  { zone: 4, label: "Zona 4 — La Plata, Pilar, Escobar, Ezeiza, Canning" },
];

/**
 * Tarifa por zona: tramos de cantidad de bultos (hasta N → precio NETO).
 *
 * Es solo el FALLBACK: desde el 12-sep-2026 el sync trae esta tabla de la
 * planilla (`ProductosDC-Todos`, filas de despacho DBZ…) y la escribe en el
 * singleton de configuración de envíos. Ver src/lib/batu-sheet.ts. Los números
 * de acá son la columna mayorista del tarifario de julio, en NETO.
 */
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

/**
 * La tarifa de ANDREANI que devuelve el cálculo es PRECIO FINAL, con IVA
 * incluido: se relevó del panel Pymes, que cotiza con IVA.
 *
 * Importa porque el total del pedido suma IVA sobre productos + envío: si el
 * envío ya viene con IVA, hay que pasarlo a neto antes de sumarlo, o se le
 * cobra el 21% dos veces (un envío de $23.074 se facturaba $27.919).
 *
 * OJO: la de BATU es NETA en origen (ver BATU_RATES_ARE_NET). Para que este
 * flag siga valiendo para todo el que consuma una cotización, batuShipping()
 * le suma el IVA ANTES de devolverla: de la mitad del cálculo para abajo,
 * todas las tarifas están en la misma base.
 */
export const SHIPPING_RATES_INCLUDE_IVA = true;

/** IVA que se le suma a la tarifa neta de Batu. Constante local a propósito:
 *  shipping.ts no importa de pricing.ts para no acoplar el cálculo de envío
 *  al de precios. */
const IVA_ENVIO = 0.21;

/**
 * Las tarifas de Batu (tanto las de la planilla como el default de acá abajo)
 * son NETAS. Confirmado por Marce el 11-sep-2026: "Es Neto, pero es importante
 * que este tarifario lo tomes desde la hoja ProductosDC-Todos".
 *
 * Hasta ese día se cargaban como si fueran finales, así que el sitio venía
 * cobrando 21% de menos en TODOS los envíos de CABA y GBA.
 */
export const BATU_RATES_ARE_NET = true;

/** Envío en NETO, para poder sumarle el IVA junto con los productos. */
export function shippingNet(total: number, ivaRate = 0.21): number {
  return SHIPPING_RATES_INCLUDE_IVA ? total / (1 + ivaRate) : total;
}

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

/**
 * Una fila de la planilla de inventario con peso y medidas: puede ser el
 * producto base o una presentación (caja / pallet / paquete).
 */
export interface DimsRow {
  pesoKg?: number | null;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
  /** Unidades que contiene ESE bulto. */
  unitsPerBulk?: number | null;
}

/** ¿Esta fila trae peso o medidas cargadas? */
export function tieneDims(d?: DimsRow | null): boolean {
  return !!d && (d.pesoKg != null || d.largoCm != null);
}

/**
 * Peso facturable POR UNIDAD del producto.
 *
 * Marce carga el peso y las medidas en la fila de la CAJA (`…C`) y deja
 * vacías las de la unidad y las del pallet — es lo razonable, porque lo que
 * se pesa es el bulto. Hasta el 15-sep-2026 el cálculo sólo miraba la fila
 * de la presentación elegida y, si no, la del producto base: comprando
 * "Individual" las dos vienen vacías y el envío se quedaba sin peso. Sin
 * peso no corre la consolidación (`consolidar` → `sinPeso`) y cada lado caía
 * a su propio conteo crudo de bultos: el carrito contaba 1 por línea y
 * /api/orders 1 por unidad, así que el cliente veía un precio en la página y
 * Nave le pedía otro (pedido #380123-LYV: 10 mini botellas de 50 ml, $18.528
 * en el sitio contra $39.891 en Nave).
 *
 * El orden de búsqueda es del dato más específico al más general:
 *   1. la fila de la presentación elegida,
 *   2. la del producto base,
 *   3. CUALQUIER presentación que tenga medidas — la de menos unidades, que
 *      es la caja y no el pallet: extrapolar desde la caja se acerca mucho
 *      más y además el pallet casi nunca tiene el dato cargado.
 *
 * Siempre se divide por las unidades de la fila de la que salió el peso, así
 * que el resultado es comparable venga de donde venga. null = no hay peso en
 * ningún lado → el envío va "a cotizar" (o al fallback de quien llame).
 */
export function pesoUnitarioAforado(opts: {
  /** fila de la presentación elegida; undefined al comprar por unidad */
  pres?: DimsRow | null;
  /** fila del producto base */
  base?: DimsRow | null;
  /** unidades del bulto base (product.bulto / unitsPerBulk) */
  baseUnits?: number | null;
  /** todas las presentaciones del producto, para el fallback a la caja */
  presentaciones?: readonly (DimsRow | null | undefined)[] | null;
}): number | null {
  const fuente = fuenteDeDims(opts);
  if (!fuente) return null;
  const aforado = aforadoKg(fuente.row.pesoKg, {
    largo: fuente.row.largoCm,
    ancho: fuente.row.anchoCm,
    alto: fuente.row.altoCm,
  });
  if (aforado === null) return null;
  const units = fuente.units > 0 ? fuente.units : 1;
  return aforado / units;
}

/** De qué fila sale el peso y a cuántas unidades corresponde. */
function fuenteDeDims(opts: {
  pres?: DimsRow | null;
  base?: DimsRow | null;
  baseUnits?: number | null;
  presentaciones?: readonly (DimsRow | null | undefined)[] | null;
}): { row: DimsRow; units: number } | null {
  const { pres, base, baseUnits, presentaciones } = opts;
  if (tieneDims(pres)) {
    return { row: pres!, units: pres!.unitsPerBulk ?? baseUnits ?? 1 };
  }
  if (tieneDims(base)) {
    return { row: base!, units: baseUnits ?? base!.unitsPerBulk ?? 1 };
  }
  // Fallback: la presentación con medidas que menos unidades tenga (la caja).
  let mejor: { row: DimsRow; units: number } | null = null;
  for (const p of presentaciones ?? []) {
    if (!tieneDims(p)) continue;
    const units = p!.unitsPerBulk ?? 0;
    if (!(units > 0)) continue; // sin saber cuántas unidades trae no se prorratea
    if (!mejor || units < mejor.units) mejor = { row: p!, units };
  }
  return mejor;
}

/** Tope de peso facturable por paquete (Andreani "Paquetes"). */
export const PAQUETE_MAX_KG = 50;

/**
 * Tope de peso facturable para que un bulto se pueda CONSOLIDAR con otros.
 *
 * Regla de Marce (10-sep-2026): "si el bulto es chico, como el de una caja de
 * vasos o copas de 12 unidades, lo unimos; si son dos cajas grandes, no". O
 * sea: el deposito junta lo chico en un paquete y despacha lo grande por
 * separado. Antes el calculo consolidaba TODO, que subestima el flete de dos
 * cajas grandes; y contaba cada unidad suelta como un bulto propio, que lo
 * sobreestima. Las dos cosas se arreglan con esta regla.
 *
 * 10 kg facturables parte justo por el medio de los dos casos medidos en el
 * panel de Andreani:
 *  - caja de 12 copas (44x30x11, 3,4 kg reales -> 4,84 aforados) = CHICA.
 *    Seis de esas se juntan en un paquete de 29 kg = $88.387 a Neuquen, que
 *    es exactamente lo medido para el bulto consolidado.
 *  - caja de botella 330 ml (~25-30 kg aforados) = GRANDE. Dos de esas salen
 *    como dos paquetes ($88.387 cada una = $176.774), tambien lo medido.
 */
export const BULTO_CONSOLIDA_MAX_KG = 10;

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
  /** Hasta cuántos kg facturables un bulto se junta con otros en el despacho.
   *  Ver BULTO_CONSOLIDA_MAX_KG. */
  bultoConsolidaMaxKg?: number;
}

/** Config por defecto = las tarifas hardcodeadas actuales. Es el fallback si
 *  Sanity no tiene el documento o algún campo es inválido. */
export const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  batu: BATU_RATES,
  andreani: SHIPPING_RATES,
  andreaniByTier: SHIPPING_RATES_BY_TIER,
  andreaniMode: "estimado",
  bultoConsolidaMaxKg: BULTO_CONSOLIDA_MAX_KG,
};

/**
 * Precio Batu por zona + cantidad de bultos (usa el tramo cuyo tope >= bultos).
 *
 * Devuelve PRECIO FINAL con IVA, aunque la tabla esté cargada en neto
 * (BATU_RATES_ARE_NET): así todo lo que consume una cotización de envío
 * —carrito, checkout, WhatsApp, /api/orders— trabaja con tarifas en la misma
 * base y el desglose neto/IVA se hace en un solo lugar (shippingNet).
 */
export function batuShipping(
  zone: BatuZone,
  bultos: number,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): number {
  const rows = cfg.batu[zone] ?? DEFAULT_SHIPPING_CONFIG.batu[zone];
  const b = Math.max(1, bultos);
  const neto = (rows.find((r) => b <= r.maxBultos) ?? rows[rows.length - 1]).price;
  return BATU_RATES_ARE_NET ? neto * (1 + IVA_ENVIO) : neto;
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
  reason?: "sin-peso" | "bulto-grande" | "pedido-grande" | "mayorista" | "cp";
}

/** Cómo queda el pedido una vez aplicada la regla de consolidación. */
export interface Consolidado {
  /** peso facturable de cada PAQUETE que sale del depósito */
  paquetes: number[];
  /** algún producto no tiene peso cargado en la planilla → no se puede estimar */
  sinPeso: boolean;
  /** un solo bulto ya excede el máximo de paquetería (corresponde pallet) */
  bultoGrande: boolean;
}

/**
 * Aplica la regla de despacho de Marce a los bultos del pedido.
 *
 * Los bultos CHICOS (≤ BULTO_CONSOLIDA_MAX_KG facturables) se suman y se
 * reparten en la menor cantidad de paquetes posible: es lo que hace el
 * depósito y lo que cobra Andreani, porque el primer tramo de la tarifa es un
 * mínimo plano y pagarlo N veces es lo que hace impagable un pedido chico.
 * Los bultos GRANDES salen de a uno, cada uno como su propio paquete.
 *
 * Es la única fuente de verdad de "cuántos paquetes salen": la usan tanto la
 * tarifa de Andreani como la de Batu (que cobra por cantidad de bultos), así
 * que el carrito, el checkout y el pedido guardado dan siempre el mismo número.
 */
export function consolidar(
  bultos: Bulto[],
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): Consolidado {
  const maxChico =
    typeof cfg.bultoConsolidaMaxKg === "number" && cfg.bultoConsolidaMaxKg > 0
      ? cfg.bultoConsolidaMaxKg
      : BULTO_CONSOLIDA_MAX_KG;
  const paquetes: number[] = [];
  let chicoKg = 0;
  for (const b of bultos) {
    const n = Math.max(0, Math.round(b.cantidad));
    if (n === 0) continue;
    if (b.kg === null) return { paquetes: [], sinPeso: true, bultoGrande: false };
    // Un solo bulto que ya no entra en paquetería (caja enorme o pallet).
    if (b.kg > PAQUETE_MAX_KG) return { paquetes: [], sinPeso: false, bultoGrande: true };
    if (b.kg > maxChico) {
      for (let i = 0; i < n; i++) paquetes.push(b.kg);
    } else {
      chicoKg += b.kg * n;
    }
  }
  if (chicoKg > 0) {
    const n = Math.max(1, Math.ceil(chicoKg / PAQUETE_MAX_KG));
    for (let i = 0; i < n; i++) paquetes.push(chicoKg / n);
  }
  return { paquetes, sinPeso: false, bultoGrande: false };
}

/**
 * Cuántos paquetes salen del depósito con este pedido. null = no se puede
 * saber (falta un peso, o hay un bulto fuera de paquetería).
 */
export function paquetesDeBultos(
  bultos: Bulto[],
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): number | null {
  const c = consolidar(bultos, cfg);
  if (c.sinPeso || c.bultoGrande) return null;
  return c.paquetes.length || null;
}

/**
 * Envío al interior (Andreani): se cobra POR PAQUETE, así que primero se
 * aplica la regla de consolidación y después se tarifa paquete por paquete.
 * Va "a cotizar" si el CP no es válido (sin banda no hay tarifa que cobrar —
 * ver normalizeCp()), si algún producto no tiene peso cargado, o si un bulto
 * pasa los 50 kg facturables (ahí corresponde pallet, no paquetería).
 */
export function andreaniQuote(
  cp: string | undefined | null,
  bultos: Bulto[],
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): ShippingQuote {
  const band = bandForCp(cp);
  // Sin CP válido no hay banda de tarifa: antes esto caía en silencio a AMBA
  // (la más barata) y cobraba de menos a cualquiera cuyo CP no matcheara el
  // regex viejo (ej. "5.515" con punto). Ahora se corta y se pide el dato.
  if (band === null) return { total: 0, toQuote: true, reason: "cp" };
  const c = consolidar(bultos, cfg);
  if (c.sinPeso) return { total: 0, toQuote: true, reason: "sin-peso" };
  if (c.bultoGrande) return { total: 0, toQuote: true, reason: "bulto-grande" };
  if (c.paquetes.length === 0) return { total: 0, toQuote: false };
  const kgTotal = c.paquetes.reduce((a, b) => a + b, 0);
  // Pedido grande: ya no es paquetería (ver PEDIDO_MAX_KG).
  if (kgTotal > PEDIDO_MAX_KG) return { total: 0, toQuote: true, reason: "pedido-grande" };
  let total = 0;
  for (const kg of c.paquetes) {
    const rate = rateForBulto(band, kg, cfg);
    if (rate === null) return { total: 0, toQuote: true, reason: "bulto-grande" };
    total += rate;
  }
  return { total, toQuote: false };
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
  // El CP pisa a la zona: un CP del interior nunca se cobra como Batu.
  const zone = effectiveBatuZone(cp, batuZone);
  if (zone) {
    // Batu cobra por cantidad de bultos: los que salen DESPUÉS de consolidar.
    // Sin el desglose de pesos caemos al conteo de líneas del carrito.
    const paq = detalle ? paquetesDeBultos(detalle, cfg) : null;
    return { total: batuShipping(zone, paq ?? bultos, cfg), toQuote: false };
  }
  if (cfg.andreaniMode === "cotizar") return { total: 0, toQuote: true };
  return andreaniQuote(cp, detalle ?? [{ kg: null, cantidad: bultos }], cfg);
}
