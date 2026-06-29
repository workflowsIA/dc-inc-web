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
  type ClerkWebhookUser,
} from "@/lib/clerk-sync";

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
      await upsertCustomer(customerFieldsFromWebhook(data));
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
