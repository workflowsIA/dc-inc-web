/**
 * Exporta el catálogo de Sanity al formato Meta Catalog spec (CSV).
 *
 * Spec mínima requerida por Meta:
 *  id, title, description, availability, condition, price, link, image_link, brand
 *
 * Extras útiles para WhatsApp Business:
 *  item_group_id, additional_image_link, google_product_category, custom_label_0
 *
 * Output: wix-export/meta-catalog.csv
 *
 * Uso:
 *   npm run export:meta
 */

import { sanityClient } from "../src/lib/sanity";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC_SITE = "https://dc-inc-web-v3.vercel.app";
const BRAND = "DC Inc";

type Row = {
  _id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  pricePublic: number;
  priceWholesale?: number;
  stockLevel?: "ok" | "low" | "out";
  unitsPerBulk?: number;
  category?: string;
  subtype?: string;
  imageAsset?: string;
  legacyImageUrl?: string;
  extraImages?: string[];
};

const QUERY = `*[_type == "product"]{
  _id, sku, name, "slug": slug.current, description,
  pricePublic, priceWholesale, stockLevel, unitsPerBulk,
  "category": category->title,
  "subtype": subtype->title,
  "imageAsset": images[0].asset->url,
  legacyImageUrl,
  "extraImages": images[1...10].asset->url
} | order(name asc)`;

function csvEscape(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function availability(level?: string): string {
  if (level === "out") return "out of stock";
  return "in stock"; // ok / low / undefined → in stock (Meta no tiene "low")
}

function imageLink(r: Row): string {
  if (r.imageAsset) return r.imageAsset;
  if (r.legacyImageUrl) return r.legacyImageUrl;
  return "";
}

function link(r: Row): string {
  return `${PUBLIC_SITE}/producto/${r.slug}`;
}

function priceArs(n: number): string {
  // Meta espera "1234.56 ARS" (punto decimal, espacio + currency ISO)
  return `${n.toFixed(2)} ARS`;
}

async function main() {
  console.log("[export:meta] Fetching products from Sanity...");
  const rows: Row[] = await sanityClient.fetch(QUERY);
  console.log(`[export:meta] Got ${rows.length} products`);

  const skipped: { sku: string; reason: string }[] = [];
  const headers = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "link",
    "image_link",
    "additional_image_link",
    "brand",
    "item_group_id",
    "google_product_category",
    "custom_label_0",
  ];

  const lines: string[] = [headers.join(",")];

  for (const r of rows) {
    const img = imageLink(r);
    if (!img) {
      skipped.push({ sku: r.sku, reason: "no image" });
      continue;
    }
    if (!r.pricePublic || r.pricePublic <= 0) {
      skipped.push({ sku: r.sku, reason: "no price" });
      continue;
    }
    const title = r.name.slice(0, 150);
    const desc = (r.description || `${r.category || ""} ${r.subtype || ""} — ${r.name}`.trim()).slice(0, 9999);
    const extras = (r.extraImages || []).filter(Boolean).slice(0, 9).join(",");
    const row = [
      r.sku, // id
      title,
      desc,
      availability(r.stockLevel),
      "new",
      priceArs(r.pricePublic),
      link(r),
      img,
      extras,
      BRAND,
      r.sku, // item_group_id
      "",
      r.category || "",
    ].map(csvEscape).join(",");
    lines.push(row);
  }

  mkdirSync(resolve("wix-export"), { recursive: true });
  const outPath = resolve("wix-export/meta-catalog.csv");
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

  console.log(`\n✓ Wrote ${lines.length - 1} rows to ${outPath}`);
  if (skipped.length) {
    const byReason: Record<string, number> = {};
    skipped.forEach((s) => (byReason[s.reason] = (byReason[s.reason] || 0) + 1));
    console.log(`\nSkipped ${skipped.length} products:`);
    for (const [k, v] of Object.entries(byReason)) {
      console.log(`  - ${k}: ${v}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
