/**
 * Enriquecimiento del catálogo en Sanity con datos del export de Wix.
 *
 * La migración original solo trajo nombre, precio e imagen. El CSV de Wix tiene
 * mucho más: descripción, subtipo (en las collections), unidades por bulto/pallet
 * (en las opciones de producto) y ribbons. Este script lo lee y patchea Sanity:
 *   - description: texto limpio (HTML → texto).
 *   - subtype: solo para cristalería (categoría "copas") → crea los docs de subtype.
 *   - unitsPerBulk / unitsPerPallet: parseados de las opciones / descripción.
 *   - badges: desde el ribbon de Wix (Oferta → promo, Pre venta → new).
 *
 * Es idempotente y no destructivo: solo escribe campos que pudo derivar; nunca
 * pisa con vacío. Matchea por _id (`product-<handleId>`), igual que la migración.
 *
 * Uso:
 *   npm run enrich:wix -- --dry-run    # muestra cobertura sin escribir
 *   npm run enrich:wix                 # aplica
 */
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");
const CSV_PATH =
  process.env.WIX_CSV_PATH ??
  "/Users/fede/Documents/Claude/Projects/DC INC/wix-export/catalog_products.csv";

interface CsvRow {
  handleId: string;
  fieldType: string;
  name: string;
  description: string;
  collection: string;
  ribbon: string;
  productOptionName1: string;
  productOptionDescription1: string;
  [key: string]: string;
}

/** Opciones de presentación, ej "24un en Cajas;2025un en Pallet" → array. */
function parsePresentations(name1: string, desc1: string): string[] {
  if (!desc1 || !/present/i.test(name1 || "")) return [];
  return desc1
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

// ---- categoría (para gatear el subtipo a cristalería) ----
function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("tapa") || n.includes("tapón") || n.includes("tapon")) return "tapas";
  if (n.includes("precinto")) return "tapas";
  if (n.includes("válvula") || n.includes("valvula")) return "valvulas";
  if (n.includes("botellón") || n.includes("botellon") || n.includes("growler")) return "botellones";
  if (n.includes("botella")) return "botellas";
  if (n.includes("lata")) return "latas";
  if (
    n.includes("copa") || n.includes("copon") || n.includes("copón") || n.includes("vaso") ||
    n.includes("pinta") || n.includes("chop") || n.includes("jarra") || n.includes("decantador") ||
    n.includes("chupito") || n.includes("balon") || n.includes("balón") || n.includes("tulipa") ||
    n.includes("cylinder") || n.includes("cilindro") || n.includes("pilsner") || n.includes("pilsener")
  )
    return "copas";
  if (n.includes("caja") || n.includes("estuche") || n.includes("valij")) return "cajas";
  if (n.includes("decoración") || n.includes("decoracion") || n.includes("impresión") || n.includes("serigraf"))
    return "decorado";
  return "otros";
}

// ---- subtipo (tipo de cristalería), de las collections de Wix ----
const SUBTYPE_PRIORITY: [string, string][] = [
  ["media pinta", "Media pinta"], ["pinta", "Pinta"], ["chopp", "Chopp"], ["whisky", "Whisky"],
  ["fernet", "Fernet"], ["vermut", "Vermut"], ["coctel", "Coctel"], ["margarita", "Margarita"],
  ["martini", "Martini"], ["cognac", "Cognac"], ["espumante", "Espumante"], ["shot", "Shot"],
  ["trago", "Trago"], ["vino", "Vino"], ["macerado", "Macerado"], ["degustacion", "Degustación"],
  ["postre", "Postre"], ["destilado", "Destilado"], ["cerveza", "Cerveza"],
  ["carbonatada", "Carbonatada"], ["gaseosa", "Gaseosa"], ["agua", "Agua"],
  ["jarra", "Jarra"], ["decantador", "Decantador"],
];
function inferSubtype(collection: string): string | null {
  const tags = (collection || "").toLowerCase();
  for (const [k, v] of SUBTYPE_PRIORITY) if (tags.includes(k)) return v;
  return null;
}
const subtypeId = (name: string) =>
  "subtype-" + name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

// ---- unidades por bulto / pallet ----
function toInt(s: string): number {
  const m = String(s).replace(/\./g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}
function parseUnits(opt: string, desc: string): { bulto: number; pallet: number } {
  const hay = `${opt || ""} ; ${(desc || "").replace(/<[^>]+>/g, " ")}`;
  let bulto = 0, pallet = 0, m: RegExpMatchArray | null;
  if ((m = hay.match(/(\d[\d.]*)\s*un(?:idades)?\s*en\s*1?\s*pallet/i))) pallet = toInt(m[1]);
  if (!pallet && (m = hay.match(/cantidad\s*pallet\s*(\d[\d.]*)/i))) pallet = toInt(m[1]);
  if ((m = hay.match(/(\d[\d.]*)\s*un(?:idades)?\s*en\s*(?:1\s*)?cajas?/i))) bulto = toInt(m[1]);
  if (!bulto && (m = hay.match(/caja[^:]*:?\s*(\d[\d.]*)\s*unidades/i))) bulto = toInt(m[1]);
  if (!bulto && (m = hay.match(/(\d[\d.]*)\s*unidades\s*en\s*cajas/i))) bulto = toInt(m[1]);
  return { bulto, pallet };
}

// ---- HTML → texto limpio ----
function cleanHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\s*(li)[^>]*>/gi, "• ")
    .replace(/<\s*\/(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é").replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó").replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    .trim()
    .slice(0, 1200);
}

