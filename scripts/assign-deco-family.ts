/**
 * Carga inicial del campo `decoFamily` (tarifa de decorado que aplica) en los
 * productos publicados, inferido de categoría + capacidad en ml del nombre.
 * Ver inferDecoFamily() en src/lib/deco.ts. Solo completa los que están vacíos;
 * lo que Marce corrija a mano en el Studio no se pisa.
 *
 * Por defecto SOLO LISTA. Con --apply escribe.
 *
 * Uso (Mac, .env.local con SANITY_API_WRITE_TOKEN):
 *   npm run deco:assign             # lista
 *   npm run deco:assign -- --apply  # escribe
 */
import { sanityWriteClient } from "../src/lib/sanity";
import { inferDecoFamily, DECO_FAMILY_LABEL } from "../src/lib/deco";

const APPLY = process.argv.includes("--apply");

interface Row {
  _id: string;
  sku?: string;
  name?: string;
  category?: string;
  decoAvailable?: boolean;
  decoFamily?: string;
}

async function main() {
  const rows = await sanityWriteClient.fetch<Row[]>(
    `*[_type == "product" && !(_id in path("drafts.**"))]{ _id, sku, name, "category": category->name, decoAvailable, decoFamily } | order(category asc, name asc)`,
  );
  const tx = sanityWriteClient.transaction();
  let set = 0;
  const byFamily: Record<string, number> = {};
  const skipped: string[] = [];
  for (const r of rows) {
    if (r.decoFamily) {
      byFamily[r.decoFamily] = (byFamily[r.decoFamily] ?? 0) + 1;
      continue;
    }
    if (r.decoAvailable === false) continue;
    const fam = inferDecoFamily({ category: r.category, name: r.name });
    if (!fam) {
      skipped.push(`${(r.sku ?? "").padEnd(16)} ${r.category ?? "—"} · ${r.name ?? ""}`);
      continue;
    }
    byFamily[fam] = (byFamily[fam] ?? 0) + 1;
    set++;
    console.log(`   ${(r.sku ?? "").padEnd(16)} ${(r.name ?? "").slice(0, 44).padEnd(46)} → ${DECO_FAMILY_LABEL[fam]}`);
    if (APPLY) tx.patch(r._id, (p) => p.set({ decoFamily: fam }));
  }
  console.log(`\n🎨 decoFamily: ${set} productos ${APPLY ? "actualizados" : "a completar (--apply para escribir)"}`);
  for (const [k, n] of Object.entries(byFamily)) console.log(`   ${k.padEnd(16)} ${n}`);
  if (skipped.length) {
    console.log(`\n   Sin tarifa de decorado en la ficha (${skipped.length}: latas, tapas, cajas, packs, sin ml en el nombre…). Si alguno debería tenerla, elegirla en el Studio → Decoración y destacados:`);
    for (const s of skipped.slice(0, 40)) console.log(`   ${s}`);
    if (skipped.length > 40) console.log(`   … y ${skipped.length - 40} más`);
  }
  if (APPLY && set > 0) await tx.commit();
  console.log("");
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
