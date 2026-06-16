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

/**
 * Costo de envío estimado para el cliente final (placeholder simulado).
 * No tenemos las tarifas reales de envío todavía, así que mostramos un
 * estimativo fijo y bien visible que se confirma al cerrar el pedido.
 * Valor en pesos (ARS).
 *
 * // TODO: pedir a Marce las tarifas reales de envío (por CP / volumen / transporte).
 */
export const ENVIO_ESTIMADO_CLIENTE_FINAL = 12000;

/** Precio con IVA incluido (para la vista de cliente final). */
export function withIva(price: number): number {
  return price * (1 + IVA_RATE);
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
  if (saleStartDate && t < new Date(saleStartDate).getTime()) return false;
  if (saleEndDate && t > new Date(saleEndDate).getTime()) return false;
  return true;
}
