/** GROQ queries para el catálogo. */

import { groq } from "next-sanity";

/** Lista de productos (catálogo). Filtrable por categoría. */
export const productsQuery = groq`
  *[_type == "product"] | order(name asc) {
    _id,
    sku,
    name,
    sortOrder,
    homeFeatured,
    "categoryOrder": category->order,
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
    presentationPricing[]{ sku, label, variant, unitsPerBulk, pricePublic },
    unitsPerBulk,
    unitsPerPallet,
    deliveryTime,
    stockLevel,
    badges,
    decoAvailable,
    "image": coalesce(images[0].asset->url, legacyImageUrl),
    "category": category->name,
    "subtypes": array::compact(coalesce(subtypes[]->name, [subtype->name]))
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
    presentationPricing[]{ sku, label, variant, unitsPerBulk, pricePublic, priceWholesale },
    unitsPerBulk,
    unitsPerPallet,
    deliveryTime,
    stockLevel,
    badges,
    decoAvailable,
    decoFamily,
    specs,
    "image": coalesce(images[0].asset->url, legacyImageUrl),
    "category": category->name,
    "subtypes": array::compact(coalesce(subtypes[]->name, [subtype->name]))
  }
`;

/** Precios mayoristas por producto — SOLO para /api/precios (usuario wholesale).
 *  Trae el neto unitario y el neto por presentación (caja/pallet). Es un query
 *  aparte porque `productsQuery` NO incluye priceWholesale de las presentaciones
 *  (ese dato no viaja en el payload público) — y por eso /api/precios devolvía
 *  `pres` vacío y el mayorista veía el precio unitario base en Caja y Pallet
 *  (bug reportado por Marce, ago-2026: "Botella R 500 ml, $530 en las tres"). */
export const wholesalePricesQuery = groq`
  *[_type == "product"] {
    _id, "slug": slug.current, priceWholesale,
    presentationPricing[]{ sku, unitsPerBulk, priceWholesale }
  }
`;

/** Slugs de todos los productos — para generateStaticParams. */
export const productSlugsQuery = groq`*[_type == "product" && defined(slug.current)][].slug.current`;

/** Count total de productos activos. */
export const productCountQuery = groq`count(*[_type == "product"])`;

/** Productos por lista de SKUs — para recalcular precios de un pedido server-side
 *  y para rearmar el carrito en "repetir pedido". Trae solo lo necesario. */
export const productsBySkusQuery = groq`
  *[_type == "product" && sku in $skus] {
    sku, name, "slug": slug.current,
    pricePublic, priceWholesale,
    isOnSale, salePrice, saleStartDate, saleEndDate,
    unitsPerBulk, unitsPerPallet,
    presentationPricing[]{ sku, label, variant, unitsPerBulk, pricePublic, priceWholesale },
    "image": coalesce(images[0].asset->url, legacyImageUrl)
  }
`;

/** Combos por lista de slugs — para recalcular pedidos con combos. */
export const combosBySlugsQuery = groq`
  *[_type == "combo" && slug.current in $slugs] {
    _id, name, "slug": slug.current, pricePublicFrom,
    "image": image.asset->url
  }
`;

/** Pedidos de un usuario logueado (historial en Mi cuenta). */
export const ordersByUserQuery = groq`
  *[_type == "order" && clerkUserId == $uid] | order(createdAt desc)[0...50] {
    _id, orderNumber, createdAt, priceBasis,
    subtotal, iva, total, paymentStatus, fulfillmentStatus, origin, notes,
    items[]{ name, sku, baseSku, bultos, unidades, precioUnitario, subtotal }
  }
`;

/** Stats de pedidos por usuario (panel de clientes admin). Trae solo lo justo
 *  para agregar #pedidos y total comprado por cada clerkUserId. */
export const ordersByUserStatsQuery = groq`
  *[_type == "order" && defined(clerkUserId)]{ clerkUserId, total, paymentStatus, createdAt }
`;

/** Pedido por su external_payment_id de Nave (para conciliar desde el webhook
 *  o desde /api/nave/status). Incluye items (descuento de stock) y datos del
 *  cliente (notificación de venta en Monday). */
