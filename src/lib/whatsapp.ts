import type { CartItem } from "./cart-store";
import { ars } from "./format";

/** Numero de WhatsApp Business de DC Inc — del Wix actual. */
export const WA_NUMBER = "5491161072310";

interface Totals {
  sub: number;
  rate: number;
  disc: number;
  net: number;
  iva: number;
  total: number;
  hasDeco: boolean;
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
  const total = net + iva;
  return { sub, rate, disc, net, iva, total, hasDeco: items.some((i) => i.deco) };
}

export function waSimpleURL(message?: string): string {
  const txt = message ?? "Hola DC Inc! Quiero hacer una consulta.";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(txt)}`;
}

export function waOrderURL(items: CartItem[], wholesale = false): string {
  const t = totalsFor(items, wholesale);
  let msg = "Hola DC Inc! Quiero cotizar este pedido:\n\n";
  for (const i of items) {
    const sub = unitPrice(i, wholesale) * i.qty;
    msg += `• ${i.qty}× ${i.name}${i.deco ? " (+ decorado)" : ""} — ${ars(sub)}\n`;
  }
  msg += `\nSubtotal: ${ars(t.sub)}`;
  if (t.rate > 0) msg += `\nDescuento volumen (${t.rate * 100}%): -${ars(t.disc)}`;
  msg += `\nIVA 21%: ${ars(t.iva)}\nTotal estimado: ${ars(t.total)}`;
  if (t.hasDeco) msg += "\n\nIncluye decorado — coordinar arte.";
  msg += "\n\n(Enviado desde el carrito web)";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
