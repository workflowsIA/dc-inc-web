/** GROQ queries para el catálogo. */

import { groq } from "next-sanity";

/** Lista de productos (catálogo). Filtrable por categoría. */
export const productsQuery = groq`
  *[_type == "product"] | order(name asc) {
    _id,
    sku,
    name,
    "slug": slug.current,
    description,
    pricePublic,
    priceWholesale,
    pricePublicOld,
    unitsPerBulk,
    unitsPerPallet,
    deliveryTime,
    stockLevel,
    badges,
    decoAvailable,
    "image": coalesce(images[0].asset->url, legacyImageUrl),
    "category": category->name,
    "subtype": subtype->name
  }
`;

/** Producto único por slug. */
export const productBySlugQuery = groq`
  *[_type == "product" && slug.current == $slug][0] {
    _id,
    sku,
    name,
    "slug": slug.current,
    description,
    pricePublic,
    priceWholesale,
    pricePublicOld,
    unitsPerBulk,
    unitsPerPallet,
    deliveryTime,
    stockLevel,
    badges,
    decoAvailable,
    specs,
    "images": coalesce(images[].asset->url, [legacyImageUrl][!null]),
    "category": category->name,
    "subtype": subtype->name
  }
`;

/** Slugs de todos los productos — para generateStaticParams. */
export const productSlugsQuery = groq`*[_type == "product" && defined(slug.current)][].slug.current`;

/** Count total de productos activos. */
export const productCountQuery = groq`count(*[_type == "product"])`;

/** Productos destacados para la home. */
export const featuredProductsQuery = groq`
  *[_type == "product" && "best" in badges] | order(_createdAt desc)[0...4] {
    _id, sku, name, "slug": slug.current,
    pricePublic, priceWholesale, pricePublicOld,
    unitsPerBulk, deliveryTime, stockLevel, badges,
    "image": coalesce(images[0].asset->url, legacyImageUrl),
    "category": category->name
  }
`;

/** Categorías activas para sidebar y home. */
export const categoriesQuery = groq`
  *[_type == "category"] | order(order asc, name asc) {
    _id, name, "slug": slug.current, "image": image.asset->url
  }
`;

/** Combos activos. */
export const combosQuery = groq`
  *[_type == "combo" && active == true] | order(_createdAt desc) {
    _id, name, "slug": slug.current, description, pricePublicFrom, pricePublicOld, badge,
    "image": image.asset->url
  }
`;

/** Marcas/clientes activos (vidriera home). */
export const brandsQuery = groq`
  *[_type == "brand" && active == true] | order(order asc, name asc) {
    _id, name, url, "logo": logo.asset->url
  }
`;

/** Hero/banner por placement. */
export const heroQuery = groq`
  *[_type == "hero" && active == true && placement == $placement] | order(order asc)[0] {
    _id, title, subtitle, ctaLabel, ctaHref, "image": image.asset->url
  }
`;

/** Tipo TypeScript inferido de los queries — usar para tipar lo que viene de Sanity. */
export interface SanityProduct {
  _id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  pricePublic: number;
  priceWholesale: number;
  pricePublicOld?: number;
  unitsPerBulk: number;
  unitsPerPallet?: number;
  deliveryTime: string;
  stockLevel: "ok" | "low" | "out";
  badges: ("best" | "new" | "promo" | "deco")[];
  decoAvailable: boolean;
  specs?: { key: string; value: string }[];
  image?: string;
  images?: string[];
  category?: string;
  subtype?: string;
}

export interface SanityCategory {
  _id: string;
  name: string;
  slug: string;
  image?: string;
}

export interface SanityCombo {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  pricePublicFrom?: number;
  pricePublicOld?: number;
  badge?: string;
  image?: string;
}

export interface SanityBrand {
  _id: string;
  name: string;
  url?: string;
  logo?: string;
}
