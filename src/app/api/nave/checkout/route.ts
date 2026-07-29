/**
 * POST /api/nave/checkout — crea una intención de pago de Nave para un pedido
 * ya persistido en Sanity y devuelve el `checkout_url` para redirigir.
 *
 * Body: { orderId: string }  (el _id que devuelve /api/orders)
 *
 * SEGURIDAD:
 *  - Requiere usuario logueado (cada compra queda atada a alguien).
 *  - El monto NO viene del cliente: se lee el `total` del pedido en Sanity
 *    (recalculado server-side en /api/orders).
 *  - external_payment_id = naveExternalId (lo guardamos en el pedido) para
 *    conciliar el webhook contra el pedido correcto.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { sanityWriteClient } from "@/lib/sanity";
import {
  isNaveConfigured,
  createPaymentIntention,
  naveSiteUrl,
} from "@/lib/nave";
import type { SanityOrder } from "@/lib/queries";
import { guard, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({ orderId: z.string().trim().min(1).max(80) });

export async function POST(req: Request) {
  if (!isNaveConfigured()) {
    return NextResponse.json({ ok: false, error: "nave_disabled" }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  // Por usuario y no por IP: crear intenciones de pago pega contra Nave, y
  // varios clientes pueden compartir IP (oficina, NAT móvil).
  const limited = await guard(req, { ...LIMITS.naveCheckout, identifier: userId });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const order = await sanityWriteClient.getDocument<SanityOrder>(parsed.data.orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
  }
  if (order.paymentStatus === "pagado") {
    return NextResponse.json({ ok: false, error: "already_paid" }, { status: 409 });
  }
  const total = typeof order.total === "number" ? order.total : 0;
  if (!(total > 0)) {
    return NextResponse.json({ ok: false, error: "invalid_total" }, { status: 400 });
  }

  // external_payment_id ≤ 36 chars, derivado del nro de pedido (único).
  const eid = (order.orderNumber || order._id).replace(/[^A-Za-z0-9-]/g, "").slice(0, 36);
  const base = naveSiteUrl();

  try {
    // Guardamos el external id ANTES de crear la intención (para conciliar).
    await sanityWriteClient.patch(order._id).set({ naveExternalId: eid }).commit();

    const intention = await createPaymentIntention({
      externalPaymentId: eid,
      amount: total,
      description: `Pedido ${order.orderNumber ?? ""}`.trim() || "Pedido DC Inc",
      callbackUrl: `${base}/checkout/gracias?order=${encodeURIComponent(order.orderNumber ?? "")}&via=nave`,
      buyerEmail: order.customerEmail || undefined,
    });

    // Guardamos el id de la intención: permite conciliar por polling
    // (/api/nave/status) sin depender del webhook de Nave.
    if (intention.id) {
      await sanityWriteClient
        .patch(order._id)
        .set({ navePaymentRequestId: intention.id })
        .commit();
    }

    return NextResponse.json({ ok: true, checkoutUrl: intention.checkoutUrl });
  } catch (err) {
    console.error("[/api/nave/checkout] error creando intención:", err);
    return NextResponse.json({ ok: false, error: "nave_intention_failed" }, { status: 502 });
  }
}
