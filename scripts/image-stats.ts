/**
 * Imprime un resumen de en qué estado están las imágenes de los productos.
 *
 * Uso:
 *   npm run stats:images           # resumen + lista de los que faltan
 *   npm run stats:images -- short  # solo el resumen
 */
import { sanityWriteClient } from "../src/lib/sanity";

const SHORT = process.argv.includes("short");

async function main() {
  const query = `{
    "total": count(*[_type == "product"]),
    "withSanity": count(*[_type == "product" && defined(images[0])]),
    "withWixOnly": count(*[_type == "product" && !defined(images[0]) && defined(legacyImageUrl)]),
    "withNothing": count(*[_type == "product" && !defined(images[0]) && !defined(legacyImageUrl)]),
    "missing": *[_type == "product" && !defined(images[0])][0...20]{sku, name, "hasWix": defined(legacyImageUrl)}
  }`;
  const r = await sanityWriteClient.fetch(query);
  console.log("\n=== Imágenes de productos ===");
  console.log(`Total productos:        ${r.total}`);
  console.log(`Con imagen en Sanity:   ${r.withSanity}  (${((r.withSanity / r.total) * 100).toFixed(1)}%)`);
  console.log(`Solo con URL Wix:       ${r.withWixOnly}`);
  console.log(`Sin nada:               ${r.withNothing}`);

  if (!SHORT && (r.withWixOnly > 0 || r.withNothing > 0)) {
    console.log(`\nPrimeros 20 sin imagen Sanity:`);
    for (const p of r.missing) {
      const src = p.hasWix ? "→ Wix" : "→ NADA";
      console.log(`  ${p.sku.padEnd(20)} ${src.padEnd(8)} ${p.name?.slice(0, 60) ?? ""}`);
    }
    console.log(
      `\nPara migrar los que faltan: npm run migrate:images`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
