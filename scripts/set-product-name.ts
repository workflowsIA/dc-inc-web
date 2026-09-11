/**
 * Renombra un producto (y, si se pide, su dirección web).
 *
 * Existe porque el sync NO toca `name` ni `slug`: la planilla manda precios,
 * stock y medidas, pero los nombres quedaron congelados desde la migración de
 * Wix. Si Marce corrige un nombre en la planilla, la web nunca se entera.
 *
 * El caso que lo disparó (Marce, 11-sep-2026): la planilla distingue
 * "Copa Cata Normalizada Importada 215 ml" (ARCN0215) de "…Nacional…"
 * (PRCN0215), pero en la web los dos se llamaban igual Y compartían el mismo
 * slug, así que la tarjeta del listado de uno abría la ficha del otro.
 *
 * OJO CON EL SLUG: cambiarlo rompe la dirección que ya está indexada en Google
 * y cualquier redirect de Wix que apunte ahí (ver src/data/product-redirects.ts
 * y `npm run fichas:audit`). Por eso el slug SOLO se toca si se pasa --slug.
 * Lo habitual es renombrar y dejar la dirección como está.
 *
 * Toca el documento publicado y su borrador, si existe.
 *
 * Uso:
 *   npm run producto:nombre -- --sku=ARCN0215 --nombre="Copa Cata Normalizada Importada 215 ml" --slug=copa-cata-normalizada-importada-215-ml
 *   npm run producto:nombre -- --sku=PRCN0215 --nombre="Copa Cata Normalizada Nacional 215 ml"
 *   ...agregando --dry-run para ver qué haría sin escribir.
 *
 * Env: SANITY_API_WRITE_TOKEN.
 */
import { sanityWriteClient } from "../src/lib/sanity";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

/** Misma normalización que usa Sanity para sugerir slugs. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

async function main() {
  const sku = arg("sku");
  const nombre = arg("nombre");
  const slug = arg("slug");
  const dryRun = process.argv.includes("--dry-run");
  if (!sku || !nombre) {
    console.error(
      'Uso: npm run producto:nombre -- --sku=SKU --nombre="Nombre nuevo" [--slug=direccion-nueva] [--dry-run]',
    );
    process.exit(1);
  }
  if (slug && slug !== slugify(slug)) {
    console.error(`El slug "${slug}" no es válido. Probá con "${slugify(slug)}".`);
    process.exit(1);
  }

  const docs = await sanityWriteClient.fetch<{ _id: string; name?: string; slug?: string }[]>(
    `*[_type == "product" && sku == $sku]{ _id, name, "slug": slug.current }`,
    { sku },
    { perspective: "raw" },
  );
  if (docs.length === 0) {
    console.error(`No hay ningún producto con SKU ${sku}.`);
    process.exit(1);
  }

  // Un slug repetido deja un producto sin dirección propia: el que pierde no se
  // puede abrir. Se avisa antes de crear el problema.
  if (slug) {
    const choque = await sanityWriteClient.fetch<{ sku?: string }[]>(
      `*[_type == "product" && slug.current == $slug && sku != $sku]{ sku }`,
      { slug, sku },
      { perspective: "raw" },
    );
    if (choque.length > 0) {
      console.error(
        `El slug "${slug}" ya lo usa ${choque.map((c) => c.sku).join(", ")}. Elegí otro.`,
      );
      process.exit(1);
    }
  }

  console.log(`\n✏️  ${sku}`);
  for (const d of docs) {
    console.log(`   ${d._id}`);
    console.log(`   nombre:  ${d.name ?? "(vacío)"}  →  ${nombre}`);
    console.log(`   dirección: ${d.slug ?? "(vacía)"}  →  ${slug ?? "(sin cambios)"}`);
  }
  if (dryRun) {
    console.log("\n   --dry-run: no se modificó nada.\n");
    return;
  }

  const tx = sanityWriteClient.transaction();
  for (const d of docs) {
    tx.patch(d._id, (p) =>
      p.set({ name: nombre, ...(slug ? { slug: { _type: "slug", current: slug } } : {}) }),
    );
  }
  await tx.commit();
  console.log(`   ✅ actualizado en ${docs.length} documento(s).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