export const orderByNaveExternalIdQuery = groq`
  *[_type == "order" && naveExternalId == $eid][0]{
    _id, orderNumber, paymentStatus, total, navePaymentRequestId,
    customerName, customerCompany, customerEmail, customerPhone,
    items[]{ name, sku, baseSku, bultos, unidades, precioUnitario, subtotal }
  }
`;

/** Pedidos impagos con intención de Nave (últimas 72 h) — para la barredora
 *  /api/nave/reconcile-pending (cierra el caso "pagó y cerró la pestaña"). */
export const pendingNaveOrdersQuery = groq`
  *[_type == "order" && paymentStatus == "no_pagado" && defined(navePaymentRequestId)
    && dateTime(createdAt) > dateTime(now()) - 60*60*72]
    | order(createdAt desc)[0...25]{
    _id, orderNumber, paymentStatus, total, navePaymentRequestId,
    customerName, customerCompany, customerEmail, customerPhone,
    items[]{ name, sku, baseSku, bultos, unidades, precioUnitario, subtotal }
  }
`;

/** Todos los pedidos (panel admin). */
export const allOrdersQuery = groq`
  *[_type == "order"] | order(createdAt desc)[0...200] {
    _id, orderNumber, createdAt, priceBasis,
    customerName, customerCompany, customerEmail, customerPhone,
    subtotal, iva, total, paymentStatus, fulfillmentStatus, origin, notes,
    items[]{ name, sku, bultos, unidades, precioUnitario, subtotal }
  }
`;

/** Productos destacados para la home.
 *  Prioridad: los marcados "Destacar en el home" (homeFeatured), ordenados por
 *  `sortOrder`; si no hay ninguno marcado, caen los que tienen el badge
 *  "Más vendido" (comportamiento histórico). Trae hasta 8 y la home recorta. */
export const featuredProductsQuery = groq`
  *[_type == "product" && (homeFeatured == true || "best" in badges)]
    | order(select(homeFeatured == true => 0, 1) asc, coalesce(sortOrder, 999999) asc, _createdAt desc)[0...8] {
    _id, sku, name, "slug": slug.current, sortOrder, homeFeatured,
    pricePublic, priceWholesale, pricePublicOld,
    isOnSale, salePrice, saleStartDate, saleEndDate,
    presentations, unitsPerBulk, unitsPerPallet, presentationPricing[]{ sku, label, variant, unitsPerBulk, pricePublic }, deliveryTime, stockLevel, badges,
    "image": coalesce(images[0].asset->url, legacyImageUrl),
    "category": category->name
  }
`;

/** Categorías activas para sidebar y home. */
export const categoriesQuery = groq`
  *[_type == "category"] | order(order asc, name asc) {
    _id, name, order, "slug": slug.current, "image": image.asset->url
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

/** Testimonios de clientes (home). Solo los activos, ordenados por `order`
 *  y después por nombre. */
export const testimonialsQuery = groq`
  *[_type == "testimonial" && active == true] | order(order asc, name asc) {
    _id, quote, name, location
  }
`;

/** Tarifa de decorado (singleton _id "deco-pricing", la carga el sync). */
export const decoPricingQuery = groq`
  *[_type == "decoPricing" && _id == "deco-pricing"][0] {
    options[]{ family, sides, label, setupSku, setupPrice, tiers[]{ sku, minUnits, pricePerUnit } }
  }
