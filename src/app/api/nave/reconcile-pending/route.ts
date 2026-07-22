/**
 * GET/POST /api/nave/reconcile-pending — BARREDORA de pagos de Nave.
 *
 * Cierra el caso borde "el cliente pagó pero cerró la pestaña antes de que
 * /checkout/gracias confirmara": consulta en Nave todas las intenciones de
 * pedidos impagos de las últimas 72 h y finaliza los que estén aprobados
 * (pagado + stock + tarjeta de venta en Monday).
 *
 * Auth: header `Authorization: Bearer <SYNC_CRON_SECRET>` (igual que
 * /api/sync-sheet). La dispara un GitHub Action cada 30 min
 * (.github/workflows/reconcile-nave.yml).
 */
import { NextResponse, type NextRequest } from "next/server";
import { sanityWriteClient } from "@/lib/sanity";
import { isNaveConfigured, getPaymentRequest, naveStatusName } from "@/lib/nave";
import { finalizePaidOrder } from "@/lib/nave-finalize";
import { isCronAuthorized } from "@/lib/api-auth";
import { pendingNaveOrdersQuery, type SanityOrder } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isNaveConfigured()) {
    return NextResponse.json({ ok: false, error: "nave_disabled" }, { status: 503 });
  }

  const pending = await sanityWriteClient.fetch<SanityOrder[]>(pendingNaveOrdersQuery);
  const reconciled: string[] = [];
  const stillPending: string[] = [];
  const errors: string[] = [];

  for (const order of pending) {
    try {
      const pr = await getPaymentRequest(order.navePaymentRequestId as string);
      const status = naveStatusName(pr.status);
      if (status === "SUCCESS_PROCESSED") {
        const paymentId =
          pr.payment_attempts?.payments?.find(
            (p) => (p.status ?? "").toUpperCase() === "APPROVED",
          )?.payment_id ?? "";
        await finalizePaidOrder(order, String(paymentId), "/api/nave/reconcile-pending");
        reconciled.push(order.orderNumber ?? order._id);
      } else {
        stillPending.push(`${order.orderNumber ?? order._id}:${status || "?"}`);
      }
    } catch (err) {
      errors.push(order.orderNumber ?? order._id);
      console.error(
        `[/api/nave/reconcile-pending] error con ${order.orderNumber ?? order._id}:`,
        err,
      );
    }
  }

  console.log(
    `[/api/nave/reconcile-pending] revisados=${pending.length} conciliados=${reconciled.length}` +
      (reconciled.length ? ` → ${reconciled.join(", ")}` : ""),
  );
  return NextResponse.json({
    ok: true,
    checked: pending.length,
    reconciled,
    stillPending,
    errors,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
