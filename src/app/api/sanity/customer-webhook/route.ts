/**
 * POST /api/sanity/customer-webhook — propaga el `estado` editado en el Studio
 * al role del usuario en Clerk (así aprobar/rechazar un mayorista desde el
 * Studio cambia los precios que ve en la web, sin abrir Clerk).
 *
 * GUARDA ANTI-LOOP: si el role en Clerk ya coincide con el estado, no escribe
 * (evita el ping-pong con el webhook de Clerk → Sanity).
 *
 * CONFIG (una vez): en Sanity → API → Webhooks, crear un webhook:
 *   - URL: https://<dominio>/api/sanity/customer-webhook
 *   - Trigger: on create/update, filtro `_type == "customer"`
 *   - Projection: `{ "clerkUserId": clerkUserId, "estado": estado }`
 *   - Secret: el mismo valor que SANITY_WEBHOOK_SECRET
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { estadoToRole } from "@/lib/clerk-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verifica la firma de un webhook de Sanity (header sanity-webhook-signature). */
function verifySanity(secret: string, header: string, body: string): boolean {
  // header: "t=<unix>,v1=<base64url>"
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=").map((s) => s.trim())),
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.${body}`)
    .digest("base64url");
  const a = Buffer.from(parts.v1);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "missing_secret" }, { status: 500 });
  }
  const sig = req.headers.get("sanity-webhook-signature");
  const body = await req.text();
  if (!sig || !verifySanity(secret, sig, body)) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  let data: { clerkUserId?: string; estado?: string } | null = null;
  try {
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!data?.clerkUserId) {
    return NextResponse.json({ ok: true, ignored: "no_clerk_id" });
  }

  const targetRole = estadoToRole(data.estado);
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(data.clerkUserId);
    const currentRole = (user.publicMetadata as { role?: string } | undefined)?.role;
    if (currentRole === targetRole) {
      return NextResponse.json({ ok: true, skipped: "role_unchanged" });
    }
    await clerk.users.updateUserMetadata(data.clerkUserId, {
      publicMetadata: { ...(user.publicMetadata ?? {}), role: targetRole },
    });
    return NextResponse.json({ ok: true, role: targetRole });
  } catch (err) {
    console.error("[/api/sanity/customer-webhook] error actualizando Clerk:", err);
    return NextResponse.json({ ok: false, error: "clerk_update_failed" }, { status: 500 });
  }
}
