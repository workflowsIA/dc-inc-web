/**
 * Helpers tipados para leer datos del catálogo desde Sanity.
 * Las páginas (server components) llaman a estas funciones; nadie usa
 * sanityClient directamente.
 */
import { sanityClient } from "./sanity";
import {
  DEFAULT_SHIPPING_CONFIG,
  type ShippingConfig,
  type ShippingBand,
  type BatuZone,
} from "./shipping";
import {
  productsQuery,
  productBySlugQuery,
  productSlugsQuery,
  productCountQuery,
  featuredProductsQuery,
  categoriesQuery,
  combosQuery,
  comboBySlugQuery,
  comboSlugsQuery,
  brandsQuery,
  clientsQuery,
  testimonialsQuery,
  shippingConfigQuery,
  decoPricingQuery,
  blogPostsQuery,
  blogPostBySlugQuery,
  blogPostSlugsQuery,
  heroQuery,
  type SanityProduct,
  type SanityCategory,
  type SanityCombo,
  type SanityBrand,
  type SanityClient,
  type SanityTestimonial,
  type SanityShippingConfigDoc,
  type SanityBlogPost,
  type SanityHero,
} from "./queries";
import type { Product, Badge, StockLevel } from "@/data/products";
import type { DecoOption, DecoPricing } from "./deco";

/** Convierte un producto Sanity al shape legacy que consumen las páginas
 *  (mismo Product que el mock). El packshot viene como `imageUrl` (URL absoluta
 *  del CDN de Sanity) en vez de `img` (key local).
 *
 *  SEGURIDAD (auditoría jun-2026, P1-1): el precio mayorista (`may`) SOLO se
 *  incluye cuando `wholesale === true`. Para cualquier otro visitante se manda
 *  0, así el precio neto/margen NUNCA viaja al browser ni al snapshot del carrito.
 *  Las páginas de catálogo ya son dinámicas (leen `isWholesale()`), así que el
 *  valor se resuelve por request según el rol real de la sesión. */
export function toLegacyProduct(p: SanityProduct, wholesale = false): Product {
  return {
    id: p.slug || p._id,
    sku: p.sku,
    cat: p.category ?? "Otros",
    sub: p.subtypes?.[0] ?? "",
    subs: p.subtypes ?? [],
    name: p.name,
    sortOrder: p.sortOrder,
    pub: p.pricePublic,
    may: wholesale ? p.priceWholesale : 0,
    oldPub: p.pricePublicOld,
    onSale: p.isOnSale,
    salePrice: p.salePrice,
    saleStart: p.saleStartDate,
    saleEnd: p.saleEndDate,
    bulto: p.unitsPerBulk || 1,
    pallet: p.unitsPerPallet ?? 0,
    deli: p.deliveryTime || "24-48 hs",
    stock: (p.stockLevel as StockLevel) ?? "ok",
    badges: (p.badges as Badge[]) ?? [],
    deco: p.decoAvailable ?? true,
    decoFamily: p.decoFamily,
    specs: (p.specs ?? []).reduce<Record<string, string>>(
      (acc, s) => ({ ...acc, [s.key]: s.value }),
      {},
    ),
    description: p.description,
    presentations: p.presentations,
    // Precio por presentación (descuento por volumen). SEGURIDAD: igual que `may`,
    // el precio mayorista por presentación SOLO viaja al browser si wholesale.
    presentationPricing: (p.presentationPricing ?? []).map((pp) => ({
      ...pp,
      priceWholesale: wholesale ? pp.priceWholesale : undefined,
    })),
    imageUrl: p.image,
  };
}

/**
 * Orden del catálogo (pedido de Marce, ago-2026): primero los productos con
 * "Orden en el catálogo" cargado (menor número primero), después el resto
 * agrupado por el orden de su categoría (Botellas, Latas, Copas y vasos…) y,
 * dentro de cada rubro, por nombre. Sanity ya devuelve por nombre; acá se
 * reordena en memoria para que TODAS las páginas (catálogo, categoría, home,
 * índice del buscador) usen el mismo criterio.
 */
export function sortCatalog<T extends Pick<SanityProduct, "name" | "sortOrder" | "categoryOrder">>(
  products: T[],
): T[] {
  const BIG = Number.MAX_SAFE_INTEGER;
  const so = (p: T) => (typeof p.sortOrder === "number" ? p.sortOrder : BIG);
  const co = (p: T) => (typeof p.categoryOrder === "number" ? p.categoryOrder : 999);
  return [...products].sort(
    (a, b) => so(a) - so(b) || co(a) - co(b) || a.name.localeCompare(b.name, "es"),
  );
}

export async function getProducts(): Promise<SanityProduct[]> {
  const products: SanityProduct[] = await sanityClient.fetch(
    productsQuery,
    {},
    { next: { revalidate: 60 } },
  );
  return sortCatalog(products);
}

export async function getProductBySlug(slug: string): Promise<SanityProduct | null> {
  return await sanityClient.fetch(productBySlugQuery, { slug }, { next: { revalidate: 60 } });
}

export async function getAllProductSlugs(): Promise<string[]> {
  return await sanityClient.fetch(productSlugsQuery);
}

export async function getProductCount(): Promise<number> {
  try {
    return await sanityClient.fetch(productCountQuery, {}, { next: { revalidate: 300 } });
  } catch {
    return 0;
  }
}

export async function getFeaturedProducts(): Promise<SanityProduct[]> {
  return await sanityClient.fetch(featuredProductsQuery, {}, { next: { revalidate: 60 } });
}

export async function getCategories(): Promise<SanityCategory[]> {
  return await sanityClient.fetch(categoriesQuery, {}, { next: { revalidate: 300 } });
}

