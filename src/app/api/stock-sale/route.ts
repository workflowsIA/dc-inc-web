/**
 * POST /api/stock-sale — resta stock en la planilla por una venta web confirmada.
 * Único flujo web → Sheet de d-005.
 *
 * Body: { items: [{ sku: string, unidades: number }], dryRun?: boolean }
 * Auth: `Authorization: Bearer <SYNC_CRON_SECRET>` (solo header — ver api-auth.ts).
 *
 * NO se llama desde el checkout actual (que es simulado → WhatsApp, sin pago):
 * se dispara cuando se confirma el pago online (pendiente del flujo de pago).
 * Si la celda de stock es una fórmula, no la pisa (la descuenta Marce a mano)
 * y devuelve esos SKUs en `skippedFormula`.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyStockSale, type SaleItem } from "@/lib/sheet-sync";
import { isCronAuthorized } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tope de items por request (defensa contra bodies gigantes). */
const MAX_ITEMS = 1000;
/** Tope de unidades por línea (defensa contra Infinity/valores absurdos). */
const MAX_UNIDADES = 1_000_000;

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  let body: { items?: SaleItem[]; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const items = (body.items ?? [])
    .filter((i): i is SaleItem => {
      if (!i || typeof i.sku !== "string" || i.sku.length === 0 || i.sku.length > 64) return false;
      const u = Number(i.unidades);
      // entero finito positivo, dentro del tope (rechaza Infinity, floats, NaN).
      return Number.isInteger(u) && u > 0 && u <= MAX_UNIDADES;
    })
    .slice(0, MAX_ITEMS);
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
