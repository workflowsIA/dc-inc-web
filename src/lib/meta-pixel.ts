/**
 * Meta Pixel (Facebook) — helpers del lado del browser.
 *
 * El pixel es el MISMO que usaba Wix: "Dc Inc Publi's Pixel" (3941791086120962),
 * el que tienen conectado las campañas y el catálogo de ads. Mantener el mismo
 * ID conserva el historial, los públicos y la optimización de las campañas.
 * Con el cutover a Vercel (5-sep-2026) el sitio dejó de dispararlo; esto lo
 * repone. Se puede pisar con NEXT_PUBLIC_META_PIXEL_ID; vacío = default.
 *
 * `content_ids` = SKU del producto, que es el `id` del catálogo de Meta
 * (ver scripts/export-meta-catalog.ts) → así los anuncios dinámicos matchean.
 */

export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "3941791086120962";

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === "function" ? f : null;
}

export interface PixelItem {
  sku: string;
  qty: number;
  /** precio unitario (ARS) */
  price: number;
}

/** Dispara un evento estándar. Nunca tira: si el pixel no cargó (bloqueador
 *  de anuncios, etc.) simplemente no hace nada. `eventID` sirve para
 *  deduplicar si más adelante se suma la API de conversiones (server-side). */
export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  eventID?: string,
): void {
  try {
    const f = fbq();
    if (!f) return;
    if (eventID) f("track", event, params ?? {}, { eventID });
    else f("track", event, params ?? {});
  } catch {
    /* el tracking nunca rompe la tienda */
  }
}

/** Parámetros de ecommerce a partir de líneas de carrito. */
export function commerceParams(items: PixelItem[]): Record<string, unknown> {
  const valid = items.filter((i) => i.sku);
  const value = valid.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0);
  return {
    content_type: "product",
    content_ids: valid.map((i) => i.sku),
    contents: valid.map((i) => ({ id: i.sku, quantity: i.qty, item_price: i.price })),
    num_items: valid.reduce((s, i) => s + (i.qty || 0), 0),
    value: Math.round(value * 100) / 100,
    currency: "ARS",
  };
}
