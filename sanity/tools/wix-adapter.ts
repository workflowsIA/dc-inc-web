/**
 * Adapter del formato de export de Wix Stores → formato canónico de la
 * herramienta "Actualizar por CSV".
 *
 * Idea (pedido de Fede): Marce sigue trabajando con el CSV que exporta de Wix
 * (columnas handleId, fieldType, name, description, productImageUrl, collection,
 * sku, ribbon, price…). En vez de obligarla a usar NUESTROS nombres de columna,
 * detectamos que el archivo es formato Wix y traducimos cada celda al campo que
 * corresponde en Sanity. Así el mismo tool acepta los dos formatos.
 *
 * Todo Wix-específico vive acá; `csv-logic.ts` no cambia: recibe filas ya
 * "canónicas" (con nuestros nombres de columna) y sigue su curso normal.
 *
 * Reglas:
 *  - Solo filas fieldType=Product (las Variant son presentaciones → las maneja el
 *    sync de la Sheet, no la ingesta de contenido).
 *  - description viene en HTML → se limpia a texto plano.
 *  - collection (multi-valor, con tags de uso) → categoría por inferencia del
 *    NOMBRE (misma lógica que migrate-wix / fix-categories), con "válvula" →
 *    Accesorios (Válvulas dejó de ser categoría propia).
 *  - productImageUrl → primera URL (Wix a veces exporta solo el nombre de
 *    archivo → le prependeamos el dominio del CDN).
 *  - ribbon → badge (solo los que mapean a nuestros destacados).
 *  - price NO se traduce a un update (el precio vive en la Sheet). Se expone
 *    aparte solo para SEMBRAR el precio de un producto NUEVO (borrador).
 */
import { norm } from "./csv-columns";

/** Detecta el export de Wix por dos columnas propias e inconfundibles. */
export function isWixFormat(headers: string[]): boolean {
  const set = new Set(headers.map(norm));
  return set.has("handleid") && set.has("fieldtype");
}

/** Slug de categoría inferido del nombre (misma lógica que fix-categories.ts,
 *  pero "válvula" → accesorios). El nombre manda; collection es fallback. */
export function inferCategorySlug(name: string, collection = ""): string {
  const n = norm(name);
  if (n.includes("tapa") || n.includes("tapon")) return "tapas";
  if (n.includes("precinto")) return "tapas";
  if (n.includes("valvula")) return "accesorios";
  if (n.includes("botellon") || n.includes("growler")) return "botellones";
  if (n.includes("botella")) return "botellas";
  if (n.includes("lata")) return "latas";
  if (
    ["copa", "copon", "vaso", "pinta", "chop", "jarra", "decantador", "chupito",
      "balon", "tulipa", "cylinder", "cilindro", "pilsner", "pilsener"].some((k) => n.includes(k))
  )
    return "copas";
  if (n.includes("caja") || n.includes("estuche") || n.includes("valij")) return "cajas";
  if (n.includes("bandeja")) return "accesorios";
  if (n.includes("decoracion") || n.includes("impresion") || n.includes("serigraf")) return "decorado";
  // Fallback: collection.
  const c = norm(collection);
  if (c.includes("tapa")) return "tapas";
  if (c.includes("valvula") || c.includes("accesor") || c.includes("bandeja")) return "accesorios";
  if (c.includes("botellon")) return "botellones";
  if (c.includes("botella")) return "botellas";
  if (c.includes("lata")) return "latas";
  if (c.includes("copa") || c.includes("vaso")) return "copas";
  if (c.includes("caja") || c.includes("estuche")) return "cajas";
  return "otros";
}

/** slug → nombre de categoría (tiene que matchear los `name` de los docs `category`). */
export const CATEGORY_NAME: Record<string, string> = {
  botellas: "Botellas",
  latas: "Latas",
  copas: "Copas y vasos",
  botellones: "Botellones",
  cajas: "Cajas y estuches",
  tapas: "Tapas y precintos",
  accesorios: "Accesorios",
  decorado: "Decorado",
  otros: "Otros",
};

/** HTML → texto plano (Wix exporta la descripción con <p>, <br>, entidades…). */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Primera imagen de productImageUrl (Wix concatena con ; y a veces da solo el nombre). */
export function firstWixImage(s: string): string {
  const first = (s || "").split(/[;|]/)[0].trim();
  if (!first) return "";
  return first.startsWith("http") ? first : `https://static.wixstatic.com/media/${first}`;
}

/** ribbon de Wix → título de badge que entiende nuestra coerción (o "" si no mapea). */
export function ribbonToBadge(ribbon: string): string {
  const r = norm(ribbon);
  if (!r) return "";
  if (r.includes("vendido") || r.includes("best")) return "Más vendido";
  if (r.includes("nuevo") || r.includes("new")) return "Nuevo";
  if (r.includes("oferta") || r.includes("promo") || r.includes("sale")) return "Promo del mes";
  if (r.includes("decorado")) return "Decorado bonificado";
  return "";
}

/** Número tolerante (Wix usa formato US "1234.56" o "1,234.56"). */
export function wixPrice(s: string): number | null {
  if (!s) return null;
  const clean = s.replace(/[^\d.,-]/g, "");
  let n: number;
  if (clean.includes(",") && clean.includes(".")) n = parseFloat(clean.replace(/,/g, ""));
  else if (clean.includes(",")) n = parseFloat(clean.replace(",", "."));
  else n = parseFloat(clean);
  return Number.isFinite(n) ? n : null;
}

/** Info extra por SKU para el camino de ALTA (crear borrador): nombre + precio semilla. */
export interface WixCreateInfo {
  name: string;
  pricePublic: number | null;
  categoryName: string;
}

/**
 * Convierte filas Wix a filas "canónicas" (con nuestros headers) + info de alta.
 * Devuelve headers canónicos para que `matchColumns` los reconozca sin cambios.
 */
export function wixToCanonical(rows: Record<string, string>[]): {
  headers: string[];
  rows: Record<string, string>[];
  createInfo: Map<string, WixCreateInfo>;
} {
  const headers = ["sku", "nombre", "descripcion", "categoria", "imagen", "destacados"];
  const out: Record<string, string>[] = [];
  const createInfo = new Map<string, WixCreateInfo>();

  for (const r of rows) {
    // norm-keys ya vienen normalizados desde parseCsv.
    const fieldType = norm(r["fieldtype"] ?? "");
    if (fieldType && fieldType !== "product") continue; // saltear variantes
    const sku = (r["sku"] ?? "").trim();
    const name = (r["name"] ?? "").trim();
    if (!sku && !name) continue;

    const slug = inferCategorySlug(name, r["collection"] ?? "");
    const categoryName = CATEGORY_NAME[slug] ?? "Otros";
    const badge = ribbonToBadge(r["ribbon"] ?? "");

    out.push({
      sku,
      nombre: name,
      descripcion: stripHtml(r["description"] ?? ""),
      categoria: categoryName,
      imagen: firstWixImage(r["productimageurl"] ?? ""),
      destacados: badge,
    });

    if (sku) {
      createInfo.set(norm(sku), {
        name,
        pricePublic: wixPrice(r["price"] ?? ""),
        categoryName,
      });
    }
  }
  return { headers, rows: out, createInfo };
}
