/**
 * POST /api/nave/webhook — notificaciones de Nave (notification_url).
 *
 * Fuente de verdad del cobro. Nave avisa de un cambio de estado y manda
 * { payment_id, payment_check_url, external_payment_id }. Re-consultamos el
 * pago (payment_check_url) y, si está APPROVED, marcamos el pedido pagado.
 *
 * IDEMPOTENTE: si el pedido ya está pagado, no repite.
 * Devuelve 200 rápido siempre (Nave reintenta hasta 5 veces ante no-2xx).
 *
 * DESCUENTO DE STOCK: al confirmar el pago se descuenta el stock en la planilla
 * (applyStockSale), gateado por STOCK_SALE_ON_PAYMENT=1. Es NO destructivo: si
 * la celda objetivo es fórmula (caso actual de "Stock Venta"), se saltea y se
 * loguea — cuando Marce dé el OK a la columna "Ventas web", apuntar
 * STOCK_SALE_COLUMN ahí y el descuento queda operativo sin tocar código.
 */
import { NextResponse } from "next/server";
import { sanityWriteClient } from "@/lib/sanity";
import {
  isNaveConfigured,
  getPaymentByCheckUrl,
  getPaymentById,
  naveStatusName,
  type NavePayment,
} from "@/lib/nave";
import { finalizePaidOrder } from "@/lib/nave-finalize";
import { orderByNaveExternalIdQuery, type SanityOrder } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isNaveConfigured()) {
    return NextResponse.json({ ok: false, error: "nave_disabled" }, { status: 503 });
  }

  let body: {
    payment_id?: string | number;
    payment_check_url?: string;
    external_payment_id?: string;
    status?: string;
  } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "no_json" });
  }
  if (!body) return NextResponse.json({ ok: true, ignored: "empty" });

  try {
    // Estado real: preferimos re-consultar (no confiamos en el body crudo).
    let payment: NavePayment | null = null;
    if (body.payment_check_url) {
      payment = await getPaymentByCheckUrl(body.payment_check_url);
    } else if (body.payment_id != null) {
      payment = await getPaymentById(String(body.payment_id));
    }
    // OJO: la API devuelve status como objeto { name: "APPROVED", ... }.
    const status = naveStatusName(payment?.status ?? body.status);
    const eid = payment?.external_payment_id ?? body.external_payment_id;

    if (status !== "APPROVED" || !eid) {
      return NextResponse.json({ ok: true, status, handled: false });
    }

    const order = await sanityWriteClient.fetch<SanityOrder | null>(
      orderByNaveExternalIdQuery,
      { eid },
    );
    if (!order) {
      return NextResponse.json({ ok: true, status, handled: false, reason: "order_not_found" });
    }
    if (order.paymentStatus === "pagado") {
      return NextResponse.json({ ok: true, status, handled: true, idempotent: true });
    }

    // Marca pagado + stock + tarjeta de venta en Monday.
    await finalizePaidOrder(order, String(payment?.id ?? body.payment_id ?? ""), "/api/nave/webhook");

    return NextResponse.json({ ok: true, status, handled: true });
  } catch (err) {
    console.error("[/api/nave/webhook] error:", err);
    // 200 para no amplificar reintentos por errores transitorios; el próximo
    // evento de Nave reconcilia.
    return NextResponse.json({ ok: false, error: "webhook_error" }, { status: 200 });
  }
}
