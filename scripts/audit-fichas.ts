/**
 * Auditoría de FICHAS de producto: qué le falta a cada producto para estar
 * publicable, y qué quedó cruzado entre productos distintos.
 *
 * Sale de los comentarios de Marce del 10-sep-2026: productos sin foto que
 * además no tienen descripción, títulos que terminan en "- Unidad", combos y
 * botellas que "no aparecen", y el buscador de Google mostrando una botella
 * con la foto de otra.
 *
 * SOLO LEE. No borra ni modifica nada en Sanity. Mira drafts y publicados.
 *
 * OJO con dos cosas que ya me mordieron acá:
 *  - el documento `category` guarda el nombre en `name`, NO en `title`: pedir
 *    `category->title` devuelve null para TODOS y parece que nadie tiene
 *    categoría.
 *  - desde apiVersion v2025-02-19 el perspective por defecto del cliente es
 *    "published", así que una query normal NO ve los borradores y este script
 *    reportaría "0 borradores" aunque haya decenas. Por eso el fetch va con
 *    perspective "raw" (mismo truco que find-sku-suffix-dupes.ts).
 *
 * Salida:
 *   - Consola: resumen por bloque.
 *   - reports/fichas-pendientes.csv → una fila por producto con lo que le
 *     falta, para pasarle la lista a Marce y que la complete en el Studio.
 *
 * Uso: npm run fichas:audit
 * Env: SANITY_API_WRITE_TOKEN (para poder ver los borradores).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sanityWriteClient } from "../src/lib/sanity";
import { productRedirects } from "../src/data/product-redirects";

interface Row {
  _id: string;
  sku?: string;
  name?: string;
  slug?: string;
  categoria?: string;
  description?: string;
  nImg?: number;
  imgFile?: string;
  pricePublic?: number;
  wholesaleOnly?: boolean;
}

const QUERY = `*[_type == "product"]{
  _id, sku, name, "slug": slug.current, "categoria": category->name,
  description, "nImg": count(images), "imgFile": images[0].asset->originalFilename,
  pricePublic, wholesaleOnly
}`;

/** El id publicado de un doc, para juntar draft + published del MISMO producto. */
function baseId(id: string): string {
  return id.replace(/^drafts\./, "");
}

function esBorrador(id: string): boolean {
  return id.startsWith("drafts.");
}

