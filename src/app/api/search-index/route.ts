import { NextResponse } from "next/server";
import { getProducts } from "@/lib/sanity-data";

/**
 * Índice liviano para el autocomplete del buscador.
 *
 * Antes esto viajaba como prop del Header, así que los ~305 productos se
 * serializaban en el payload RSC de CADA página del sitio (y de cada prefetch),
 * inflando el Fast Origin Transfer. Ahora el buscador lo pide una sola vez,
 * recién cuando el usuario lo toca, y la respuesta se cachea en el CDN.
 */
export const revalidate = 300;

export async function GET() {
  try {
    const items = (await getProducts()).map((p) => ({
      name: p.name,
      slug: p.slug || p._id,
      cat: p.category ?? "",
    }));
    return NextResponse.json(items, {
      headers: {
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    // Sin índice el buscador degrada bien: el form hace submit a /productos?q=
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }
}
