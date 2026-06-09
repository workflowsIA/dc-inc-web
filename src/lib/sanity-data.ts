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
  featuredProductsQuery,
  categoriesQuery,
  combosQuery,
  brandsQuery,
  heroQuery,
  type SanityProduct,
  type SanityCategory,
  type SanityCombo,
  type SanityBrand,
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

export async function getHero(placement: "home" | "home-promo" | "catalog-inline") {
  return await sanityClient.fetch(heroQuery, { placement }, { next: { revalidate: 60 } });
}
