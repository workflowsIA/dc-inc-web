import { NextResponse } from "next/server";
import { getShippingConfig } from "@/lib/sanity-data";

/**
 * Config de envíos resuelta (Sanity + fallback a los defaults) para el cliente.
 * El carrito y el checkout la piden una vez y calculan el envío con estos
 * valores, así lo que ve el usuario coincide con lo que cobra el server.
 */
export async function GET() {
  const cfg = await getShippingConfig();
  return NextResponse.json(cfg, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
