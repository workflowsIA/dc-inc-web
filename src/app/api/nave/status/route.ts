/**
 * POST /api/nave/status — conciliación por POLLING contra Nave.
 *
 * Body: { orderNumber: string }
 *
 * Consulta el estado de la intención de pago (payment_request) guardada en el
 * pedido y, si Nave la reporta SUCCESS_PROCESSED (pago aprobado), marca el
 * pedido como pagado + descuenta stock — la MISMA finalización que el webhook.
 *
 * Existe para no depender del webhook de Nave (que requiere alta manual del
 * notification_url por parte de su equipo): la página /checkout/gracias hace
 * polling acá hasta confirmar. La doc de Nave lo avala: "alternativa cuando la
 * notificación no se recibe o la recepción presenta fallas".
 *
 * SEGURIDAD: requiere usuario logueado (igual que /api/nave/checkout). No
 * expone datos del pago: responde solo { paid, status }.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { sanityWriteClient } from "@/lib/sanity";
import { isNaveConfigured, getPaymentRequest, naveStatusName } from "@/lib/nave";
import { finalizePaidOrder } from "@/lib/nave-finalize";
import { orderByNaveExternalIdQuery, type SanityOrder } from "@/lib/queries";
import { guard, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ orderNumber: z.string().trim().min(1).max(80) });

export async function POST(req: Request) {
  if (!isNaveConfigured()) {
    return NextResponse.json({ ok: false, error: "nave_disabled" }, { status: 503 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  // Tope alto y por usuario: /checkout/gracias hace polling a propósito. Esto
  // no está para frenar el flujo normal sino un loop desbocado.
  const limited = await guard(req, { ...LIMITS.naveStatus, identifier: userId });
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

  // Mismo saneo que /api/nave/checkout al generar el external id.
  const eid = parsed.data.orderNumber.replace(/[^A-Za-z0-9-]/g, "").slice(0, 36);
  const order = await sanityWriteClient.fetch<SanityOrder | null>(
    orderByNaveExternalIdQuery,
    { eid },
  );
  if (!order) {
    return NextResponse.json({ ok: false, error: "order_not_found" }, { status: 404 });
  }
  if (order.paymentStatus === "pagado") {
    return NextResponse.json({ ok: true, paid: true, idempotent: true });
  }
  if (!order.navePaymentRequestId) {
    return NextResponse.json({ ok: true, paid: false, reason: "no_payment_request" });
  }

  try {
    const pr = await getPaymentRequest(order.navePaymentRequestId);
    const status = naveStatusName(pr.status);

    if (status !== "SUCCESS_PROCESSED") {
      return NextResponse.json({ ok: true, paid: false, status });
    }

    const paymentId =
      pr.payment_attempts?.payments?.find((p) => (p.status ?? "").toUpperCase() === "APPROVED")
        ?.payment_id ?? "";

    // Marca pagado + stock + tarjeta de venta en Monday.
    await finalizePaidOrder(order, String(paymentId), "/api/nave/status");

    return NextResponse.json({ ok: true, paid: true, status });
  } catch (err) {
    console.error("[/api/nave/status] error consultando intención:", err);
    return NextResponse.json({ ok: false, error: "status_check_failed" }, { status: 502 });
  }
}
