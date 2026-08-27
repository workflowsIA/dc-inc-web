/**
 * Lógica de precios centralizada — cliente final vs mayorista + ofertas.
 *
 * Dos vistas de precio según el rol (ver src/lib/user.ts):
 *  - MAYORISTA (wholesale/admin): ve el precio NETO + "+ IVA" y envío "a cotizar".
 *    Venta por bulto cerrado. Es el comportamiento histórico.
 *  - CLIENTE FINAL (visitor / pending / no logueado): ve el precio FINAL con IVA
 *    YA INCLUIDO (precio × 1.21) y un costo de envío ESTIMADO (placeholder).
 */

/** Alícuota de IVA Argentina. */
export const IVA_RATE = 0.21;

// El costo de envío estimado ahora vive en src/lib/shipping.ts (tarifas reales
// de Andreani por banda de CP, ≤10 kg). Ver shippingForCp() / SHIPPING_FROM.

/** Precio con IVA incluido (para la vista de cliente final). */
export function withIva(price: number): number {
  return price * (1 + IVA_RATE);
}

/**
 * Tope del cliente final (decisión Fede, 26-ago-2026): $150.000 con IVA
 * incluido. Históricamente era el MÍNIMO de compra mayorista; ahora también es
 * el TECHO de lo que un cliente final (minorista logueado o visitante) puede
 * agregar como presentación cerrada. Por unidad compra siempre; una caja/pack
 * la puede agregar solo si su total con IVA no supera este monto. Por encima,
 * la presentación se muestra con el precio mayorista (neto "+ IVA") pero
 * deshabilitada, con la invitación a pedir el alta mayorista.
 */
export const RETAIL_PRESENTATION_MAX = 150_000;

/** ¿Un cliente final puede comprar esta presentación (bulto cerrado)? */
export function retailCanBuyPresentation(netPerUnit: number, units: number): boolean {
  if (units <= 1) return true;
  return withIva(netPerUnit) * units <= RETAIL_PRESENTATION_MAX;
}

/** Forma mínima de producto que necesita el cálculo de precio de vista. */
export interface PricingInput {
  pub: number;
  may: number;
  oldPub?: number;
  onSale?: boolean;
  salePrice?: number;
  saleStart?: string;
  saleEnd?: string;
}

/** Precio de vista resuelto para un producto, según rol + oferta. */
export interface DisplayPrice {
  /** precio unitario a MOSTRAR (cliente final = IVA incluido; mayorista = neto) */
  display: number;
  /** precio tachado a mostrar (oferta o pricePublicOld), ya en la misma base que `display` */
  strike?: number;
  /** true si hay una oferta vigente aplicada */
  onSale: boolean;
  /** true = cliente final (precio final con IVA incluido); false = mayorista (neto + IVA) */
  finalConsumer: boolean;
}

/**
 * Resuelve el precio de vista de un producto.
 *  - Mayorista: base = priceWholesale, mostrado NETO (el "+ IVA" lo agrega la UI).
 *  - Cliente final: base = pricePublic, mostrado con IVA INCLUIDO.
 *  - Oferta: si está vigente, `salePrice` pisa el precio público activo y el
 *    precio normal pasa a ser el tachado. La oferta sólo aplica a cliente final
 *    (salePrice es un precio público); el mayorista mantiene su precio neto.
 */
export function resolveDisplayPrice(
  p: PricingInput,
  wholesale: boolean,
): DisplayPrice {
  const saleOn = isSaleActive(p.onSale, p.saleStart, p.saleEnd);

  if (wholesale) {
    // Mayorista: neto, sin IVA incluido. La oferta (precio público) no aplica.
    return {
      display: p.may,
      strike: undefined,
      onSale: false,
      finalConsumer: false,
    };
  }

  // Cliente final: precio público con IVA incluido.
  const base = saleOn && typeof p.salePrice === "number" ? p.salePrice : p.pub;
  // Tachado: si hay oferta, tachamos el precio público normal; si no, el oldPub.
  const strikeRaw = saleOn ? p.pub : p.oldPub;
  return {
    display: withIva(base),
    strike: typeof strikeRaw === "number" ? withIva(strikeRaw) : undefined,
    onSale: saleOn,
    finalConsumer: true,
  };
}

/**
 * ¿La oferta del producto está vigente HOY?
 * True si isOnSale y (no hay fechas, o hoy cae dentro del rango).
 */
export function isSaleActive(
  isOnSale?: boolean,
  saleStartDate?: string,
  saleEndDate?: string,
  now: Date = new Date(),
): boolean {
  if (!isOnSale) return false;
  const t = now.getTime();
  if (saleStartDate) {
    const start = new Date(saleStartDate).getTime();
    // Fecha inválida (NaN) → ignoramos el límite en vez de desactivar el gate
    // silenciosamente. Una fecha basura no debe "abrir" ni "cerrar" la oferta sola.
    if (!Number.isNaN(start) && t < start) return false;
  }
  if (saleEndDate) {
    const end = new Date(saleEndDate).getTime();
    if (!Number.isNaN(end) && t > end) return false;
  }
  return true;
}
