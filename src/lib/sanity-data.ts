/**
 * Helpers tipados para leer datos del catálogo desde Sanity.
 * Las páginas (server components) llaman a estas funciones; nadie usa
 * sanityClient directamente.
 */
import { sanityClient } from "./sanity";
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
  type SanityBlogPost,
  type SanityHero,
} from "./queries";
import type { Product, Badge, StockLevel } from "@/data/products";

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
    sub: p.subtype ?? "",
    name: p.name,
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

export async function getProducts(): Promise<SanityProduct[]> {
  return await sanityClient.fetch(productsQuery, {}, { next: { revalidate: 60 } });
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
