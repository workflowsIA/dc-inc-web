import { NextResponse } from "next/server";
import { isWholesale } from "@/lib/user";
import { getProducts } from "@/lib/sanity-data";

/**
 * Precios mayoristas — SOLO para usuarios con rol wholesale/admin.
 *
 * Por qué existe: `toLegacyProduct` omite `priceWholesale` del payload cuando el
 * usuario no es mayorista (`may: wholesale ? p.priceWholesale : 0`). Esa omisión
 * es deliberada: la lista B2B no se publica. Pero obligaba a resolver el rol en
 * el SERVIDOR dentro de cada página, y eso volvía dinámico todo el catálogo.
 *
 * Con este endpoint las páginas se prerenderizan con precio público (cacheables
 * en CDN) y el cliente pide los precios mayoristas una sola vez por sesión, solo
 * si corresponde. Un request por sesión de mayorista en vez de un render
 * dinámico por request para todo el mundo.
 *
 * Nota: /api/orders repreciar server-side y nunca confía en el precio del
 * cliente, así que esto es solo capa de presentación.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface WholesaleEntry {
  /** precio mayorista neto por unidad */
  may: number;
  /** precio mayorista por presentación (caja/pallet), indexado por unitsPerBulk */
  pres?: Record<string, number>;
}

export async function GET() {
  if (!(await isWholesale())) {
    return NextResponse.json(
      {},
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const products = await getProducts();
    const map: Record<string, WholesaleEntry> = {};

    for (const p of products) {
      const slug = p.slug || p._id;
      if (!slug) continue;

      const pres: Record<string, number> = {};
      for (const pp of p.presentationPricing ?? []) {
        if (typeof pp.priceWholesale === "number" && pp.unitsPerBulk) {
          pres[String(pp.unitsPerBulk)] = pp.priceWholesale;
        }
      }

      map[slug] = {
        may: p.priceWholesale,
        ...(Object.keys(pres).length ? { pres } : {}),
      };
    }

    return NextResponse.json(map, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    console.error("[api/precios]", (e as Error).message);
    return NextResponse.json(
      {},
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
