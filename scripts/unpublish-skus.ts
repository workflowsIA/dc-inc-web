/**
 * Despublica productos por SKU: salen del sitio pero NO se pierden — el
 * documento queda como BORRADOR en el Studio, con todo su contenido, listo para
 * volver a publicar de un clic cuando se resuelva lo que lo dejó afuera.
 *
 * Caso que lo motivó (10-sep-2026): 5 productos de cristalería quedaron
 * publicados con precio $0 y comprables. Su fila en la planilla tiene precio 0
 * y el sync viejo lo escribía a Sanity tal cual; el fix del 9-sep hizo que el
 * sync deje de tocarlos, así que se quedan en 0 hasta que se cargue el precio.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/unpublish-skus.ts SKU1 SKU2 --dry-run
 *   npx tsx --env-file=.env.local scripts/unpublish-skus.ts SKU1 SKU2
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");
const skus = process.argv.slice(2).filter((a) => !a.startsWith("--"));

interface Doc {
  _id: string;
  _rev?: string;
  _createdAt?: string;
  _updatedAt?: string;
  sku?: string;
  name?: string;
  pricePublic?: number;
  [k: string]: unknown;
}

async function main() {
  if (!skus.length) {
    console.error("Uso: unpublish-skus.ts <SKU...> [--dry-run]");
    process.exit(1);
  }

  const docs = await sanityWriteClient.fetch<Doc[]>(
    `*[_type == "product" && sku in $skus && !(_id in path("drafts.**"))]`,
    { skus },
  );

  console.log(`\n📤 Despublicar${DRY_RUN ? " (DRY RUN)" : ""} — pedidos: ${skus.length}\n`);

  const found = new Set<string>();
  for (const d of docs) {
    found.add(String(d.sku ?? ""));
    const draftId = `drafts.${d._id}`;
    console.log(
      `   ${String(d.sku).padEnd(14)} ${String(d.name ?? "").slice(0, 42).padEnd(44)} $${d.pricePublic ?? "—"}`,
    );
    if (DRY_RUN) continue;
    // Despublicar en Sanity = mover el documento a su borrador y borrar el
    // publicado. Se sacan los campos de sistema: `create` los rechaza.
    const { _id: _drop, _rev: _r, _createdAt: _c, _updatedAt: _u, ...rest } = d;
    await sanityWriteClient.createIfNotExists({ ...rest, _id: draftId } as Doc & { _type: string });
    await sanityWriteClient.delete(d._id);
  }

  const missing = skus.filter((s) => !found.has(s));
  if (missing.length) {
    console.log(`\n⚠️  Sin producto publicado con ese SKU: ${missing.join(", ")}`);
  }

  console.log(
    DRY_RUN
      ? `\n(DRY RUN — no se tocó nada. Quitá --dry-run para aplicar.)\n`
      : `\n✅ Despublicados: ${docs.length}. Quedan como borrador en el Studio → Catálogo → Productos.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
