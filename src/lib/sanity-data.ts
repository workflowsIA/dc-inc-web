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
  brandsQuery,
  clientsQuery,
  blogPostsQuery,
  blogPostBySlugQuery,
  blogPostSlugsQuery,
  heroQuery,
  type SanityProduct,
  type SanityCategory,
  type SanityCombo,
  type SanityBrand,
  type SanityClient,
  type SanityBlogPost,
} from "./queries";
import type { Product, Badge, StockLevel } from "@/data/products";

/** Convierte un producto Sanity al shape legacy que consumen las páginas
 *  (mismo Product que el mock). El packshot viene como `imageUrl` (URL absoluta
 *  del CDN de Sanity) en vez de `img` (key local). */
export function toLegacyProduct(p: SanityProduct): Product {
  return {
    id: p.slug || p._id,
    sku: p.sku,
    cat: p.category ?? "Otros",
    sub: p.subtype ?? "",
    name: p.name,
    pub: p.pricePublic,
    may: p.priceWholesale,
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

export async function getHero(placement: "home" | "home-promo" | "catalog-inline") {
  return await sanityClient.fetch(heroQuery, { placement }, { next: { revalidate: 60 } });
}
