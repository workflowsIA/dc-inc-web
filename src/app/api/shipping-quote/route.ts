import { NextResponse } from "next/server";
import { getShippingConfig } from "@/lib/sanity-data";
import { shippingEstimateLive } from "@/lib/andreani-api";
import type { BatuZone, Bulto } from "@/lib/shipping";

/**
 * Cotización de envío para el carrito y el checkout, con Andreani EN VIVO
 * cuando ANDREANI_API=on (si no, devuelve lo mismo que la tabla).
 *
 * Es solo para MOSTRAR: el monto que se cobra lo vuelve a calcular
 * /api/orders con los datos del pedido, sin confiar en lo que mande el
 * cliente. Por eso acá alcanza con validar forma y rangos.
 *
 * POST { cp, batuZone?, detalle: [{ kg, cantidad }], bultos?, valorProductos }
 *  → ShippingQuote { total, toQuote, reason?, source? }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const cp = typeof body.cp === "string" ? body.cp.slice(0, 20) : "";
  const zoneN = Number(body.batuZone);
  const batuZone = [1, 2, 3, 4].includes(zoneN) ? (zoneN as BatuZone) : null;
  const rawDetalle = Array.isArray(body.detalle) ? body.detalle.slice(0, 100) : [];
  const detalle: Bulto[] = [];
  for (const d of rawDetalle) {
    const o = (d ?? {}) as Record<string, unknown>;
    const kg = o.kg === null ? null : Number(o.kg);
    const cantidad = Number(o.cantidad);
    if (!(cantidad > 0 && cantidad <= 10000)) continue;
    if (kg !== null && !(kg > 0 && kg <= 5000)) {
      detalle.push({ kg: null, cantidad });
      continue;
    }
    detalle.push({ kg, cantidad });
  }
  const valorProductos = Math.min(Math.max(Number(body.valorProductos) || 0, 0), 1e10);
  const bultos = Math.max(1, Math.min(Number(body.bultos) || 1, 10000));

  const cfg = await getShippingConfig();
  const quote = await shippingEstimateLive(
    { cp, batuZone, bultos, wholesale: false, detalle, valorProductos },
    cfg,
  );
  return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
}
