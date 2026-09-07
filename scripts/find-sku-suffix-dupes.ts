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
 * Solo se recomienda auto-borrar cuando el cluster tiene EXACTAMENTE un SKU
 * pelado y todos los demás son ese SKU + UN/CA. Si dos SKUs sin relación de
 * sufijo comparten slug/nombre (colisión de datos, no este bug), el cluster
 * se manda a "revisar a mano" en vez de arriesgar borrar el producto real.
 *
 * Salida:
 *   - Consola: tabla legible por cluster, marcado CONFIRMADO o REVISAR A MANO.
 *   - reports/sku-suffix-dupes-confirmados.csv → mismo formato que espera
 *     scripts/dedup-skus.ts (_id, name, motivo). Solo los casos seguros.
 *   - reports/sku-suffix-dupes-revisar.csv → clusters ambiguos, con TODOS
 *     los miembros listados (no se borra nada solo, hay que elegir a mano).
 *
 * Uso:
 *   npm run sku:find-dupes
 *
 * Después de revisar el CSV confirmados con Fede/Marce, para borrar:
 *   cp reports/sku-suffix-dupes-confirmados.csv reports/sku-fix-eliminar.csv
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

  // perspective:"raw" fuerza que devuelva CADA documento tal cual está en el
  // dataset (drafts.xxx y xxx como filas separadas). Sin esto, el cliente
  // puede resolver un solo documento "visible" por identidad y esconder los
  // borradores que nunca se publicaron — que son justo los que buscamos.
  const raw: RawProduct[] = await sanityWriteClient.fetch(
    `*[_type == "product" && defined(sku) && defined(name)]{
      _id, sku, name, "slug": slug.current, pricePublic, priceWholesale, stockQty,
      "hasImage": count(images) > 0, "categoryName": category->name, _updatedAt
    }`,
    {},
    { perspective: "raw" },
  );
  console.log(`   Documentos producto (draft+published, perspective raw): ${raw.length}`);
  const draftCount = raw.filter((r) => r._id.startsWith("drafts.")).length;
  console.log(`   … de los cuales borradores (drafts.*): ${draftCount}`);

  if (process.env.DEBUG_NAME) {
    const needle = norm(process.env.DEBUG_NAME);
    const hits = raw.filter((r) => norm(r.name).includes(needle));
    console.log(`\n   🐛 DEBUG_NAME="${process.env.DEBUG_NAME}" → ${hits.length} filas crudas:`);
    for (const h of hits) {
      console.log(`      ${h._id.padEnd(45)} sku=${h.sku ?? "?"}  "${h.name}"`);
    }
    console.log("");
  }

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

  // Clasificación: SOLO se recomienda auto-borrar cuando hay un único miembro
  // con SKU pelado (sin sufijo) y TODOS los demás son ese mismo SKU + UN/CA.
  // Si dos miembros del cluster tienen SKU pelado (sin relación de sufijo
  // entre sí) es una colisión de slug entre productos DISTINTOS — no se toca
  // automático, va a "revisar".
  function classify(members: Logical[]): { keep: Logical; losers: Logical[] } | null {
    const bare = members.filter((m) => stripSuffix(m.sku).suffix === null);
    if (bare.length !== 1) return null;
    const keep = bare[0];
    const losers = members.filter((m) => m.id !== keep.id);
    const allAreSuffixOfKeep = losers.every((m) => stripSuffix(m.sku).base === keep.sku);
    if (!allAreSuffixOfKeep) return null;
    return { keep, losers };
  }

  const confirmedRows: string[][] = [];
  const revisarRows: string[][] = [];
  let totalConfirmados = 0;
  let totalRevisar = 0;

  for (const c of clusters) {
    const resolved = classify(c.members);
    const ranked = resolved
      ? [resolved.keep, ...resolved.losers]
      : [...c.members].sort((a, b) => keepScore(b) - keepScore(a));
    const keep = resolved ? resolved.keep : null;

    console.log(`— Cluster (${c.reason}) [${resolved ? "✔ CONFIRMADO" : "⚠️  REVISAR A MANO"}]: ${c.key}`);
    for (const m of ranked) {
      const tag = !resolved ? "❓ ???      " : m.id === keep!.id ? "✅ CONSERVAR" : "🗑️  BORRAR   ";
      const pub = m.hasPublished ? "pub" : "—";
      const drf = m.hasDraft ? "draft" : "—";
      console.log(
        `   ${tag} sku=${m.sku.padEnd(14)} $${String(m.pricePublic ?? "?").padEnd(10)} ` +
          `stock=${String(m.stockQty ?? "?").padEnd(5)} foto=${m.hasImage ? "sí" : "no"} ` +
          `[${pub}/${drf}]  "${m.name}"`,
      );
    }
    console.log("");

    if (resolved) {
      totalConfirmados += resolved.losers.length;
      for (const loser of resolved.losers) {
        confirmedRows.push([
          loser.editId,
          loser.name,
          `duplicado de ${resolved.keep.editId} (sku ${resolved.keep.sku}) — ${c.reason}`,
        ]);
      }
    } else {
      totalRevisar++;
      for (const m of c.members) {
        revisarRows.push([
          m.editId,
          m.name,
          `${c.reason} — slug/nombre compartido entre SKUs sin relación de sufijo, elegir a mano cuál conservar`,
        ]);
      }
    }
  }

  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });

  const confirmedPath = join(dir, "sku-suffix-dupes-confirmados.csv");
  const confirmedHead =
    `# Duplicados CONFIRMADOS (SKU pelado + su copia SKU+UN/CA, mismo producto). Generado: ${new Date().toISOString()}\n` +
    `# Para aplicar:\n` +
    `#   cp reports/sku-suffix-dupes-confirmados.csv reports/sku-fix-eliminar.csv && npm run sku:dedup -- --dry-run\n` +
    `_id,name,motivo\n`;
  writeFileSync(
    confirmedPath,
    confirmedHead + confirmedRows.map((r) => r.map(escapeCsv).join(",")).join("\n") + "\n",
    "utf-8",
  );

  const revisarPath = join(dir, "sku-suffix-dupes-revisar.csv");
  const revisarHead =
    `# Colisiones de slug/nombre entre SKUs SIN relación de sufijo UN/CA — decidir a mano cuál conservar.\n` +
    `# Generado: ${new Date().toISOString()}\n` +
    `_id,name,motivo\n`;
  writeFileSync(
    revisarPath,
    revisarHead + revisarRows.map((r) => r.map(escapeCsv).join(",")).join("\n") + "\n",
    "utf-8",
  );

  console.log(`   Clusters confirmados (auto): ${clusters.length - totalRevisar}  → ${totalConfirmados} documentos a borrar`);
  console.log(`   Clusters a revisar a mano:   ${totalRevisar}`);
  console.log(`   📄 ${confirmedPath}`);
  console.log(`   📄 ${revisarPath}\n`);
  console.log("   (Esto NO borró nada. Es solo el diagnóstico.)\n");
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
