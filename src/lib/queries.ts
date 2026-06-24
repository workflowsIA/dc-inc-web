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
    isOnSale,
    salePrice,
    saleStartDate,
    saleEndDate,
    presentations,
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
    isOnSale,
    salePrice,
    saleStartDate,
    saleEndDate,
    presentations,
    unitsPerBulk,
    unitsPerPallet,
    deliveryTime,
    stockLevel,
    badges,
    decoAvailable,
    specs,
    "image": coalesce(images[0].asset->url, legacyImageUrl),
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
    isOnSale, salePrice, saleStartDate, saleEndDate,
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

/** Combos activos (listado: home / index). */
export const combosQuery = groq`
  *[_type == "combo" && active == true] | order(_createdAt desc) {
    _id, name, "slug": slug.current, description, pricePublicFrom, pricePublicOld, badge,
    "image": image.asset->url
  }
`;

/** Combo único por slug (incluye los SKUs incluidos para la ficha). */
export const comboBySlugQuery = groq`
  *[_type == "combo" && active == true && slug.current == $slug][0] {
    _id, name, "slug": slug.current, description, pricePublicFrom, pricePublicOld, badge,
    "image": image.asset->url,
    "items": items[]->{
      _id, sku, name, "slug": slug.current,
      "image": coalesce(images[0].asset->url, legacyImageUrl)
    }
  }
`;

/** Slugs de todos los combos activos — para generateStaticParams. */
export const comboSlugsQuery = groq`*[_type == "combo" && active == true && defined(slug.current)][].slug.current`;

/** Marcas de producto activas. */
export const brandsQuery = groq`
  *[_type == "brand" && active == true] | order(order asc, name asc) {
    _id, name, url, "logo": logo.asset->url
  }
`;

/** Clientes de la vidriera "confían en nosotros" (home / nosotros).
 *  Separado de `brand` (que ahora es solo marcas de producto). */
export const clientsQuery = groq`
  *[_type == "client" && active == true] | order(order asc, name asc) {
    _id, name, website, "logo": logo.asset->url
  }
`;

/** Artículos del blog (index) — ordenados por fecha de publicación. */
export const blogPostsQuery = groq`
  *[_type == "blogPost" && defined(slug.current)] | order(publishedAt desc) {
    _id, title, "slug": slug.current, excerpt, category, publishedAt,
    "cover": cover.asset->url
  }
`;

/** Artículo único por slug. */
export const blogPostBySlugQuery = groq`
  *[_type == "blogPost" && slug.current == $slug][0] {
    _id, title, "slug": slug.current, excerpt, category, publishedAt,
    "cover": cover.asset->url,
    body
  }
`;

/** Slugs de todos los artículos — para generateStaticParams. */
export const blogPostSlugsQuery = groq`*[_type == "blogPost" && defined(slug.current)][].slug.current`;

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
  isOnSale?: boolean;
  salePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  presentations?: string[];
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

/** SKU incluido en un combo (sólo los campos que muestra la ficha). */
export interface SanityComboItem {
  _id: string;
  sku: string;
  name: string;
  slug?: string;
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
  /** sólo presente en el detalle (comboBySlugQuery) */
  items?: SanityComboItem[];
}

export interface SanityBrand {
  _id: string;
  name: string;
  url?: string;
  logo?: string;
}

export interface SanityClient {
  _id: string;
  name: string;
  website?: string;
  logo?: string;
}

import type { PortableTextBlock } from "@portabletext/react";

export interface SanityBlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category?: string;
  publishedAt?: string;
  cover?: string;
  /** sólo presente en el detalle (blogPostBySlugQuery) */
  body?: PortableTextBlock[];
}
