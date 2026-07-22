/**
 * Finalización compartida de un pago de Nave confirmado.
 *
 * Usada por las TRES vías de confirmación (todas idempotentes vía el check de
 * paymentStatus en el caller):
 *   1. /api/nave/status      — polling desde /checkout/gracias
 *   2. /api/nave/webhook     — notification_url (cuando Nave lo dé de alta)
 *   3. /api/nave/reconcile-pending — barredora (GitHub Action cada 30 min)
 *
 * Hace: marca el pedido pagado → descuenta stock en la planilla (gated) →
 * crea la tarjeta de VENTA WEB en el board CRM de Monday (best-effort).
 */
import { sanityWriteClient } from "@/lib/sanity";
import { stockSaleAfterPayment } from "@/lib/sheet-sync";
import { notifyOrderPaid } from "@/lib/monday";
import type { SanityOrder } from "@/lib/queries";

export async function finalizePaidOrder(
  order: SanityOrder,
  paymentId: string,
  tag: string,
): Promise<void> {
  await sanityWriteClient
    .patch(order._id)
    .set({
      paymentStatus: "pagado",
      paymentProvider: "nave",
      paymentId: String(paymentId ?? ""),
    })
    .commit();

  // Stock en la planilla (gated por STOCK_SALE_ON_PAYMENT, no destructivo).
  await stockSaleAfterPayment(order, tag);

  // Venta en Monday (best-effort: si falla, el pago ya quedó confirmado igual).
  try {
    await notifyOrderPaid({
      orderNumber: order.orderNumber,
      total: order.total,
      customerName: order.customerName,
      customerCompany: order.customerCompany,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      paymentId: String(paymentId ?? ""),
      items: order.items,
    });
  } catch (err) {
    console.warn(`[${tag}] Monday venta falló (pedido ${order.orderNumber ?? "?"}):`, err);
  }
}
