/**
 * GET/POST /api/orders/expire-pending — BARREDORA de pedidos colgados.
 *
 * Marca como "expirado" los pedidos que quedaron `no_pagado` por más de
 * EXPIRE_PENDING_HOURS (default 24 h): el clásico "inició el pago y nunca lo
 * terminó". Sin esto se acumulan pendientes para siempre y ensucian el panel.
 *
 * SEGURIDAD ANTE VENTAS REALES: antes de expirar, si el pedido tiene una
 * intención de pago de Nave, la re-consulta. Si Nave la reporta aprobada, NO la
 * expira ni la finaliza — la deja como está y la reporta en `needsReview` para
 * revisarla a mano (la finalización real la hace /api/nave/reconcile-pending o
 * el webhook, para no duplicar tarjeta de Monday / descuento de stock).
 *
 * Modo dry-run: `?dry=1` → reporta qué haría, sin mutar nada. Corré esto
 * PRIMERO en prod para ver el resultado antes de dejar el cron suelto.
 *
 * Auth: header `Authorization: Bearer <SYNC_CRON_SECRET>` (igual que
 * /api/nave/reconcile-pending). Cron: .github/workflows/expire-pending.yml.
 */
import { NextResponse, type NextRequest } from "next/server";
import { groq } from "next-sanity";
import { sanityWriteClient } from "@/lib/sanity";
import { isNaveConfigured, getPaymentRequest, naveStatusName } from "@/lib/nave";
import { isCronAuthorized } from "@/lib/api-auth";
import { type SanityOrder } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pedidos no_pagado creados antes de $before (más viejos que el umbral).
const expirablePendingQuery = groq`
  *[_type == "order" && paymentStatus == "no_pagado" && dateTime(createdAt) < dateTime($before)]
    | order(createdAt asc)[0...200]{
    _id, orderNumber, paymentStatus, navePaymentRequestId, createdAt
  }
`;

async function run(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const hours = Number(process.env.EXPIRE_PENDING_HOURS ?? "24") || 24;
  const before = new Date(Date.now() - hours * 3_600_000).toISOString();

  const pending = await sanityWriteClient.fetch<SanityOrder[]>(expirablePendingQuery, { before });
  const naveOn = isNaveConfigured();

  const expired: string[] = [];
  const needsReview: string[] = []; // figuran pagados en Nave pero quedaron no_pagado
  const errors: string[] = [];

  for (const order of pending) {
    const label = order.orderNumber ?? order._id;
    try {
      // Último chequeo contra Nave: nunca expirar un pago que sí entró.
      if (naveOn && order.navePaymentRequestId) {
        const pr = await getPaymentRequest(order.navePaymentRequestId);
        if (naveStatusName(pr.status) === "SUCCESS_PROCESSED") {
          needsReview.push(label);
          continue;
        }
      }
      if (!dry) {
        await sanityWriteClient.patch(order._id).set({ paymentStatus: "expirado" }).commit();
      }
      expired.push(label);
    } catch (err) {
      errors.push(label);
      console.error(`[/api/orders/expire-pending] error con ${label}:`, err);
    }
  }

  console.log(
    `[/api/orders/expire-pending] dry=${dry} umbral=${hours}h revisados=${pending.length}` +
      ` expirados=${expired.length} aRevisar=${needsReview.length} errores=${errors.length}`,
  );
  return NextResponse.json({
    ok: true,
    dryRun: dry,
    hours,
    checked: pending.length,
    expired,
    needsReview,
    errors,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