function ribbonToBadges(ribbon: string): string[] {
  const r = (ribbon || "").toLowerCase();
  if (r.includes("oferta")) return ["promo"];
  if (r.includes("pre venta") || r.includes("preventa")) return ["new"];
  return [];
}

async function main() {
  console.log(`[enrich:wix] DRY_RUN=${DRY_RUN}`);
  const rows: CsvRow[] = parse(readFileSync(CSV_PATH), {
    bom: true, // el CSV de Wix trae BOM → sin esto la 1ª columna (handleId) queda inaccesible
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
  const byId = new Map<string, CsvRow>();
  for (const r of rows) {
    if (r.fieldType === "Product" && r.name && r.handleId) {
      byId.set(`product-${r.handleId}`, r);
    }
  }
  console.log(`[enrich:wix] ${byId.size} productos en el CSV`);

  const sanityProducts: { _id: string; name: string }[] = await sanityWriteClient.fetch(
    `*[_type == "product"]{ _id, name }`,
  );
  console.log(`[enrich:wix] ${sanityProducts.length} productos en Sanity`);

  const usedSubtypes = new Map<string, string>(); // id -> name
  const cov = { desc: 0, sub: 0, bulto: 0, pallet: 0, badges: 0, nomatch: 0 };
  const patches: { id: string; set: Record<string, unknown> }[] = [];

  for (const p of sanityProducts) {
    const row = byId.get(p._id);
    if (!row) {
      cov.nomatch++;
      continue;
    }
    const set: Record<string, unknown> = {};

    const desc = cleanHtml(row.description);
    if (desc) {
      set.description = desc;
      cov.desc++;
    }

    if (inferCategory(row.name) === "copas") {
      const sub = inferSubtype(row.collection);
      if (sub) {
        const id = subtypeId(sub);
        usedSubtypes.set(id, sub);
        set.subtype = { _type: "reference", _ref: id };
        cov.sub++;
      }
    }

    const { bulto, pallet } = parseUnits(row.productOptionDescription1, row.description);

    // Presentaciones: primero el campo estructurado de Wix; si está vacío,
    // las derivamos del bulto/pallet parseado de la descripción.
    let presentations = parsePresentations(row.productOptionName1, row.productOptionDescription1);
    if (presentations.length === 0) {
      const derived: string[] = [];
      if (bulto > 1) derived.push(`Caja de ${bulto} u`);
      if (pallet > 0) derived.push(`Pallet de ${pallet} u`);
      presentations = derived;
    }
    if (presentations.length) set.presentations = presentations;

    if (bulto > 1) {
      set.unitsPerBulk = bulto;
      cov.bulto++;
    }
    if (pallet > 0) {
      set.unitsPerPallet = pallet;
      cov.pallet++;
    }

    const badges = ribbonToBadges(row.ribbon);
    if (badges.length) {
      set.badges = badges;
      cov.badges++;
    }

    if (Object.keys(set).length) patches.push({ id: p._id, set });
  }

  console.log("[enrich:wix] cobertura:", cov);
  console.log(`[enrich:wix] subtipos a crear: ${usedSubtypes.size} → ${[...usedSubtypes.values()].join(", ")}`);

  if (DRY_RUN) {
    console.log("[enrich:wix] dry-run — no se escribió nada.");
    return;
  }

  // crear docs de subtype (cristalería)
  for (const [id, name] of usedSubtypes) {
    await sanityWriteClient.createOrReplace({ _type: "subtype", _id: id, name, scope: "glass" });
  }
  console.log(`[enrich:wix] ${usedSubtypes.size} subtipos creados/actualizados`);

  // patchear productos en lotes
  let done = 0;
  let tx = sanityWriteClient.transaction();
  for (const { id, set } of patches) {
    tx = tx.patch(id, (patch) => patch.set(set));
    done++;
    if (done % 100 === 0) {
      await tx.commit();
      tx = sanityWriteClient.transaction();
      console.log(`[enrich:wix] ${done}/${patches.length} productos enriquecidos`);
    }
  }
  await tx.commit();
  console.log(`[enrich:wix] terminado. ${done} productos enriquecidos.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