export async function getCombos(): Promise<SanityCombo[]> {
  return await sanityClient.fetch(combosQuery, {}, { next: { revalidate: 60 } });
}

export async function getComboBySlug(slug: string): Promise<SanityCombo | null> {
  return await sanityClient.fetch(comboBySlugQuery, { slug }, { next: { revalidate: 60 } });
}

export async function getAllComboSlugs(): Promise<string[]> {
  return await sanityClient.fetch(comboSlugsQuery);
}

export async function getBrands(): Promise<SanityBrand[]> {
  return await sanityClient.fetch(brandsQuery, {}, { next: { revalidate: 300 } });
}

/** Clientes de la vidriera "confían en nosotros".
 *  NOTA: la sección de clientes del front todavía no está renderizada (nadie
 *  consume getBrands/getClients hoy). Este getter queda listo para cuando se
 *  arme la sección — debe leer CLIENTES (no marcas de producto). */
export async function getClients(): Promise<SanityClient[]> {
  return await sanityClient.fetch(clientsQuery, {}, { next: { revalidate: 300 } });
}

/** Testimonios de clientes para la home (schema `testimonial`, editable desde
 *  el Studio). Devuelve solo los activos; si no hay ninguno cargado, la home
 *  cae en su lista de fallback. */
export async function getTestimonials(): Promise<SanityTestimonial[]> {
  return await sanityClient.fetch(testimonialsQuery, {}, { next: { revalidate: 300 } });
}

/** Tarifa de decorado (singleton cargado por el sync). null si no existe o
 *  falla: la ficha simplemente no ofrece decorado con precio. */
export async function getDecoPricing(): Promise<DecoPricing | null> {
  try {
    const doc = await sanityClient.fetch<{ options?: DecoOption[] } | null>(
      decoPricingQuery,
      {},
      { next: { revalidate: 300 } },
    );
    const options = (doc?.options ?? []).filter(
      (o) => o && o.family && (o.sides === 1 || o.sides === 2) && Array.isArray(o.tiers),
    );
    return options.length ? { options } : null;
  } catch {
    return null;
  }
}

/** Config de envíos resuelta: lee el singleton de Sanity y lo mapea a
 *  ShippingConfig, cayendo al DEFAULT (tarifas hardcodeadas) por cada campo
 *  faltante o inválido. Nunca tira: ante cualquier error devuelve el default. */
export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const doc = await sanityClient.fetch<SanityShippingConfigDoc | null>(
      shippingConfigQuery,
      {},
      { next: { revalidate: 300 } },
    );
    if (!doc) return DEFAULT_SHIPPING_CONFIG;

    const andreani = { ...DEFAULT_SHIPPING_CONFIG.andreani };
    for (const b of doc.andreaniBands ?? []) {
      if (
        b &&
        (b.band === "AMBA" || b.band === "B2" || b.band === "B3" || b.band === "B4") &&
        typeof b.price === "number" &&
        b.price >= 0
      ) {
        andreani[b.band as ShippingBand] = b.price;
      }
    }

    const batu = {
      1: [...DEFAULT_SHIPPING_CONFIG.batu[1]],
      2: [...DEFAULT_SHIPPING_CONFIG.batu[2]],
      3: [...DEFAULT_SHIPPING_CONFIG.batu[3]],
      4: [...DEFAULT_SHIPPING_CONFIG.batu[4]],
    } as ShippingConfig["batu"];
    for (const z of doc.batuZones ?? []) {
      const zone = z?.zone;
      if ((zone === 1 || zone === 2 || zone === 3 || zone === 4) && Array.isArray(z.tramos)) {
        const tramos = z.tramos
          .filter((t) => t && typeof t.maxBultos === "number" && typeof t.price === "number")
          .map((t) => ({ maxBultos: t.maxBultos as number, price: t.price as number }))
          .sort((a, b) => a.maxBultos - b.maxBultos);
        if (tramos.length) batu[zone as BatuZone] = tramos;
      }
    }

    const andreaniMode = doc.andreaniMode === "cotizar" ? "cotizar" : "estimado";
    return { batu, andreani, andreaniMode };
  } catch {
    return DEFAULT_SHIPPING_CONFIG;
  }
}

/** Artículos del blog (index). */
export async function getBlogPosts(): Promise<SanityBlogPost[]> {
  return await sanityClient.fetch(blogPostsQuery, {}, { next: { revalidate: 300 } });
}

/** Artículo único por slug (incluye body portable text). */
export async function getBlogPostBySlug(slug: string): Promise<SanityBlogPost | null> {
  return await sanityClient.fetch(blogPostBySlugQuery, { slug }, { next: { revalidate: 300 } });
}

/** Slugs de todos los artículos — para generateStaticParams. */
export async function getAllBlogPostSlugs(): Promise<string[]> {
  return await sanityClient.fetch(blogPostSlugsQuery);
}

/** Hero/banner activo para un placement. Devuelve `null` si no hay ninguno
 *  cargado (o si esta despublicado) — el consumidor cae en su contenido por
 *  defecto en vez de renderizar un hueco. */
/** _id fijo de cada banner. Tienen que coincidir con los documentId de
 *  sanity/structure.ts — si cambian ahí, cambian acá. */
const HERO_IDS = {
  home: "hero-home",
  "home-promo": "hero-home-promo",
} as const;

/** Banner activo para un lugar de la home. Devuelve `null` si nunca se cargó o
 *  si está apagado — el consumidor cae en su contenido por defecto en vez de
 *  renderizar un hueco. */
export async function getHero(
  placement: keyof typeof HERO_IDS,
): Promise<SanityHero | null> {
  return await sanityClient.fetch(
    heroQuery,
    { id: HERO_IDS[placement] },
    { next: { revalidate: 60 } },
  );
}
