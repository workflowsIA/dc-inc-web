/**
 * Migración del catálogo Wix → Sanity.
 *
 * Lee `wix-export/catalog_products.csv` (formato de export nativo de Wix Stores),
 * filtra solo `fieldType=Product` (descarta variantes y filas vacías), normaliza
 * precio y stock, y crea documentos `product` en Sanity.
 *
 * Uso:
 *   npm run migrate:wix -- --dry-run     # listado sin escribir
 *   npm run migrate:wix                  # escribe en Sanity
 *
 * PLACEHOLDERS:
 *   - priceWholesale = pricePublic × 0.82 (regla -18% hasta que Marce confirme)
 *   - unitsPerBulk = 1 (el CSV de Wix no trae bulto; hay que enriquecer manual)
 *   - decoAvailable = true (default; algunos productos no aceptan decoración)
 */
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");
const CSV_PATH = process.env.WIX_CSV_PATH ??
  "/Users/fede/Documents/Claude/Projects/DC INC/wix-export/catalog_products.csv";

interface CsvRow {
  handleId: string;
  fieldType: string;
  name: string;
  description: string;
  productImageUrl: string;
  collection: string;
  sku: string;
  ribbon: string;
  price: string;
  inventory: string;
  visible: string;
  [key: string]: string;
}

/** El CSV trae varias URLs concatenadas con `;` — tomamos la primera.
 *  Wix exporta solo el nombre de archivo (ej `22f60f_xxx~mv2.jpg`); le prependeamos
 *  el dominio de Wix Media CDN. Si ya viene con http, se usa tal cual. */
function firstImageUrl(s: string): string | undefined {
  if (!s) return undefined;
  const first = s.split(/[;|]/)[0].trim();
  if (!first) return undefined;
  if (first.startsWith("http")) return first;
  return `https://static.wixstatic.com/media/${first}`;
}

function parseCsv(): CsvRow[] {
  const content = readFileSync(CSV_PATH, "utf-8");
  return parse(content, {
    columns: true,
    delimiter: ",",
    quote: '"',
    escape: '"',
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    bom: true,
  }) as CsvRow[];
}

function priceToNumber(s: string): number {
  if (!s) return 0;
  // Wix CSV: formato US "1234.56" o "1,234.56". A veces solo entero.
  const clean = s.replace(/[^\d.,-]/g, "");
  // Si hay coma + punto: la coma es separador de miles → quitarla
  if (clean.includes(",") && clean.includes(".")) {
    return parseFloat(clean.replace(/,/g, ""));
  }
  // Si solo hay coma: probablemente decimal → reemplazar por punto
  if (clean.includes(",") && !clean.includes(".")) {
    return parseFloat(clean.replace(",", "."));
  }
  return parseFloat(clean) || 0;
}

function inferCategory(name: string, collection: string): string {
  // Prioridad: el NOMBRE manda (la collection puede tener varios tags y confundir).
  const n = name.toLowerCase();
  // Tapas / tapones primero (sino "tapón" matchea como botella por collection).
  if (n.includes("tapa") || n.includes("tapón") || n.includes("tapon")) return "tapas";
  if (n.includes("precinto")) return "tapas";
  if (n.includes("válvula") || n.includes("valvula")) return "valvulas";
  if (n.includes("botellón") || n.includes("botellon") || n.includes("growler")) return "botellones";
  if (n.includes("botella")) return "botellas";
  if (n.includes("lata")) return "latas";
  // Cristalería: cubre copa/copón, vaso, pinta, chop(p), jarra, decantador,
  // chupito, balón, tulipa, cylinder y pilsner — la mayoría del catálogo.
  if (
    n.includes("copa") ||
    n.includes("copon") ||
    n.includes("copón") ||
    n.includes("vaso") ||
    n.includes("pinta") ||
    n.includes("chop") ||
    n.includes("jarra") ||
    n.includes("decantador") ||
    n.includes("chupito") ||
    n.includes("balon") ||
    n.includes("balón") ||
    n.includes("tulipa") ||
    n.includes("cylinder") ||
    n.includes("cilindro") ||
    n.includes("pilsner") ||
    n.includes("pilsener")
  )
    return "copas";
  if (n.includes("caja") || n.includes("estuche") || n.includes("valij")) return "cajas";
  if (n.includes("decoración") || n.includes("impresión") || n.includes("serigraf")) return "decorado";
  // Fallback a collection si el nombre no dice nada.
  const c = collection.toLowerCase();
  if (c.includes("tapa")) return "tapas";
  if (c.includes("botella")) return "botellas";
  if (c.includes("lata")) return "latas";
  if (c.includes("copa") || c.includes("vaso")) return "copas";
  return "otros";
}

function inventoryToStock(inv: string): "ok" | "low" | "out" {
  const n = parseInt(inv, 10);
  if (isNaN(n)) return "ok";
  if (n <= 0) return "out";
  if (n < 50) return "low";
  return "ok";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

async function main() {
  // Silenciar EPIPE cuando se hace `| head`
  process.stdout.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EPIPE") process.exit(0);
  });

  console.log(`[migrate] DRY_RUN=${DRY_RUN}`);
  console.log(`[migrate] leyendo ${CSV_PATH}`);
  const rows = parseCsv();
  console.log(`[migrate] ${rows.length} filas totales en el CSV`);

  // Solo productos principales (no variantes, no description-multilínea, no vacíos)
  const products = rows.filter(
    (r) => r.fieldType === "Product" && r.name && r.handleId,
  );
  console.log(`[migrate] ${products.length} productos principales (fieldType=Product)`);

  let created = 0;
  let skipped = 0;

  for (const row of products) {
    const pricePublic = priceToNumber(row.price);
    if (pricePublic <= 0) {
      skipped++;
      console.log(`[skip] ${row.handleId} → ${row.name} (precio inválido: "${row.price}")`);
      continue;
    }
    const priceWholesale = Math.round(pricePublic * 0.82);
    const sku = row.sku?.trim() || row.handleId;
    const slug = slugify(row.name);
    const category = inferCategory(row.name, row.collection);
    const stockLevel = inventoryToStock(row.inventory);

    const doc = {
      _type: "product",
      _id: `product-${row.handleId}`,
      sku,
      name: row.name.trim(),
      slug: { current: slug },
      description: row.description?.trim() || undefined,
      pricePublic,
      priceWholesale,
      unitsPerBulk: 1, // PLACEHOLDER
      deliveryTime: "24-48 hs",
      stockLevel,
      decoAvailable: true,
      badges: [] as string[],
      legacyImageUrl: firstImageUrl(row.productImageUrl),
      // referencia a la categoría. Los docs de categoría los crea `categories:fix`
      // (correr ese script al menos una vez para que `category->name` resuelva).
      category: { _type: "reference", _ref: `category-${category}` },
    };

    if (DRY_RUN) {
      console.log(
        `[DRY] ${sku} → ${doc.name.slice(0, 40)} → pub ${pricePublic} / may ${priceWholesale} / stock ${stockLevel} / cat ${category}`,
      );
    } else {
      try {
        await sanityWriteClient.createOrReplace(doc);
        created++;
        if (created % 25 === 0) {
          console.log(`[migrate] ${created}/${products.length} subidos`);
        }
      } catch (e) {
        console.error(`[error] ${sku}:`, (e as Error).message);
      }
    }
  }

  console.log(
    `[migrate] terminado. ${DRY_RUN ? products.length + " filas (dry-run)" : created + " docs creados"}, ${skipped} salteados.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
