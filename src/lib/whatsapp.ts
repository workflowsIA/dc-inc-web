import type { CartItem } from "./cart-store";
import { ars } from "./format";
import { ENVIO_ESTIMADO_CLIENTE_FINAL } from "./pricing";

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

/** Regla de descuento por volumen — PLACEHOLDER hasta confirmar con Marce.
 *  -5% sobre $300k, -10% sobre $500k, -15% sobre $1M. */
export function volumeRate(subtotal: number): number {
  if (subtotal >= 1_000_000) return 0.15;
  if (subtotal >= 500_000) return 0.1;
  if (subtotal >= 300_000) return 0.05;
  return 0;
}

export function totalsFor(items: CartItem[], wholesale = false): Totals {
  const sub = items.reduce((s, i) => s + unitPrice(i, wholesale) * i.qty, 0);
  const rate = volumeRate(sub);
  const disc = sub * rate;
  const net = sub - disc;
  const iva = net * 0.21;
  // Cliente final (no mayorista): el total incluye el envío estimado (placeholder).
  // Mayorista: el envío va "a cotizar", no se suma al total.
  const finalConsumer = !wholesale;
  const shipping = finalConsumer ? ENVIO_ESTIMADO_CLIENTE_FINAL : 0;
  const total = net + iva + shipping;
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

function orderBody(items: CartItem[], wholesale: boolean): string {
  const t = totalsFor(items, wholesale);
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

export function waOrderURL(items: CartItem[], wholesale = false): string {
  const msg =
    "Hola DC Inc! Quiero cotizar este pedido:\n\n" +
    orderBody(items, wholesale) +
    "\n\n(Enviado desde el carrito web)";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export interface CheckoutInfo {
  nombre?: string;
  empresa?: string;
  email?: string;
  telefono?: string;
  cp?: string;
  notas?: string;
}

export function waCheckoutURL(
  items: CartItem[],
  wholesale: boolean,
  info: CheckoutInfo,
): string {
  let msg = "Hola DC Inc! Quiero confirmar este pedido:\n\n" + orderBody(items, wholesale);
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
