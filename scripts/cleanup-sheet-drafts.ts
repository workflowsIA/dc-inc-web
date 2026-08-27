/**
 * Limpieza de BORRADORES viejos creados por la sincronización de la planilla
 * ("Nuevos desde la planilla", _id `drafts.product-sheet-*`) que quedaron
 * obsoletos después del fix de sufijos (26-ago-2026):
 *
 *   - tarifas y despachos (DBZ…, DBC11…, DEPX…): no son productos;
 *   - packs con "1" final (BARRIPACK1…) cuyo producto real existe sin el 1;
 *   - cristalería con sufijo UN / CA (NAJT0340UN) cuyo producto existe pelado;
 *   - cualquier draft cuyo alias (ver baseAliases) coincide con un producto
 *     publicado.
 *
 * También reporta SKUs DUPLICADOS entre productos publicados (ej. TR28P) para
 * resolver a mano en el Studio.
 *
 * Por defecto SOLO LISTA. Con --delete borra los borradores marcados.
 *
 * Uso (Mac, .env.local con SANITY_API_WRITE_TOKEN):
 *   npm run drafts:cleanup             # lista
 *   npm run drafts:cleanup -- --delete # borra
 */
import { sanityWriteClient } from "../src/lib/sanity";
import { baseAliases, isTariffSku } from "../src/lib/sheet-presentations";

const DELETE = process.argv.includes("--delete");

interface Row {
  _id: string;
  sku?: string;
  name?: string;
  fromSheet?: boolean;
}

async function main() {
  const all = await sanityWriteClient.fetch<Row[]>(
    `*[_type == "product" && defined(sku)]{ _id, sku, name, fromSheet }`,
  );
  const published = all.filter((r) => !r._id.startsWith("drafts."));
  const drafts = all.filter((r) => r._id.startsWith("drafts.product-sheet-"));
  const pubSkus = new Set(published.map((r) => r.sku as string));

  const toDelete: { row: Row; why: string }[] = [];
  for (const d of drafts) {
    const sku = (d.sku ?? "").trim();
    if (!sku) continue;
    if (isTariffSku(sku)) {
      toDelete.push({ row: d, why: "tarifa/despacho, no es producto" });
      continue;
    }
    if (pubSkus.has(sku)) {
      toDelete.push({ row: d, why: "ya existe publicado con ese SKU" });
      continue;
    }
    const alias = baseAliases(sku).find((a) => pubSkus.has(a));
    if (alias) {
      toDelete.push({ row: d, why: `es el mismo producto que ${alias} (publicado)` });
      continue;
    }
    if (/CA$/.test(sku) && (pubSkus.has(sku.slice(0, -2)) || drafts.some((x) => x.sku === sku.slice(0, -2) + "UN"))) {
      toDelete.push({ row: d, why: `fila caja de cristalería de ${sku.slice(0, -2)}` });
    }
  }

  console.log(`\n🧹 Borradores desde la planilla: ${drafts.length} · a borrar: ${toDelete.length}${DELETE ? "" : " (solo lista; --delete para borrar)"}\n`);
  for (const t of toDelete) console.log(`   ${(t.row.sku ?? "").padEnd(18)} ${(t.row.name ?? "").slice(0, 50).padEnd(52)} ← ${t.why}`);
  const keep = drafts.filter((d) => !toDelete.some((t) => t.row._id === d._id));
  if (keep.length) {
    console.log(`\n   Quedan ${keep.length} borradores legítimos (productos nuevos de la planilla sin publicar):`);
    for (const k of keep) console.log(`   ${(k.sku ?? "").padEnd(18)} ${k.name ?? ""}`);
  }

  // SKUs duplicados entre publicados
  const bySku = new Map<string, Row[]>();
  for (const p of published) {
    const l = bySku.get(p.sku as string) ?? [];
    l.push(p);
    bySku.set(p.sku as string, l);
  }
  const dups = [...bySku.entries()].filter(([, l]) => l.length > 1);
  if (dups.length) {
    console.log(`\n⚠️  SKU duplicado en productos publicados (${dups.length}) — resolver a mano en el Studio (dejar uno, o cambiar el SKU del otro):`);
    for (const [sku, l] of dups) for (const p of l) console.log(`   ${sku.padEnd(14)} ${p._id.padEnd(40)} ${p.name ?? ""}`);
  }

  if (DELETE && toDelete.length) {
    const tx = sanityWriteClient.transaction();
    for (const t of toDelete) tx.delete(t.row._id);
    await tx.commit();
    console.log(`\n✅ Borrados ${toDelete.length} borradores.`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
