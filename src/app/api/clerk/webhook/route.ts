/**
 * POST /api/clerk/webhook — sincroniza las cuentas de Clerk al Studio.
 *
 * Clerk dispara este webhook ante user.created / user.updated / user.deleted.
 * Verificamos la firma de Svix (headers svix-id / svix-timestamp / svix-signature)
 * con CLERK_WEBHOOK_SECRET y actualizamos el documento `customer` en Sanity.
 *
 * Verificación manual (sin dependencia svix): la firma es
 *   base64( HMAC-SHA256( `${svix_id}.${svix_timestamp}.${body}`, secretBytes ) )
 * donde secretBytes = base64decode(secret tras el prefijo "whsec_").
 *
 * CONFIG (una vez): en el dashboard de Clerk → Webhooks → agregar endpoint
 *   https://<dominio>/api/clerk/webhook  con eventos user.*  → copiar el
 *   "Signing Secret" (whsec_...) a la env var CLERK_WEBHOOK_SECRET.
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  customerFieldsFromWebhook,
  upsertCustomer,
  deleteCustomer,
  getCustomer,
  setCustomerMondayItem,
  type ClerkWebhookUser,
  type CustomerFields,
} from "@/lib/clerk-sync";
import { isMondayConfigured, notifyCustomerSignup, addSignupUpdate } from "@/lib/monday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySvix(secret: string, id: string, ts: string, body: string, header: string): boolean {
  const secretB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretB64, "base64");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secretBytes)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  // header: "v1,<sig> v1,<sig2> ..."
  const sigs = header.split(" ").map((p) => p.split(",")[1]).filter(Boolean);
  const exp = Buffer.from(expected);
  return sigs.some((s) => {
    const b = Buffer.from(s);
    return b.length === exp.length && timingSafeEqual(b, exp);
  });
}

/**
 * Notifica el registro en el board CRM de Monday:
 *  - user.created → item nuevo ("Registro web"; si ya vino con empresa/CUIT,
 *    "Solicita MAYORISTA").
 *  - user.updated → solo cuando aparecen POR PRIMERA VEZ datos de empresa
 *    (empresa o CUIT vacíos → completos): posible mayorista. Si el registro ya
 *    tiene item en Monday, se agrega un update ahí; si no, item nuevo.
 * Nunca lanza: un fallo de Monday no puede romper el sync Clerk→Sanity.
 */
async function notifyMondaySafe(
  type: string,
  fields: CustomerFields,
  prev: (CustomerFields & { _id: string }) | null,
): Promise<void> {
  if (!isMondayConfigured()) return;
  try {
    const hasCompanyData = !!(fields.empresa || fields.cuit);
    if (type === "user.created") {
      const itemId = await notifyCustomerSignup({
        kind: hasCompanyData ? "solicitud_mayorista" : "registro",
        ...fields,
      });
      if (itemId) await setCustomerMondayItem(fields.clerkUserId, itemId);
      return;
    }
    // user.updated: transición sin datos de empresa → con datos de empresa.
    const prevHadCompanyData = !!(prev?.empresa || prev?.cuit);
    if (!hasCompanyData || prevHadCompanyData) return;
    const n = { kind: "solicitud_mayorista" as const, ...fields };
    if (prev?.mondayItemId) {
      await addSignupUpdate(prev.mondayItemId, n);
    } else {
      const itemId = await notifyCustomerSignup(n);
      if (itemId) await setCustomerMondayItem(fields.clerkUserId, itemId);
    }
  } catch (err) {
    console.warn("[/api/clerk/webhook] notificación Monday falló (ignorada):", err);
  }
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "missing_secret" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTs = req.headers.get("svix-timestamp");
  const svixSig = req.headers.get("svix-signature");
  const body = await req.text();

  if (!svixId || !svixTs || !svixSig || !verifySvix(secret, svixId, svixTs, body, svixSig)) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  let event: { type?: string; data?: ClerkWebhookUser & { id?: string } } | null = null;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const type = event?.type ?? "";
  const data = event?.data;
  if (!data?.id) {
    return NextResponse.json({ ok: true, ignored: "no_id" });
  }

  try {
    if (type === "user.deleted") {
      await deleteCustomer(data.id);
    } else if (type === "user.created" || type === "user.updated") {
      const fields = customerFieldsFromWebhook(data);
      const prev = type === "user.updated" || isMondayConfigured() ? await getCustomer(data.id) : null;
      await upsertCustomer({ ...fields, mondayItemId: prev?.mondayItemId });
      // Notificación en Monday (best-effort: nunca rompe la sincronización).
      await notifyMondaySafe(type, fields, prev);
    } else {
      return NextResponse.json({ ok: true, ignored: type });
    }
    return NextResponse.json({ ok: true, type });
  } catch (err) {
    console.error("[/api/clerk/webhook] error sincronizando:", err);
    // 500 → Clerk reintenta.
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 500 });
  }
}
