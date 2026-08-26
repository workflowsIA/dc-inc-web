/**
 * Migración: subtipo único (`subtype`, referencia) → subtipos múltiples
 * (`subtypes`, array de referencias). Ago-2026, pedido de Marce: un producto
 * puede tener más de un subtipo (ej. Cognac + Whisky).
 *
 * Qué hace (idempotente):
 *   - Por cada producto (publicado o borrador) que tenga `subtype` cargado y
 *     todavía no tenga `subtypes`, copia la referencia a `subtypes[0]`.
 *   - Deja `subtype` como está (oculto en el Studio, la web ya no lo usa
 *     cuando hay `subtypes`). Con --unset también lo borra.
 *
 * Uso (en la Mac, necesita SANITY_API_WRITE_TOKEN en .env.local):
 *   npx tsx --env-file=.env.local scripts/migrate-subtypes.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/migrate-subtypes.ts
 *   npx tsx --env-file=.env.local scripts/migrate-subtypes.ts --unset
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");
const UNSET = process.argv.includes("--unset");

interface Row {
  _id: string;
  sku?: string;
  name?: string;
  subtypeRef?: string;
  subtypesCount: number;
}

async function main() {
  console.log(`[migrate-subtypes] DRY_RUN=${DRY_RUN} UNSET=${UNSET}`);
  const rows = await sanityWriteClient.fetch<Row[]>(
    `*[_type == "product" && defined(subtype)]{
       _id, sku, name, "subtypeRef": subtype._ref, "subtypesCount": count(coalesce(subtypes, []))
     }`,
  );
  console.log(`Productos con el campo viejo \`subtype\`: ${rows.length}`);

  const toCopy = rows.filter((r) => r.subtypeRef && r.subtypesCount === 0);
  const already = rows.length - toCopy.length;
  console.log(`  → a copiar a \`subtypes\`: ${toCopy.length}  (ya migrados: ${already})`);

  if (!toCopy.length && !UNSET) {
    console.log("Nada que hacer.");
    return;
  }

  type P = ReturnType<typeof sanityWriteClient.patch>;
  const patches: P[] = [];
  for (const r of toCopy) {
    const patch = sanityWriteClient
      .patch(r._id)
      .set({ subtypes: [{ _type: "reference", _ref: r.subtypeRef, _key: `mig-${r.subtypeRef}` }] });
    patches.push(UNSET ? patch.unset(["subtype"]) : patch);
    console.log(`  ${r.sku ?? r._id} — ${r.name ?? ""} → subtypes[0] = ${r.subtypeRef}`);
  }
  if (UNSET) {
    // Los que ya tenían subtypes: solo limpiar el campo viejo.
    for (const r of rows.filter((r) => r.subtypesCount > 0)) {
      patches.push(sanityWriteClient.patch(r._id).unset(["subtype"]));
    }
  }
  if (DRY_RUN) {
    console.log(`\n(dry run — ${patches.length} patches NO aplicados)`);
    return;
  }
  // Commits de a 50 para no pasarse del límite de la transacción.
  for (let i = 0; i < patches.length; i += 50) {
    let tx = sanityWriteClient.transaction();
    for (const p of patches.slice(i, i + 50)) tx = tx.patch(p);
    await tx.commit();
  }
  console.log(`\n✅ Listo: ${patches.length} productos actualizados.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
