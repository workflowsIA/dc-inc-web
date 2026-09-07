/**
 * Detecta productos DUPLICADOS en Sanity que quedaron de una carga vieja con
 * SKU con sufijo de presentación (…UN / …CA) en vez del SKU pelado que usa
 * el catálogo (ver [[dc-inc-planilla-sufijos-sku]]): mismo producto vendido
 * dos veces, con el SKU "bueno" (pelado) y una copia con "UN"/"CA" al final.
 *
 * Señal principal: mismo slug (Sanity valida slug único, por eso a Marce le
 * marcaba el campo en rojo al querer editar "Copa Belga 490 ml").
 * Señal secundaria: SKU base (sin sufijo UN/CA) existe como OTRO producto
 * con el mismo nombre normalizado.
 *
 * SOLO LEE. No borra ni modifica nada en Sanity. Junta drafts y publicados
 * de un mismo documento en un solo "producto lógico" antes de comparar
 * (para no confundir draft+published del MISMO doc con un duplicado).
 *
 * Salida:
 *   - Consola: tabla legible por cluster de duplicados.
 *   - reports/sku-suffix-dupes.csv → mismo formato que espera
 *     scripts/dedup-skus.ts (_id, name, motivo), con el/los "perdedor(es)"
 *     de cada cluster (el que se recomienda borrar). El campo `mantener_id`
 *     extra queda como referencia de cuál es el que se conserva.
 *
 * Uso:
 *   npm run sku:find-dupes
 *
 * Después de revisar el CSV con Fede/Marce, para borrar los "perdedores":
 *   cp reports/sku-suffix-dupes.csv reports/sku-fix-eliminar.csv
 *   npm run sku:dedup -- --dry-run   # confirma la lista una vez más
 *   npm run sku:dedup                # borra en Sanity
 *
 * Env: SANITY_API_WRITE_TOKEN (mismo token que sync:sheet / sku:dedup).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sanityWriteClient } from "../src/lib/sanity";

type RawProduct = {
  _id: string;
  sku?: string;
  name?: string;
  slug?: string;
  pricePublic?: number;
  priceWholesale?: number;
  stockQty?: number;
  hasImage?: boolean;
  categoryName?: string;
  _updatedAt: string;
};

type Logical = {
  id: string; // id canónico, sin "drafts."
  sku: string;
  name: string;
  slug: string;
  pricePublic?: number;
  priceWholesale?: number;
  stockQty?: number;
  hasImage: boolean;
  categoryName?: string;
  hasPublished: boolean;
  hasDraft: boolean;
  editId: string; // el _id que hay que usar para editar/borrar (prioriza draft)
  updatedAt: string;
};

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripSuffix(sku: string): { base: string; suffix: "UN" | "CA" | null } {
  if (sku.length > 3 && (sku.endsWith("UN") || sku.endsWith("CA"))) {
    return { base: sku.slice(0, -2), suffix: sku.slice(-2) as "UN" | "CA" };
  }
  return { base: sku, suffix: null };
}

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Colapsa draft+published del MISMO documento en un solo producto lógico. */
function collapse(raw: RawProduct[]): Logical[] {
  const byCanonical = new Map<string, { pub?: RawProduct; draft?: RawProduct }>();
  for (const r of raw) {
    const isDraft = r._id.startsWith("drafts.");
    const canonical = isDraft ? r._id.slice("drafts.".length) : r._id;
    const entry = byCanonical.get(canonical) ?? {};
    if (isDraft) entry.draft = r;
    else entry.pub = r;
    byCanonical.set(canonical, entry);
  }
  const out: Logical[] = [];
  for (const [canonical, { pub, draft }] of byCanonical) {
    const src = draft ?? pub!;
    out.push({
      id: canonical,
      sku: (src.sku ?? "").trim(),
      name: (src.name ?? "").trim(),
      slug: (src.slug ?? "").trim(),
      pricePublic: src.pricePublic,
      priceWholesale: src.priceWholesale,
      stockQty: src.stockQty,
      hasImage: !!src.hasImage,
      categoryName: src.categoryName,
      hasPublished: !!pub,
      hasDraft: !!draft,
      editId: draft ? `drafts.${canonical}` : canonical,
      updatedAt: src._updatedAt,
    });
  }
  return out;
}

/** Puntaje de "qué tan bueno es conservar este" — más alto = mejor candidato a quedarse. */
function keepScore(p: Logical): number {
  let s = 0;
  if (p.hasPublished) s += 10;
  if (p.hasImage) s += 5;
  if (p.categoryName) s += 3;
  if (stripSuffix(p.sku).suffix === null) s += 2; // SKU pelado > SKU con sufijo
  return s;
}