/** Título con formato crudo de la planilla: "750 ml - BORDOLESA … - Unidad". */
function tituloCrudo(name?: string): boolean {
  return /\s-\s*unidad\s*$/i.test(name ?? "");
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  // perspective "raw" = cada documento tal cual está, borradores incluidos.
  const rows = await sanityWriteClient.fetch<Row[]>(QUERY, {}, { perspective: "raw" });

  // Un producto lógico = su id publicado. Si existe el draft, gana el draft
  // (es lo último que se editó).
  const porId = new Map<string, Row>();
  const tieneDraft = new Set<string>();
  for (const r of rows) {
    const id = baseId(r._id);
    if (esBorrador(r._id)) tieneDraft.add(id);
    const prev = porId.get(id);
    if (!prev || esBorrador(r._id)) porId.set(id, r);
  }
  const productos = [...porId.entries()].map(([id, r]) => ({ ...r, _id: id }));
  const publicados = productos.filter((p) => rows.some((r) => r._id === p._id));
  const soloDraft = productos.filter((p) => !rows.some((r) => r._id === p._id));

  const sinFoto = productos.filter((p) => !p.nImg);
  const sinDesc = productos.filter((p) => (p.description ?? "").trim().length < 10);
  const sinCategoria = productos.filter((p) => !p.categoria);
  const crudos = productos.filter((p) => tituloCrudo(p.name));

  // SKU repetido entre productos DISTINTOS → el catálogo resuelve por SKU y
  // uno pisa al otro (precio, stock y reprecio del checkout).
  const porSku = new Map<string, typeof productos>();
  for (const p of productos) {
    if (!p.sku) continue;
    const l = porSku.get(p.sku) ?? [];
    l.push(p);
    porSku.set(p.sku, l);
  }
  const skuDup = [...porSku.entries()].filter(([, v]) => v.length > 1);

  // Mismo slug en dos productos: uno de los dos es inalcanzable por URL.
  const porSlug = new Map<string, typeof productos>();
  for (const p of productos) {
    if (!p.slug) continue;
    const l = porSlug.get(p.slug) ?? [];
    l.push(p);
    porSlug.set(p.slug, l);
  }
  const slugDup = [...porSlug.entries()].filter(([, v]) => v.length > 1);

  // Misma foto en productos distintos. A veces es legítimo (variantes de color
  // de un mismo tapón), a veces es la foto cruzada que reportó Marce.
  const porImg = new Map<string, typeof productos>();
  for (const p of productos) {
    if (!p.imgFile) continue;
    const l = porImg.get(p.imgFile) ?? [];
    l.push(p);
    porImg.set(p.imgFile, l);
  }
  const imgDup = [...porImg.entries()].filter(([, v]) => v.length > 1);

  const line = (t: string) => console.log(t);
  line("\n📋 AUDITORÍA DE FICHAS\n");
  line(`   Productos totales:        ${productos.length}`);
  line(`   Publicados:               ${publicados.length}`);
  line(`   Solo borrador:            ${soloDraft.length}   ← no se ven en la web`);
  line("");
  line(`   Sin foto:                 ${sinFoto.length}`);
  line(`   Sin descripción:          ${sinDesc.length}`);
  line(`   Sin categoría:            ${sinCategoria.length}`);
  line(`   Título crudo ("- Unidad"): ${crudos.length}`);
  line("");
  line(`   SKU repetido:             ${skuDup.length} caso(s)   ← uno pisa al otro`);
  for (const [sku, v] of skuDup) line(`      ${sku}: ${v.map((p) => p.name).join("  ||  ")}`);
  line(`   Slug repetido:            ${slugDup.length} caso(s)   ← uno queda sin URL`);
  for (const [slug, v] of slugDup) line(`      ${slug}: ${v.map((p) => p.sku).join("  ||  ")}`);
  line(`   Misma foto en 2+ fichas:  ${imgDup.length} grupo(s), ${imgDup.reduce((a, [, v]) => a + v.length, 0)} productos`);
  for (const [, v] of imgDup.slice(0, 15)) {
    line(`      ${v.map((p) => `${p.sku} ${p.name}`).join("  ||  ")}`);
  }

  // REDIRECTS DE WIX: cada destino tiene que existir como slug publicado. Si no,
  // el que llega desde Google cae en un 404 — y peor que el catch-all, porque la
  // regla específica le gana. Se rompen solos cada vez que un producto cambia de
  // slug o se despublica, así que se revisan acá.
  const slugsPublicados = new Set(
    rows.filter((r) => !esBorrador(r._id)).map((r) => r.slug).filter(Boolean) as string[],
  );
  const redirectsRotos = productRedirects.filter((r) => !slugsPublicados.has(r.new));
  line("");
  line(`   Redirects de Wix rotos:   ${redirectsRotos.length} de ${productRedirects.length}   ← caen en 404`);
  for (const r of redirectsRotos) line(`      /product-page/${r.old}  →  /productos/${r.new}  (no existe)`);

  const faltantes = productos
    .map((p) => {
      const falta: string[] = [];
      if (!rows.some((r) => r._id === p._id)) falta.push("publicar");
      if (!p.nImg) falta.push("foto");
      if ((p.description ?? "").trim().length < 10) falta.push("descripcion");
      if (!p.categoria) falta.push("categoria");
      if (tituloCrudo(p.name)) falta.push("titulo");
      if (p.sku && (porSku.get(p.sku)?.length ?? 0) > 1) falta.push("sku-repetido");
      if (p.slug && (porSlug.get(p.slug)?.length ?? 0) > 1) falta.push("slug-repetido");
      return { p, falta };
    })
    .filter((x) => x.falta.length > 0)
    .sort((a, b) => b.falta.length - a.falta.length || (a.p.sku ?? "").localeCompare(b.p.sku ?? ""));

  const csv = [
    "sku,nombre,slug,categoria,solo_borrador,falta",
    ...faltantes.map(({ p, falta }) =>
      [
        csvCell(p.sku),
        csvCell(p.name),
        csvCell(p.slug),
        csvCell(p.categoria),
        tieneDraft.has(p._id) && !rows.some((r) => r._id === p._id) ? "si" : "no",
        csvCell(falta.join(" + ")),
      ].join(","),
    ),
  ].join("\n");

  mkdirSync(join(process.cwd(), "reports"), { recursive: true });
  const out = join(process.cwd(), "reports", "fichas-pendientes.csv");
  writeFileSync(out, csv, "utf8");
  line(`\n📄 ${faltantes.length} fichas con algo pendiente → ${out}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