`;

/** Config de envíos (singleton _id "shipping-config"). Devuelve el doc crudo;
 *  getShippingConfig() lo mapea a ShippingConfig con fallback a los defaults. */
export const shippingConfigQuery = groq`
  *[_type == "shippingConfig" && _id == "shipping-config"][0] {
    andreaniMode,
    andreaniBands[]{ band, price },
    batuZones[]{ zone, tramos[]{ maxBultos, price } }
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

/** Hero/banner por id fijo (singleton). Los banners viven con _id conocido
 *  —`hero-home` y `hero-home-promo`— y se editan como dos entradas fijas del
 *  Studio, así que se buscan por _id y no por un campo `placement` que Marce
 *  tendría que setear a mano. `active == false` devuelve null a propósito: la
 *  home cae en su contenido por defecto. */
export const heroQuery = groq`
  *[_type == "hero" && _id == $id && active != false][0] {
    _id, title, subtitle, ctaLabel, ctaHref, "image": image.asset->url
  }
`;

/** Tipo TypeScript inferido de los queries — usar para tipar lo que viene de Sanity. */
/** Precio por presentación (bulto: Caja/Pallet) — descuento por volumen.
 *  Lo puebla la sincronización Sheet→Sanity (ver src/lib/sheet-sync.ts). Los
 *  precios son POR UNIDAD a ese markup, misma base que pricePublic/priceWholesale. */
export interface PresentationPricing {
  sku?: string;
  label?: string;
  /** distintivo dentro del mismo tipo (ej. color de tapa "Lisa Negra") */
  variant?: string;
  unitsPerBulk: number;
  pricePublic?: number;
  priceWholesale?: number;
}

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
  presentationPricing?: PresentationPricing[];
  unitsPerBulk: number;
  unitsPerPallet?: number;
  deliveryTime: string;
  stockLevel: "ok" | "low" | "out";
  badges: ("best" | "new" | "promo" | "deco")[];
  decoAvailable: boolean;
  /** familia de tarifa de decorado (ver src/lib/deco.ts) */
  decoFamily?: string;
  specs?: { key: string; value: string }[];
  image?: string;
  images?: string[];
  category?: string;
  /** orden de la categoría (para agrupar el catálogo por rubro) */
  categoryOrder?: number;
  /** nombres de los subtipos (array; compat con el campo viejo `subtype`) */
  subtypes?: string[];
  /** orden manual en el catálogo */
  sortOrder?: number;
  /** destacado en el home */
  homeFeatured?: boolean;
}

export interface SanityCategory {
  _id: string;
  name: string;
  slug: string;
  order?: number;
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

export interface SanityTestimonial {
  _id: string;
  quote: string;
  name: string;
  location?: string;
}

/** Doc crudo del singleton de envíos (todos los campos opcionales — el getter
 *  cae al default por campo). */
export interface SanityShippingConfigDoc {
  andreaniMode?: "estimado" | "cotizar";
  andreaniBands?: { band?: string; price?: number }[];
  batuZones?: { zone?: number; tramos?: { maxBultos?: number; price?: number }[] }[];
}

/** Hero/banner editable desde el Studio (ver `heroQuery` + schema `hero`).
 *  Solo `title` es obligatorio en el schema; el resto puede faltar, y cada
 *  consumidor decide con que caer si no viene. */
export interface SanityHero {
  _id: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** URL del asset ya resuelta por el query (`image.asset->url`). */
  image?: string;
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

export interface SanityOrderItem {
  name?: string;
  sku?: string;
  /** SKU del producto base cuando `sku` es el de una presentación */
  baseSku?: string;
  bultos?: number;
  unidades?: number;
  precioUnitario?: number;
  subtotal?: number;
}

export interface SanityOrder {
  _id: string;
  orderNumber: string;
  createdAt: string;
  priceBasis?: "final" | "mayorista";
  customerName?: string;
  customerCompany?: string;
  customerEmail?: string;
  customerPhone?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  paymentStatus?: "no_pagado" | "pagado" | "expirado" | "cancelado" | "devuelto";
  fulfillmentStatus?: "no_procesado" | "procesado" | "enviado";
  origin?: "web" | "whatsapp";
  /** pedido de prueba: no cuenta en las métricas del panel */
  isTest?: boolean;
  paymentProvider?: string;
  paymentId?: string;
  naveExternalId?: string;
  navePaymentRequestId?: string;
  notes?: string;
  items?: SanityOrderItem[];
}

/** Producto reducido para recálculo de pedidos (productsBySkusQuery). */
export interface OrderPricingProduct {
  sku: string;
  name: string;
  slug?: string;
  pricePublic: number;
  priceWholesale: number;
  isOnSale?: boolean;
  salePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  unitsPerBulk: number;
  unitsPerPallet?: number;
  presentationPricing?: PresentationPricing[];
  image?: string;
}

/** Combo reducido para recálculo de pedidos (combosBySlugsQuery). */
export interface OrderPricingCombo {
  _id: string;
  name: string;
  slug: string;
  pricePublicFrom?: number;
  image?: string;
}
