/**
 * Migración del catálogo Wix (feed.tsv + catalog_products.csv) → Sanity.
 *
 * Uso (desde la raíz del repo, con .env.local configurado):
 *   npm run migrate:wix -- --dry-run     # listado sin escribir
 *   npm run migrate:wix                  # escribe en Sanity
 *
 * Asume:
 *  - El feed Wix está en /Users/fede/Documents/Claude/Projects/DC INC/wix-export/feed.tsv
 *  - Las categorías existen ya en Sanity (corré primero el seed de categorías)
 */
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");
const FEED_PATH = process.env.WIX_FEED_PATH ??
  "/Users/fede/Documents/Claude/Projects/DC INC/wix-export/feed.tsv";

interface FeedRow {
  id: string;
  title: string;
  description: string;
  link: string;
  image_link: string;
  availability: string;
  price: string;
  product_type: string;
  brand: string;
  [key: string]: string;
}

function parseFeed(): FeedRow[] {
  const content = readFileSync(FEED_PATH, "utf-8");
  return parse(content, {
    columns: true,
    delimiter: "\t",
    relax_quotes: true,
    skip_empty_lines: true,
  });
}

function priceToNumber(priceStr: string): number {
  const m = priceStr.match(/[\d.,]+/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/\./g, "").replace(",", "."));
}

function inferCategory(productType: string): string {
  const lc = productType.toLowerCase();
  if (lc.includes("botell")) return "botellas";
  if (lc.includes("lata")) return "latas";
  if (lc.includes("copa") || lc.includes("vaso") || lc.includes("pinta")) return "copas";
  if (lc.includes("caja") || lc.includes("estuche")) return "cajas";
  if (lc.includes("tapa")) return "tapas";
  return "otros";
}

async function main() {
  console.log(`[migrate] DRY_RUN=${DRY_RUN}`);
  console.log(`[migrate] reading feed from ${FEED_PATH}`);
  const rows = parseFeed();
  console.log(`[migrate] ${rows.length} filas en el feed`);

  let created = 0;
  for (const row of rows) {
    const pricePublic = priceToNumber(row.price);
    // PLACEHOLDER: regla de precio mayorista hasta que Marce confirme — pongo -18%
    const priceWholesale = Math.round(pricePublic * 0.82);
    const slug = row.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const doc = {
      _type: "product",
      _id: `product-${row.id}`,
      sku: row.id,
      name: row.title,
      slug: { current: slug },
      description: row.description,
      pricePublic,
      priceWholesale,
      unitsPerBulk: 1, // PLACEHOLDER — el feed Wix no trae bulto, hay que enriquecer manual
      deliveryTime: "24-48 hs",
      stockLevel: row.availability === "in stock" ? "ok" : "low",
      decoAvailable: true,
      badges: [],
    };

    if (DRY_RUN) {
      console.log(`[DRY] ${doc.sku} → ${doc.name} → ${pricePublic} / ${priceWholesale}`);
    } else {
      await sanityWriteClient.createOrReplace(doc);
      created++;
      if (created % 25 === 0) console.log(`[migrate] ${created}/${rows.length} cargados`);
    }
  }

  console.log(`[migrate] terminado. ${DRY_RUN ? rows.length + " filas (dry-run)" : created + " docs creados/actualizados"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
