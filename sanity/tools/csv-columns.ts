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

// `norm` vive en csv-parse.ts (sin dependencias, testeable con npm run csv:check).
// Se re-exporta acá porque el resto del código lo venía importando desde este módulo.
// OJO: `export { x } from` NO crea un binding local, y acá abajo usamos norm()
// para armar los headers de las columnas de grupo. Por eso además se importa.
import { norm } from "./csv-parse";
export { norm };

export type ColumnKind =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "ref"
  /** varias referencias separadas por ; o | (ej. subtipos "Cognac; Whisky") */
  | "refArray"
  /** una columna por GRUPO de filtro: sus valores son subcategorías de ese grupo */
  | "subcatGroup"
  | "stringArray"
  | "badges"
  | "specs"
  | "image";

export interface ColumnDef {
  /** Campo en el schema de `product`. */
  field: string;
  /** Etiqueta humana para la UI. */
  label: string;
  kind: ColumnKind;
  /** Headers reconocidos (normalizados: sin acentos, minúsculas). El primero es el "canónico" para plantilla/export. */
  headers: string[];
  /** Solo para kind === "ref" / "refArray": tipo del documento referenciado. */
  refType?: "category" | "subtype";
  /** Solo para kind === "subcatGroup": _id del grupo de filtro que representa. */
  groupId?: string;
  /** Columna vieja que se sigue aceptando al importar para no romper archivos
   *  que Marce ya tenga bajados. No se escribe en el export ni en la plantilla. */
  legacy?: boolean;
}

/** Badges permitidos (mismo `list` que el schema de product). value ← título/alias. */
export const BADGE_VALUES: { value: string; titles: string[] }[] = [
  { value: "best", titles: ["mas vendido", "más vendido", "best", "mas-vendido"] },
  { value: "new", titles: ["nuevo", "new"] },
  { value: "promo", titles: ["promo del mes", "promo", "promocion", "promoción"] },
  { value: "deco", titles: ["decorado bonificado", "deco", "decorado"] },
  // Marce las usó en el CSV del 13-sep-2026 ("Pre Venta", "Liquidación") y la
  // lista cerrada las rechazaba, tirando abajo la fila entera. Ahora existen.
  { value: "preventa", titles: ["pre venta", "preventa", "pre-venta"] },
  { value: "liquidacion", titles: ["liquidacion", "liquidación", "liquida"] },
];

/** Etiquetas lindas de cada destacado, para el export y los mensajes. */
export const BADGE_TITLES: Record<string, string> = {
  best: "Más vendido",
  new: "Nuevo",
  promo: "Promo del mes",
  deco: "Decorado bonificado",
  preventa: "Pre venta",
  liquidacion: "Liquidación",
};

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
    // Imagen principal del producto por URL. Flujo pensado para Marce (estilo Wix):
    // sube la foto al banco de imágenes de Sanity, copia la URL y la pega acá.
    // - URL del CDN de Sanity → se convierte en referencia directa (sin re-subir).
    // - URL externa → se intenta bajar y subir a Sanity; si el navegador la bloquea
    //   (CORS), se informa y se le pide subirla primero al banco de Sanity.
    // REEMPLAZA la imagen principal del producto por la indicada.
    field: "images",
    label: "Imagen (URL)",
    kind: "image",
    headers: ["imagen", "foto", "imagen url", "image", "imagen principal", "url imagen"],
  },
  {
    field: "category",
    label: "Categoría",
    kind: "ref",
    refType: "category",
    headers: ["categoria", "category", "rubro"],
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

/**
 * Header de la columna de publicación. No es un campo del schema: dice si el
 * producto está visible en la web (publicado) o sigue como borrador. Lo pidió
 * Marce (12-sep-2026) para poder publicar/despublicar en lote desde el CSV.
 */
export const PUBLISH_HEADERS = ["publicado", "publicar", "published", "visible en la web", "visible"];

/** Etiqueta de la columna de publicación en el export y la plantilla. */
export const PUBLISH_LABEL = "Publicado";

/* ------------------------------------------------------------------ *
 * Columnas dinámicas: una por GRUPO de filtro
 * ------------------------------------------------------------------ *
 * Antes había una sola columna fija "Subtipos" donde entraba todo mezclado.
 * Ahora el archivo trae una columna por grupo ("Bebida", "Modelo", "Tipo de
 * pieza"…) y las columnas salen de lo que exista en Sanity: si Marce crea un
 * grupo nuevo, la columna aparece sola en el export y en la plantilla, sin que
 * nadie toque código.
 *
 * El encabezado se reconoce por el nombre del grupo, por su identificador
 * (slug) y por los alias que tenga cargados. Como el identificador NO cambia
 * cuando se renombra el grupo, un archivo bajado antes del cambio de nombre
 * sigue entrando bien.
 */

export interface GroupInfo {
  _id: string;
  name: string;
  slug?: string;
  aliases?: string[];
  order?: number;
}

/** La columna vieja. Se sigue aceptando al importar (archivos ya bajados), pero
 *  no se escribe más en el export ni en la plantilla. */
export const LEGACY_SUBTYPES_COLUMN: ColumnDef = {
  field: "subtypes",
  label: "Subtipos",
  kind: "refArray",
  refType: "subtype",
  legacy: true,
  headers: ["subtipos", "subtipo", "subtypes", "subtype", "tipo"],
};

export function groupColumn(g: GroupInfo): ColumnDef {
  return {
    field: "subtypes",
    label: g.name,
    kind: "subcatGroup",
    refType: "subtype",
    groupId: g._id,
    headers: [g.name, g.slug ?? "", ...(g.aliases ?? [])].filter(Boolean).map(norm),
  };
}

/**
 * Columnas efectivas del archivo: las fijas, con las columnas de grupo metidas
 * justo después de "Categoría" (que es donde estaba "Subtipos").
 * `forImport` agrega la columna vieja para poder leer archivos anteriores.
 */
export function buildColumns(groups: GroupInfo[], forImport = false): ColumnDef[] {
  const ordenados = [...groups].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name),
  );
  const cols: ColumnDef[] = [];
  for (const c of COLUMNS) {
    cols.push(c);
    if (c.field === "category") cols.push(...ordenados.map(groupColumn));
  }
  if (forImport) cols.push(LEGACY_SUBTYPES_COLUMN);
  return cols;
}
