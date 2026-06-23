/**
 * POST /api/stock-sale — resta stock en la planilla por una venta web confirmada.
 * Único flujo web → Sheet de d-005.
 *
 * Body: { items: [{ sku: string, unidades: number }], dryRun?: boolean }
 * Auth: `Authorization: Bearer <SYNC_CRON_SECRET>` (o `?secret=`).
 *
 * NO se llama desde el checkout actual (que es simulado → WhatsApp, sin pago):
 * se dispara cuando se confirma el pago online (pendiente del flujo de pago).
 * Si la celda de stock es una fórmula, no la pisa (la descuenta Marce a mano)
 * y devuelve esos SKUs en `skippedFormula`.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyStockSale, type SaleItem } from "@/lib/sheet-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.SYNC_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("secret") === secret) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  let body: { items?: SaleItem[]; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const items = (body.items ?? []).filter(
    (i) => i && typeof i.sku === "string" && Number(i.unidades) > 0,
  );
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "Sin items válidos" }, { status: 400 });
  }
  try {
    const result = await applyStockSale(items, { dryRun: !!body.dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
