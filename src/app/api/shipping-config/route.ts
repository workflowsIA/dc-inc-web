import { NextResponse } from "next/server";
import { getShippingConfig } from "@/lib/sanity-data";
import { andreaniApiEnabled } from "@/lib/andreani-api";

/**
 * Config de envíos resuelta (Sanity + fallback a los defaults) para el cliente.
 * El carrito y el checkout la piden una vez y calculan el envío con estos
 * valores, así lo que ve el usuario coincide con lo que cobra el server.
 */
export async function GET() {
  const cfg = await getShippingConfig();
  // andreaniLive: le avisa al carrito/checkout que pidan la cotización real a
  // /api/shipping-quote (Andreani en vivo). Sale del env, no de Sanity.
  return NextResponse.json({ ...cfg, andreaniLive: andreaniApiEnabled() }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
