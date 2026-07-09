/**
 * Parseo y formateo de mensajes de PEDIDO de catálogo de WhatsApp (type "order").
 *
 * Meta manda estos mensajes cuando el cliente arma un pedido desde el catálogo.
 * Chatwoot no los soporta (llegan vacíos), así que el proxy /api/wa/webhook los
 * detecta acá, los formatea como texto legible y los reinyecta con chatwoot.ts.
 *
 * Dato clave: `product_retailer_id` == el SKU del producto en Sanity
 * (ver scripts/export-meta-catalog.ts, donde `id` del feed = product.sku).
 */
import { sanityClient } from "@/lib/sanity";
import { ars } from "@/lib/format";

// ---- Tipos del payload de Meta (sólo lo que usamos) ----

export interface WaOrderItem {
  product_retailer_id: string;
  quantity: string | number;
  item_price: string | number;
  currency?: string;
}

export interface WaOrder {
  catalog_id?: string;
  text?: string;
  product_items: WaOrderItem[];
}

export interface WaMessage {
  from?: string;
  id?: string;
  type?: string;
  order?: WaOrder;
  [k: string]: unknown;
}

interface WaValue {
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: WaMessage[];
  statuses?: unknown[];
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  [k: string]: unknown;
}

interface WaChange {
  value?: WaValue;
  field?: string;
  [k: string]: unknown;
}

interface WaEntry {
  id?: string;
  changes?: WaChange[];
  [k: string]: unknown;
}

export interface WaWebhookPayload {
  object?: string;
  entry?: WaEntry[];
  [k: string]: unknown;
}

/** Un pedido extraído, con el contexto para inyectarlo en Chatwoot. */
export interface ExtractedOrder {
  waId: string;
  name: string;
  order: WaOrder;
}

/** Extrae todos los mensajes tipo `order` del payload, con su contacto. */
export function extractOrders(payload: WaWebhookPayload): ExtractedOrder[] {
  const out: ExtractedOrder[] = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;
      const contact = value.contacts?.[0];
      for (const msg of value.messages || []) {
        if (msg.type === "order" && msg.order) {
          out.push({
            waId: msg.from || contact?.wa_id || "",
            name: contact?.profile?.name || "",
            order: msg.order,
          });
        }
      }
    }
  }
  return out;
}

/** ¿El payload contiene al menos un mensaje `order`? */
export function hasOrders(payload: WaWebhookPayload): boolean {
  return (payload.entry || []).some((e) =>
    (e.changes || []).some((c) =>
      (c.value?.messages || []).some((m) => m.type === "order"),
    ),
  );
}

/**
 * Devuelve una copia del payload SIN los mensajes `order`, para reenviar a
 * Chatwoot sin que aparezca la burbuja vacía. Changes/entries que quedan sin
 * mensajes NI statuses se descartan. Puede devolver null si no queda nada útil.
 */
export function stripOrders(payload: WaWebhookPayload): WaWebhookPayload | null {
  const entries: WaEntry[] = [];
  for (const entry of payload.entry || []) {
    const changes: WaChange[] = [];
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) {
        changes.push(change);
        continue;
      }
      const messages = (value.messages || []).filter((m) => m.type !== "order");
      const keepsStatuses = Array.isArray(value.statuses) && value.statuses.length > 0;
      if (messages.length === 0 && !keepsStatuses) continue; // change sin nada relevante
      changes.push({ ...change, value: { ...value, messages } });
    }
    if (changes.length) entries.push({ ...entry, changes });
  }
  if (!entries.length) return null;
  return { ...payload, entry: entries };
}

/** Mapa SKU → { name, pricePublic } desde Sanity (para nombrar los productos). */
async function lookupSkus(
  skus: string[],
): Promise<Record<string, { name: string; pricePublic?: number }>> {
  const unique = [...new Set(skus.filter(Boolean))];
  if (!unique.length) return {};
  try {
    const rows: { sku: string; name: string; pricePublic?: number }[] =
      await sanityClient.fetch(
        `*[_type == "product" && sku in $skus]{ sku, name, pricePublic }`,
        { skus: unique },
      );
    const map: Record<string, { name: string; pricePublic?: number }> = {};
    for (const r of rows) map[r.sku] = { name: r.name, pricePublic: r.pricePublic };
    return map;
  } catch (e) {
    console.error("[wa-order] lookupSkus falló:", e);
    return {};
  }
}

/**
 * Formatea un pedido como texto plano para el chat. Resuelve nombres por SKU
 * contra Sanity; si no encuentra el SKU, muestra el retailer_id crudo.
 */
export async function formatOrder(order: WaOrder): Promise<string> {
  const items = order.product_items || [];
  const skuMap = await lookupSkus(items.map((i) => i.product_retailer_id));

  const lines: string[] = ["🛒 *Pedido desde el catálogo de WhatsApp*", ""];
  let total = 0;
  let units = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.item_price) || 0;
    const lineTotal = qty * price;
    total += lineTotal;
    units += qty;

    const prod = skuMap[it.product_retailer_id];
    const name = prod?.name || it.product_retailer_id || "Producto";
    lines.push(`• ${qty} × ${name} — ${ars(price)} c/u = ${ars(lineTotal)}`);
    if (prod?.name) lines.push(`   SKU: ${it.product_retailer_id}`);
  }

  lines.push("");
  lines.push(`*Total del pedido: ${ars(total)}*  (${items.length} ítems, ${units} u.)`);

  const note = (order.text || "").trim();
  if (note) {
    lines.push("");
    lines.push(`📝 Nota del cliente: "${note}"`);
  }

  lines.push("");
  lines.push("_Pedido de catálogo capturado automáticamente (WhatsApp no lo muestra nativo en Chatwoot)._");

  return lines.join("\n");
}
