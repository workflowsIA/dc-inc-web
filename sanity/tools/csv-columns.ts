/**
 * Registro de columnas soportadas por la herramienta "Actualizar por CSV".
 *
 * Regla de oro: la herramienta actualiza SOLO campos que Marce edita a mano en
 * el Studio. NO toca precio base ni stock — esos viven en la planilla de precios
 * y los pisa la sincronización Sheet→Sanity (`sheet-sync.ts` escribe pricePublic,
 * priceWholesale, unitsPerBulk, presentationPricing, stockQty, stockMin,
 * stockLevel). Si dejáramos actualizar esos por CSV, el sync diario los volvería
 * a pisar → conflicto. Por eso quedan afuera a propósito.
 *
 * Los campos de OFERTA (isOnSale, salePrice, fechas, pricePublicOld) SÍ están:
 * son merchandising que Marce controla manualmente y el sync no toca.
 */

export type ColumnKind =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "ref"
  | "stringArray"
  | "badges"
  | "specs";

export interface ColumnDef {
  /** Campo en el schema de `product`. */
  field: string;
  /** Etiqueta humana para la UI. */
  label: string;
  kind: ColumnKind;
  /** Headers reconocidos (normalizados: sin acentos, minúsculas). El primero es el "canónico" para plantilla/export. */
  headers: string[];
  /** Solo para kind === "ref": tipo del documento referenciado. */
  refType?: "category" | "subtype";
}

/** Badges permitidos (mismo `list` que el schema de product). value ← título/alias. */
export const BADGE_VALUES: { value: string; titles: string[] }[] = [
  { value: "best", titles: ["mas vendido", "más vendido", "best", "mas-vendido"] },
  { value: "new", titles: ["nuevo", "new"] },
  { value: "promo", titles: ["promo del mes", "promo", "promocion", "promoción"] },
  { value: "deco", titles: ["decorado bonificado", "deco", "decorado"] },
];

export const COLUMNS: ColumnDef[] = [
  // --- Básico ---
  { field: "name", label: "Nombre", kind: "string", headers: ["nombre", "name"] },
  {
    field: "description",
    label: "Descripción",
    kind: "text",
    headers: ["descripcion", "description", "detalle", "descripcion larga"],
  },
  {
    field: "category",
    label: "Categoría",
    kind: "ref",
    refType: "category",
    headers: ["categoria", "category", "rubro"],
  },
  {
    field: "subtype",
    label: "Subtipo",
    kind: "ref",
    refType: "subtype",
    headers: ["subtipo", "subtype", "tipo"],
  },
  // --- Presentación (solo lo que NO maneja el sync) ---
  {
    field: "unitsPerPallet",
    label: "Unidades por pallet",
    kind: "number",
    headers: ["unidades por pallet", "unidad por pallet", "uxp", "por pallet"],
  },
  {
    field: "deliveryTime",
    label: "Plazo de entrega",
    kind: "string",
    headers: ["plazo de entrega", "plazo", "entrega", "deliverytime"],
  },
  {
    field: "presentations",
    label: "Presentaciones",
    kind: "stringArray",
    headers: ["presentaciones", "presentations"],
  },
  // --- Oferta (merchandising manual, el sync no lo toca) ---
  {
    field: "isOnSale",
    label: "En oferta",
    kind: "boolean",
    headers: ["en oferta", "oferta", "isonsale"],
  },
  {
    field: "salePrice",
    label: "Precio de oferta",
    kind: "number",
    headers: ["precio de oferta", "precio oferta", "saleprice"],
  },
  {
    field: "saleStartDate",
    label: "Inicio de oferta",
    kind: "date",
    headers: ["inicio de oferta", "inicio oferta", "salestart", "salestartdate"],
  },
  {
    field: "saleEndDate",
    label: "Fin de oferta",
    kind: "date",
    headers: ["fin de oferta", "fin oferta", "saleend", "saleenddate"],
  },
  {
    field: "pricePublicOld",
    label: "Precio anterior (tachado)",
    kind: "number",
    headers: ["precio anterior", "precio tachado", "precio publico anterior", "pricepublicold"],
  },
  // --- Decoración y destacados ---
  {
    field: "badges",
    label: "Destacados",
    kind: "badges",
    headers: ["destacados", "badges", "etiquetas"],
  },
  {
    field: "decoAvailable",
    label: "Decorado disponible",
    kind: "boolean",
    headers: ["decorado disponible", "decoavailable", "se decora"],
  },
  // --- Ficha técnica ---
  {
    field: "specs",
    label: "Especificaciones",
    kind: "specs",
    headers: ["especificaciones", "specs", "ficha tecnica", "ficha técnica"],
  },
  // --- SEO ---
  {
    field: "seoTitle",
    label: "Título SEO",
    kind: "string",
    headers: ["titulo seo", "seotitle", "seo titulo"],
  },
  {
    field: "seoDescription",
    label: "Descripción SEO",
    kind: "text",
    headers: ["descripcion seo", "seodescription", "meta description", "meta descripcion"],
  },
];

/** Header de la columna llave (identifica el producto). */
export const SKU_HEADERS = ["sku", "codigo", "código", "cod"];

/** Normaliza un texto para comparar headers/valores (sin acentos, minúsculas, trim). */
export function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}
