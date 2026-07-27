/**
 * Fix de categorías del catálogo en Sanity.
 *
 * La migración original nunca escribió la referencia `category` en los productos
 * (el `_categoryHint` se descartaba), así que todos quedaron sin categoría y la
 * web los muestra como "Otros". Este script:
 *   1. Infiere la categoría de cada producto por su nombre.
 *   2. Crea/actualiza los documentos `category` necesarios.
 *   3. Setea la referencia `category` en cada `product` (solo ese campo).
 *
 * Es idempotente y no destructivo (no toca precios, badges, imágenes, etc.).
 *
 * Uso:
 *   npm run categories:fix -- --dry-run   # muestra el plan sin escribir
 *   npm run categories:fix                # aplica los cambios
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");

const CATS: Record<string, { name: string; order: number }> = {
  botellas: { name: "Botellas", order: 1 },
  latas: { name: "Latas", order: 2 },
  copas: { name: "Copas y vasos", order: 3 },
  botellones: { name: "Botellones", order: 4 },
  cajas: { name: "Cajas y estuches", order: 5 },
  tapas: { name: "Tapas y precintos", order: 6 },
  // Válvulas NO es categoría propia: es una subcategoría dentro de Accesorios.
  accesorios: { name: "Accesorios", order: 7 },
  decorado: { name: "Decorado", order: 8 },
  otros: { name: "Otros", order: 99 },
};

/** Misma lógica que la migración: el NOMBRE manda. */
function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("tapa") || n.includes("tapón") || n.includes("tapon")) return "tapas";
  if (n.includes("precinto")) return "tapas";
  if (n.includes("válvula") || n.includes("valvula")) return "accesorios";
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
  if (n.includes("decoración") || n.includes("decoracion") || n.includes("impresión") || n.includes("serigraf"))
    return "decorado";
  return "otros";
}

interface ProductRow {
  _id: string;
  name: string;
}

async function main() {
  console.log(`[categories:fix] DRY_RUN=${DRY_RUN}`);

  const products: ProductRow[] = await sanityWriteClient.fetch(
    `*[_type == "product"]{ _id, name }`,
  );
  console.log(`[categories:fix] ${products.length} productos en Sanity`);

  // Contar por categoría y armar el plan
  const counts: Record<string, number> = {};
  const plan = products.map((p) => {
    const slug = inferCategory(p.name);
    counts[slug] = (counts[slug] ?? 0) + 1;
    return { ...p, slug };
  });

  const usedSlugs = Object.keys(counts);
  console.log("[categories:fix] distribución:");
  for (const s of usedSlugs.sort((a, b) => (CATS[a]?.order ?? 99) - (CATS[b]?.order ?? 99))) {
    console.log(`   ${CATS[s]?.name ?? s}: ${counts[s]}`);
  }

  if (DRY_RUN) {
    console.log("[categories:fix] dry-run — no se escribió nada.");
    return;
  }

  // 1. Crear/actualizar los docs de categoría usados
  for (const slug of usedSlugs) {
    const meta = CATS[slug] ?? { name: slug, order: 50 };
    await sanityWriteClient.createOrReplace({
      _type: "category",
      _id: `category-${slug}`,
      name: meta.name,
      slug: { _type: "slug", current: slug },
      order: meta.order,
    });
  }
  console.log(`[categories:fix] ${usedSlugs.length} categorías creadas/actualizadas`);

  // 2. Setear la referencia en cada producto (en lotes)
  let patched = 0;
  let tx = sanityWriteClient.transaction();
  for (const p of plan) {
    tx = tx.patch(p._id, (patch) =>
      patch.set({ category: { _type: "reference", _ref: `category-${p.slug}` } }),
    );
    patched++;
    if (patched % 100 === 0) {
      await tx.commit();
      tx = sanityWriteClient.transaction();
      console.log(`[categories:fix] ${patched}/${plan.length} productos actualizados`);
    }
  }
  await tx.commit();
  console.log(`[categories:fix] terminado. ${patched} productos con categoría asignada.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
