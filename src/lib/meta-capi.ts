/**
 * Meta — API de conversiones (server-side). Manda el evento Purchase desde el
 * servidor cuando se confirma un pago de Nave.
 *
 * Por qué además del pixel del browser: el pixel se pierde con bloqueadores de
 * anuncios, con Safari/iOS y — sobre todo acá — cuando el cliente paga con QR
 * desde el celular y nunca vuelve a /checkout/gracias. El servidor se entera
 * igual (webhook / polling / barredora) y le avisa a Meta.
 *
 * Deduplicación: mismo event_name + event_id que el pixel del browser
 * (`order-<nro de pedido>`), así Meta cuenta UNA compra aunque lleguen las dos.
 *
 * Gated: sin META_CAPI_TOKEN no hace nada (no rompe ni loguea error).
 * El token se genera en Events Manager → pixel → Configuración → API de
 * conversiones → "Generar token de acceso", y se carga en Vercel.
 */
import { createHash } from "crypto";
import { META_PIXEL_ID } from "@/lib/meta-pixel";
import type { SanityOrder } from "@/lib/queries";

const GRAPH_VERSION = "v21.0";

function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** Normalización que pide Meta antes de hashear. */
function hashEmail(email?: string): string | undefined {
  const e = email?.trim().toLowerCase();
  return e ? sha256(e) : undefined;
}

/** Teléfono: solo dígitos, con código de país (54 por defecto). */
function hashPhone(phone?: string): string | undefined {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("54")) d = `54${d}`;
  return sha256(d);
}

function hashName(v?: string): string | undefined {
  const n = v?.trim().toLowerCase();
  return n ? sha256(n) : undefined;
}

/** Arma el payload (exportado para testear sin red). */
export function buildPurchasePayload(order: SanityOrder, now = Date.now()) {
  const items = (order.items ?? []).filter((i) => i.sku || i.baseSku);
  const [first, ...rest] = (order.customerName ?? "").trim().split(/\s+/);
  const userData: Record<string, string[]> = {};
  const em = hashEmail(order.customerEmail);
  const ph = hashPhone(order.customerPhone);
  const fn = hashName(first);
  const ln = hashName(rest.join(" "));
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  userData.country = [sha256("ar")];
  userData.external_id = [sha256(order.customerEmail?.trim().toLowerCase() || order._id)];

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.dcinc.com.ar").replace(/\/$/, "");
  return {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(now / 1000),
        event_id: `order-${order.orderNumber}`,
        action_source: "website",
        event_source_url: `${site}/checkout/gracias`,
        user_data: userData,
        custom_data: {
          currency: "ARS",
          value: Math.round((order.total ?? 0) * 100) / 100,
          order_id: order.orderNumber,
          content_type: "product",
          content_ids: items.map((i) => (i.baseSku || i.sku) as string),
          contents: items.map((i) => ({
            id: (i.baseSku || i.sku) as string,
            quantity: i.unidades ?? i.bultos ?? 1,
            item_price: i.precioUnitario ?? 0,
          })),
          num_items: items.reduce((s, i) => s + (i.unidades ?? i.bultos ?? 1), 0),
        },
      },
    ],
    ...(process.env.META_CAPI_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE }
      : {}),
  };
}

/** Best-effort: nunca tira. Devuelve true si Meta aceptó el evento. */
export async function sendCapiPurchase(order: SanityOrder, tag = "capi"): Promise<boolean> {
  const token = process.env.META_CAPI_TOKEN?.trim();
  if (!token || order.isTest) return false;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPurchasePayload(order)),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[${tag}] Meta CAPI ${res.status} (pedido ${order.orderNumber}): ${body.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[${tag}] Meta CAPI falló (pedido ${order.orderNumber}):`, err);
    return false;
  }
}
