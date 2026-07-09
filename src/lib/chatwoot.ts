/**
 * Cliente mínimo de la Application API de Chatwoot.
 *
 * Se usa para INYECTAR mensajes entrantes en una conversación — puntualmente,
 * los pedidos de catálogo de WhatsApp (mensajes tipo `order`) que Chatwoot NO
 * soporta de forma nativa y descarta (llegan vacíos). El proxy de
 * `/api/wa/webhook` los detecta, los formatea como texto y los reinyecta acá.
 *
 * Config por env (si falta algo, isChatwootConfigured() = false y el proxy
 * sigue funcionando como passthrough puro, sin romper el inbound normal):
 *   CHATWOOT_BASE_URL     → https://chatwoot-production-xxxx.up.railway.app
 *   CHATWOOT_ACCOUNT_ID   → id numérico de la cuenta (URL del panel)
 *   CHATWOOT_API_TOKEN    → Profile Settings → Access Token (agente/admin)
 *   CHATWOOT_INBOX_ID     → id del inbox de WhatsApp
 */

const BASE = (process.env.CHATWOOT_BASE_URL || "").replace(/\/+$/, "");
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID || "";
const API_TOKEN = process.env.CHATWOOT_API_TOKEN || "";
const INBOX_ID = process.env.CHATWOOT_INBOX_ID || "";

export function isChatwootConfigured(): boolean {
  return Boolean(BASE && ACCOUNT_ID && API_TOKEN && INBOX_ID);
}

function api(path: string): string {
  return `${BASE}/api/v1/accounts/${ACCOUNT_ID}${path}`;
}

async function cwFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(api(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      api_access_token: API_TOKEN,
      ...(init?.headers || {}),
    },
    // Chatwoot puede tardar; no queremos colgar el webhook de Meta.
    signal: AbortSignal.timeout(12_000),
  });
}

/** Normaliza a E.164 con "+" (Chatwoot guarda el teléfono así). */
export function toE164(waId: string): string {
  const digits = waId.replace(/[^\d]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

interface ContactRef {
  contactId: number;
  sourceId: string;
}

interface CwContact {
  id: number;
  phone_number?: string | null;
  contact_inboxes?: { source_id: string; inbox?: { id: number } }[];
}

/** Busca un contacto por teléfono. Devuelve el que matchea el E.164 exacto. */
async function searchContact(e164: string): Promise<CwContact | null> {
  const res = await cwFetch(`/contacts/search?q=${encodeURIComponent(e164)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const list: CwContact[] = data?.payload || [];
  return (
    list.find((c) => (c.phone_number || "").replace(/[^\d+]/g, "") === e164) ||
    list[0] ||
    null
  );
}

/** source_id del contact_inbox correspondiente a nuestro inbox de WhatsApp. */
function sourceIdFor(contact: CwContact): string | null {
  const ci = (contact.contact_inboxes || []).find(
    (x) => String(x.inbox?.id ?? "") === String(INBOX_ID),
  );
  return ci?.source_id ?? contact.contact_inboxes?.[0]?.source_id ?? null;
}

async function createContact(name: string, e164: string): Promise<ContactRef | null> {
  const res = await cwFetch(`/contacts`, {
    method: "POST",
    body: JSON.stringify({
      inbox_id: Number(INBOX_ID),
      name: name || e164,
      phone_number: e164,
    }),
  });
  if (!res.ok) {
    // Puede fallar por duplicado (carrera con el propio Chatwoot) → re-buscar.
    const existing = await searchContact(e164);
    if (existing) {
      const sid = sourceIdFor(existing);
      if (sid) return { contactId: existing.id, sourceId: sid };
    }
    return null;
  }
  const data = await res.json().catch(() => null);
  const contact = data?.payload?.contact;
  const sourceId = data?.payload?.contact_inbox?.source_id;
  if (!contact?.id || !sourceId) return null;
  return { contactId: contact.id, sourceId };
}

/**
 * source_id del contact_inbox — vía el endpoint show (`/contacts/{id}`), que SÍ
 * incluye `contact_inboxes` (la búsqueda `/contacts/search` NO los devuelve).
 */
async function fetchSourceId(contactId: number): Promise<string | null> {
  const res = await cwFetch(`/contacts/${contactId}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const contact: CwContact | undefined = data?.payload;
  return contact ? sourceIdFor(contact) : null;
}

/** Conversación abierta más reciente del contacto en nuestro inbox, si hay. */
async function findOpenConversation(contactId: number): Promise<number | null> {
  const res = await cwFetch(`/contacts/${contactId}/conversations`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const convs: { id: number; inbox_id?: number; status?: string }[] =
    data?.payload || data || [];
  const mine = convs.filter((c) => String(c.inbox_id ?? "") === String(INBOX_ID));
  // Preferimos una abierta; si no, la última creada (mayor id).
  const open = mine.find((c) => c.status === "open");
  if (open) return open.id;
  const sorted = mine.sort((a, b) => b.id - a.id);
  return sorted[0]?.id ?? null;
}

async function createConversation(sourceId: string, contactId: number): Promise<number | null> {
  const res = await cwFetch(`/conversations`, {
    method: "POST",
    body: JSON.stringify({
      source_id: sourceId,
      inbox_id: Number(INBOX_ID),
      contact_id: contactId,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id ?? null;
}

async function postIncoming(conversationId: number, content: string): Promise<boolean> {
  const res = await cwFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, message_type: "incoming" }),
  });
  return res.ok;
}

/**
 * Inyecta un mensaje ENTRANTE de texto en la conversación del contacto
 * (creando contacto/conversación si hace falta). Devuelve true si se posteó.
 */
export async function injectIncomingText(args: {
  waId: string;
  name: string;
  content: string;
}): Promise<boolean> {
  if (!isChatwootConfigured()) return false;
  const e164 = toE164(args.waId);

  // 1) Contacto (id). Puede existir o no.
  const existing = await searchContact(e164);
  let contactId = existing?.id ?? null;

  // 2) Camino feliz: el contacto ya tiene una conversación → posteamos ahí.
  //    No hace falta source_id para postear en una conversación existente.
  if (contactId) {
    const conv = await findOpenConversation(contactId);
    if (conv) return postIncoming(conv, args.content);
  }

  // 3) No hay conversación (o no hay contacto): resolvemos source_id y creamos.
  let sourceId: string | null = existing ? sourceIdFor(existing) : null;
  if (!contactId) {
    const created = await createContact(args.name, e164);
    if (!created) throw new Error(`chatwoot: no pude crear contacto ${e164}`);
    contactId = created.contactId;
    sourceId = created.sourceId;
  }
  if (!sourceId) sourceId = await fetchSourceId(contactId);
  if (!sourceId) throw new Error(`chatwoot: sin source_id para ${e164}`);

  const convId = await createConversation(sourceId, contactId);
  if (!convId) throw new Error(`chatwoot: no pude crear conversación ${e164}`);

  return postIncoming(convId, args.content);
}
