import type { CartItem } from "./cart-store";
import { ars } from "./format";
import {
  shippingEstimate,
  DEFAULT_SHIPPING_CONFIG,
  type BatuZone,
  type ShippingConfig,
} from "./shipping";

/** Numero de WhatsApp Business de DC Inc — del Wix actual. */
export const WA_NUMBER = "5491161072310";

interface Totals {
  sub: number;
  rate: number;
  disc: number;
  net: number;
  iva: number;
  /** envío estimado (sólo cliente final; 0 para mayorista que cotiza envío) */
  shipping: number;
  total: number;
  hasDeco: boolean;
  /** true = cliente final (precio final con IVA incluido + envío estimado) */
  finalConsumer: boolean;
}

/** Precio unitario según el rol del usuario. */
export function unitPrice(item: CartItem, wholesale: boolean): number {
  return wholesale ? item.may : item.pub;
}

/** Descuento por volumen — DESACTIVADO (13-jul). El descuento por volumen real
 *  ahora vive en el precio por presentación (caja/pallet) de la planilla, que se
 *  reprecia server-side. Dejar este placeholder activo stackearía → doble
 *  descuento. Tiers previos (por si se reactiva): -5% $300k, -10% $500k, -15% $1M. */
export function volumeRate(_subtotal: number): number {
  return 0;
}

/** Cantidad de bultos del carrito (para el envío Batu por bultos). Cada línea
 *  de caja cuenta sus cajas (qty / unidades por bulto); combos e individuales
 *  cuentan como 1 bulto por línea. Mínimo 1. */
export function totalBultos(items: CartItem[]): number {
  const n = items.reduce((acc, i) => {
    if (i.kind === "combo") return acc + i.qty;
    const step = i.bulto > 0 ? i.bulto : 1;
    return acc + (step > 1 ? Math.max(1, Math.round(i.qty / step)) : 1);
  }, 0);
  return Math.max(1, n);
}

export function totalsFor(
  items: CartItem[],
  wholesale = false,
  cp?: string,
  batuZone?: BatuZone | null,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): Totals {
  const sub = items.reduce((s, i) => s + unitPrice(i, wholesale) * i.qty, 0);
  const rate = volumeRate(sub);
  const disc = sub * rate;
  const net = sub - disc;
  // Cliente final: envío estimado. Batu (zona × bultos) si eligió zona CABA/GBA;
  // si no, banda de CP (interior). Mayorista: "a cotizar", no se suma.
  const finalConsumer = !wholesale;
  const shipping = shippingEstimate({ cp, batuZone, bultos: totalBultos(items), wholesale }, cfg);
  // IVA 21% sobre productos + envío (el flete también tributa IVA).
  const iva = (net + shipping) * 0.21;
  const total = net + shipping + iva;
  return {
    sub,
    rate,
    disc,
    net,
    iva,
    shipping,
    total,
    hasDeco: items.some((i) => i.deco),
    finalConsumer,
  };
}

export function waSimpleURL(message?: string): string {
  const txt = message ?? "Hola DC Inc! Quiero hacer una consulta.";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(txt)}`;
}

function orderBody(
  items: CartItem[],
  wholesale: boolean,
  cp?: string,
  batuZone?: BatuZone | null,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): string {
  const t = totalsFor(items, wholesale, cp, batuZone, cfg);
  let msg = "";
  for (const i of items) {
    const sub = unitPrice(i, wholesale) * i.qty;
    // Venta por bulto cerrado: expresamos bultos (y unidades totales) en vez
    // de unidades sueltas, coherente con lo que muestra el carrito.
    const step = i.bulto > 0 ? i.bulto : 1;
    const bultos = Math.max(1, Math.round(i.qty / step));
    const qtyLabel =
      i.kind === "combo"
        ? `${i.qty} ${i.qty === 1 ? "combo" : "combos"}`
        : step > 1
          ? `${bultos} ${bultos === 1 ? "bulto" : "bultos"} (${i.qty} u)`
          : `${i.qty} u`;
    msg += `• ${qtyLabel} — ${i.name}${i.deco ? " (+ decorado)" : ""} — ${ars(sub)}\n`;
  }
  msg += `\nSubtotal: ${ars(t.sub)}`;
  if (t.rate > 0) msg += `\nDescuento volumen (${t.rate * 100}%): -${ars(t.disc)}`;
  msg += `\nIVA 21%: ${ars(t.iva)}`;
  if (t.finalConsumer) {
    msg += `\nEnvío estimado: ${ars(t.shipping)} (se confirma al cerrar)`;
  } else {
    msg += `\nEnvío: a cotizar`;
  }
  msg += `\nTotal estimado: ${ars(t.total)}`;
  if (t.hasDeco) msg += "\n\nIncluye decorado — coordinar arte.";
  return msg;
}

export function waOrderURL(
  items: CartItem[],
  wholesale = false,
  cp?: string,
  batuZone?: BatuZone | null,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): string {
  const msg =
    "Hola DC Inc! Quiero cotizar este pedido:\n\n" +
    orderBody(items, wholesale, cp, batuZone, cfg) +
    "\n\n(Enviado desde el carrito web)";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export interface CheckoutInfo {
  nombre?: string;
  empresa?: string;
  email?: string;
  telefono?: string;
  cp?: string;
  batuZone?: BatuZone | null;
  notas?: string;
}

export function waCheckoutURL(
  items: CartItem[],
  wholesale: boolean,
  info: CheckoutInfo,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): string {
  let msg = "Hola DC Inc! Quiero confirmar este pedido:\n\n" + orderBody(items, wholesale, info.cp, info.batuZone, cfg);
  const datos: string[] = [];
  if (info.nombre) datos.push(`Nombre: ${info.nombre}`);
  if (info.empresa) datos.push(`Empresa: ${info.empresa}`);
  if (info.email) datos.push(`Email: ${info.email}`);
  if (info.telefono) datos.push(`Tel: ${info.telefono}`);
  if (info.cp) datos.push(`CP envío: ${info.cp}`);
  if (datos.length) msg += "\n\nMis datos:\n" + datos.join("\n");
  if (info.notas) msg += `\n\nNotas: ${info.notas}`;
  msg += "\n\n(Enviado desde el checkout web)";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
