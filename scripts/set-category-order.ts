/**
 * Orden de las categorías en la web (filtro del catálogo, panel).
 * Pedido de Marce (ago-2026):
 *   1 Botellas · 2 Latas · 3 Copas y vasos · 4 Botellones · 5 Cajas y estuches
 *   6 Accesorios · después Tapas y precintos, Decorado y Otros.
 *
 * Solo escribe el campo `order` de cada categoría (por nombre). Idempotente.
 * Marce también puede cambiar estos números a mano en Catálogo → Categorías.
 *
 * Uso (en la Mac, necesita SANITY_API_WRITE_TOKEN en .env.local):
 *   npx tsx --env-file=.env.local scripts/set-category-order.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/set-category-order.ts
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");

const ORDER: Record<string, number> = {
  Botellas: 1,
  Latas: 2,
  "Copas y vasos": 3,
  Botellones: 4,
  "Cajas y estuches": 5,
  Accesorios: 6,
  "Tapas y precintos": 7,
  Decorado: 8,
  Otros: 99,
};

async function main() {
  console.log(`[set-category-order] DRY_RUN=${DRY_RUN}`);
  const cats = await sanityWriteClient.fetch<{ _id: string; name: string; order?: number }[]>(
    `*[_type == "category"]{ _id, name, order }`,
  );
  let tx = sanityWriteClient.transaction();
  let n = 0;
  for (const c of cats) {
    const want = ORDER[c.name];
    if (want === undefined) {
      console.log(`  (sin regla) ${c.name} — orden actual ${c.order ?? "—"}; queda como está`);
      continue;
    }
    if (c.order === want) {
      console.log(`  = ${c.name}: ${want}`);
      continue;
    }
    console.log(`  → ${c.name}: ${c.order ?? "—"} → ${want}`);
    tx = tx.patch(sanityWriteClient.patch(c._id).set({ order: want }));
    n++;
  }
  if (!n) {
    console.log("Todo en orden, nada que cambiar.");
    return;
  }
  if (DRY_RUN) {
    console.log(`\n(dry run — ${n} cambios NO aplicados)`);
    return;
  }
  await tx.commit();
  console.log(`\n✅ ${n} categorías actualizadas. La web lo toma en ≤5 min (revalidate).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
