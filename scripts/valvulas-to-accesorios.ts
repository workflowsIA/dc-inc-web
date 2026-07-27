/**
 * Válvulas deja de ser categoría propia → pasa a ser parte de "Accesorios".
 *
 * Qué hace (idempotente, no destructivo salvo el borrado final de la categoría vacía):
 *   1. Se asegura de que exista la categoría "Accesorios" (la crea si no está).
 *   2. Reasigna todos los productos que hoy están en la categoría "Válvulas" →
 *      "Accesorios" (solo toca el campo `category`).
 *   3. Borra el documento de categoría "Válvulas" una vez que quedó sin productos.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/valvulas-to-accesorios.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/valvulas-to-accesorios.ts
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`[valvulas→accesorios] DRY_RUN=${DRY_RUN}`);

  const valvulas = await sanityWriteClient.fetch<{ _id: string } | null>(
    `*[_type == "category" && name == "Válvulas"][0]{ _id }`,
  );
  if (!valvulas) {
    console.log("No existe la categoría «Válvulas». Nada que hacer.");
    return;
  }

  // 1) Asegurar «Accesorios».
  let accesorios = await sanityWriteClient.fetch<{ _id: string } | null>(
    `*[_type == "category" && name == "Accesorios"][0]{ _id }`,
  );
  if (!accesorios) {
    const doc = {
      _id: "category-accesorios",
      _type: "category",
      name: "Accesorios",
      slug: { _type: "slug", current: "accesorios" },
      order: 7,
    };
    console.log('Falta la categoría «Accesorios» → se crea.');
    if (!DRY_RUN) accesorios = await sanityWriteClient.createIfNotExists(doc) as { _id: string };
    else accesorios = { _id: doc._id };
  }

  // 2) Reasignar productos.
  const prods = await sanityWriteClient.fetch<{ _id: string; name: string }[]>(
    `*[_type == "product" && category._ref == $vid]{ _id, name }`,
    { vid: valvulas._id },
  );
  console.log(`Productos en «Válvulas»: ${prods.length}`);
  for (const p of prods) {
    console.log(`  ${DRY_RUN ? "(dry)" : "→"} ${p.name}`);
    if (!DRY_RUN) {
      await sanityWriteClient
        .patch(p._id)
        .set({ category: { _type: "reference", _ref: accesorios._id } })
        .commit();
    }
  }

  // 3) Borrar la categoría «Válvulas» (ya sin productos).
  if (DRY_RUN) {
    console.log("(dry-run) borraría la categoría «Válvulas».");
  } else {
    const still = await sanityWriteClient.fetch<number>(
      `count(*[_type == "product" && category._ref == $vid])`,
      { vid: valvulas._id },
    );
    if (still === 0) {
      await sanityWriteClient.delete(valvulas._id);
      console.log("Categoría «Válvulas» borrada.");
    } else {
      console.log(`Ojo: «Válvulas» todavía tiene ${still} productos referenciándola — no la borro.`);
    }
  }

  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
