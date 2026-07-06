/**
 * POST /api/checkout/simulate-pay — marca un pedido como pagado SIN pasarela real.
 *
 * Sirve SOLO para testear el funnel de compra de punta a punta (carrito →
 * checkout → "pago" simulado → retorno) antes de tener la integración real de
 * Nave. Espeja lo que más adelante hará el webhook de Nave (marcar pagado).
 *
 * GATED: solo responde si NEXT_PUBLIC_CHECKOUT_SIM === "1". En producción (sin
 * el flag) devuelve 403, así no queda un endpoint para marcar pedidos pagados.
 *
 * Body: { orderId: string }  (el _id que devuelve /api/orders)
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { sanityWriteClient } from "@/lib/sanity";
import { stockSaleAfterPayment } from "@/lib/sheet-sync";
import type { SanityOrder } from "@/lib/queries";

export const runtime = "nodejs";

const BodySchema = z.object({ orderId: z.string().trim().min(1).max(80) });

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_CHECKOUT_SIM !== "1") {
    return NextResponse.json({ ok: false, error: "sim_disabled" }, { status: 403 });
  }
  // No se puede pagar sin un usuario logueado (cada compra queda atada a alguien).
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "missing_write_token" }, { status: 500 });
  }

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

  await sanityWriteClient
    .patch(parsed.data.orderId)
    .set({ paymentStatus: "pagado", notes: appendSimNote(order.notes) })
    .commit();

  // Igual que hará el webhook de Nave: descuento de stock en la planilla
  // (gated por STOCK_SALE_ON_PAYMENT=1; no destructivo — ver sheet-sync.ts).
  await stockSaleAfterPayment(order, "/api/checkout/simulate-pay");

  return NextResponse.json({ ok: true, orderNumber: order.orderNumber, total: order.total });
}

/** Deja marcado en las notas que el pago fue simulado (para no confundirlo con uno real). */
function appendSimNote(notes?: string): string {
  const tag = "[PAGO SIMULADO — test]";
  if (!notes) return tag;
  return notes.includes(tag) ? notes : `${notes}\n${tag}`;
}