async function main() {
  console.log("\n🔎 Buscando productos duplicados (SKU pelado vs SKU+UN/CA)\n");

  const raw: RawProduct[] = await sanityWriteClient.fetch(
    `*[_type == "product" && defined(sku) && defined(name)]{
      _id, sku, name, "slug": slug.current, pricePublic, priceWholesale, stockQty,
      "hasImage": count(images) > 0, "categoryName": category->name, _updatedAt
    }`,
  );
  console.log(`   Documentos producto (draft+published): ${raw.length}`);

  const products = collapse(raw);
  console.log(`   Productos lógicos (colapsando draft/published del mismo doc): ${products.length}\n`);

  // Cluster por slug (la señal dura: Sanity exige slug único, por eso el campo
  // se pone en rojo). Además cruzamos por SKU-base para explicar el "por qué".
  const bySlug = new Map<string, Logical[]>();
  for (const p of products) {
    if (!p.slug) continue;
    (bySlug.get(p.slug) ?? bySlug.set(p.slug, []).get(p.slug)!).push(p);
  }

  // Cluster secundario: mismo nombre normalizado + uno de los SKUs es el otro + UN/CA.
  const byName = new Map<string, Logical[]>();
  for (const p of products) {
    const k = norm(p.name);
    (byName.get(k) ?? byName.set(k, []).get(k)!).push(p);
  }

  type Cluster = { key: string; reason: string; members: Logical[] };
  const clusters: Cluster[] = [];
  const seenIds = new Set<string>();

  for (const [slug, members] of bySlug) {
    if (members.length < 2) continue;
    clusters.push({ key: slug, reason: "mismo slug (URL duplicada)", members });
    members.forEach((m) => seenIds.add(m.id));
  }
  for (const [name, members] of byName) {
    if (members.length < 2) continue;
    // saltear si ya está cubierto por un cluster de slug con los mismos miembros
    const ids = members.map((m) => m.id).sort().join(",");
    const already = clusters.some((c) => c.members.map((m) => m.id).sort().join(",") === ids);
    if (already) continue;
    // solo lo reportamos si además hay relación de sufijo UN/CA entre los SKUs
    const bases = new Set(members.map((m) => stripSuffix(m.sku).base));
    if (bases.size > 1) continue; // nombres iguales pero SKUs sin relación → no lo tocamos, revisar a mano
    clusters.push({ key: name, reason: "mismo nombre + SKU base compartido (…UN/…CA)", members });
    members.forEach((m) => seenIds.add(m.id));
  }

  if (clusters.length === 0) {
    console.log("   ✅ No se encontraron duplicados por slug ni por SKU base+UN/CA.\n");
    return;
  }

  const csvRows: string[][] = [];
  let totalPerdedores = 0;

  for (const c of clusters) {
    const ranked = [...c.members].sort((a, b) => keepScore(b) - keepScore(a));
    const keep = ranked[0];
    const losers = ranked.slice(1);
    totalPerdedores += losers.length;

    console.log(`— Cluster (${c.reason}): ${c.key}`);
    for (const m of ranked) {
      const tag = m.id === keep.id ? "✅ CONSERVAR" : "🗑️  BORRAR   ";
      const pub = m.hasPublished ? "pub" : "—";
      const drf = m.hasDraft ? "draft" : "—";
      console.log(
        `   ${tag} sku=${m.sku.padEnd(14)} $${String(m.pricePublic ?? "?").padEnd(10)} ` +
          `stock=${String(m.stockQty ?? "?").padEnd(5)} foto=${m.hasImage ? "sí" : "no"} ` +
          `[${pub}/${drf}]  "${m.name}"`,
      );
    }
    console.log("");

    for (const loser of losers) {
      csvRows.push([
        loser.editId,
        loser.name,
        `duplicado de ${keep.editId} (sku ${keep.sku}) — ${c.reason}`,
      ]);
    }
  }

  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "sku-suffix-dupes.csv");
  const head =
    `# Duplicados por SKU pelado vs SKU+UN/CA (o slug repetido). Generado: ${new Date().toISOString()}\n` +
    `# Revisar con Fede/Marce ANTES de borrar. Para aplicar:\n` +
    `#   cp reports/sku-suffix-dupes.csv reports/sku-fix-eliminar.csv && npm run sku:dedup -- --dry-run\n` +
    `_id,name,motivo\n`;
  const body = csvRows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  writeFileSync(path, head + body + "\n", "utf-8");

  console.log(`   Clusters con duplicados: ${clusters.length}`);
  console.log(`   Documentos a revisar para borrar: ${totalPerdedores}`);
  console.log(`   📄 ${path}\n`);
  console.log("   (Esto NO borró nada. Es solo el diagnóstico.)\n");
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
