/**
 * Carga masiva de productos a Sanity desde un CSV.
 *
 * Pensado para altas en lote (ej: lista de precios de cristalería, productos
 * nuevos de un proveedor). Crea los productos como BORRADORES: no aparecen en
 * la web hasta completarles foto/categoría y publicarlos desde el Studio
 * (bandeja: Catálogo → Productos → "Nuevos desde la planilla").
 *
 * Columnas reconocidas (por nombre de header, sin distinguir mayúsculas/acentos;
 * alias entre paréntesis):
 *   sku (codigo)                        → sku          [obligatoria]
 *   nombre (descripcion)                → name         [obligatoria]
 *   precio (precio unitario)            → pricePublic  [obligatoria]
 *   precio mayorista (precio sin iva)   → priceWholesale
 *   unidades por bulto (uxb, unidad por bulto) → unitsPerBulk
 *   stock (stock venta)                 → stockQty
 *   stock minimo (minimos stock)        → stockMin
 *   categoria                           → referencia a category (match por nombre)
 *   descripcion larga (detalle)         → description
 *
 * Uso:
 *   npm run csv:import -- ruta/al/archivo.csv             # dry-run: muestra qué haría
 *   npm run csv:import -- ruta/al/archivo.csv --apply     # crea los borradores
 *   npm run csv:import -- ruta/al/archivo.csv --apply --publish  # publica directo (solo si viene completo)
 *
 * Reglas:
 *   - SKU ya existente en Sanity → se saltea (no pisa nada). Se informa al final.
 *   - Sin --publish todo entra como draft (recomendado).
 *
 * Env: SANITY_API_WRITE_TOKEN (ya está en .env.local).
 */
import { readFileSync } from "node:fs";
import { sanityWriteClient } from "../src/lib/sanity";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const APPLY = process.argv.includes("--apply");
const PUBLISH = process.argv.includes("--publish");

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  };
  const headers = parseLine(lines[0]).map(norm);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}

function pick(row: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) {
    const v = row[norm(a)];
    if (v) return v;
  }
  return "";
}

function toNum(v: string): number | null {
  if (!v) return null;
  const s = v.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function slugify(name: string): string {
  return norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

async function main() {
  const file = args[0];
  if (!file) {
    console.error("Uso: npm run csv:import -- archivo.csv [--apply] [--publish]");
    process.exit(1);
  }
  const rows = parseCsv(readFileSync(file, "utf-8"));
  if (rows.length === 0) {
    console.error("CSV vacío o sin filas de datos.");
    process.exit(1);
  }

  // Estado actual en Sanity: SKUs existentes (incl. drafts) y categorías por nombre.
  const [existing, categories] = await Promise.all([
    sanityWriteClient.fetch<{ sku: string }[]>(`*[_type == "product" && defined(sku)]{ sku }`),
    sanityWriteClient.fetch<{ _id: string; name: string }[]>(`*[_type == "category"]{ _id, name }`),
  ]);
  const knownSkus = new Set(existing.map((p) => p.sku));
  const catByName = new Map(categories.map((c) => [norm(c.name), c._id]));

  let created = 0;
  const skippedExisting: string[] = [];
  const skippedInvalid: string[] = [];

  for (const row of rows) {
    const sku = pick(row, ["sku", "codigo"]);
    const name = pick(row, ["nombre", "descripcion"]);
    const pricePublic = toNum(pick(row, ["precio", "precio unitario", "precio publico"]));
    if (!sku || !name || pricePublic === null) {
      skippedInvalid.push(sku || name || JSON.stringify(row).slice(0, 60));
      continue;
    }
    if (knownSkus.has(sku)) {
      skippedExisting.push(sku);
      continue;
    }
    const priceWholesale = toNum(pick(row, ["precio mayorista", "precio sin iva"]));
    const unitsPerBulk = toNum(pick(row, ["unidades por bulto", "unidad por bulto", "uxb"]));
    const stockQty = toNum(pick(row, ["stock", "stock venta"]));
    const stockMin = toNum(pick(row, ["stock minimo", "minimos stock"]));
    const catName = pick(row, ["categoria"]);
    const catId = catName ? catByName.get(norm(catName)) : undefined;
    const description = pick(row, ["descripcion larga", "detalle"]);

    const idSafe = sku.replace(/[^A-Za-z0-9._-]/g, "-");
    const doc = {
      _id: `${PUBLISH ? "" : "drafts."}product-csv-${idSafe}`,
      _type: "product",
      sku,
      name,
      slug: { _type: "slug", current: slugify(name) || idSafe.toLowerCase() },
      pricePublic,
      ...(priceWholesale !== null ? { priceWholesale } : {}),
      ...(unitsPerBulk !== null ? { unitsPerBulk } : {}),
      ...(stockQty !== null
        ? { stockQty, stockLevel: stockQty <= 0 ? "out" : stockMin !== null && stockQty <= stockMin ? "low" : "ok" }
        : {}),
      ...(stockMin !== null ? { stockMin } : {}),
      ...(catId ? { category: { _type: "reference", _ref: catId } } : {}),
      ...(description ? { description } : {}),
      fromSheet: true, // cae en la bandeja "Nuevos desde la planilla" del Studio
    };

    created++;
    if (APPLY) {
      await sanityWriteClient.createIfNotExists(doc);
      console.log(`✓ ${PUBLISH ? "publicado" : "borrador"}: ${sku} — ${name}`);
    } else {
      console.log(`(dry-run) crearía ${PUBLISH ? "publicado" : "borrador"}: ${sku} — ${name}${catId ? ` [cat: ${catName}]` : catName ? ` [⚠ categoría "${catName}" no existe]` : ""}`);
    }
  }

  console.log("\n— Resumen —");
  console.log(`Filas leídas: ${rows.length}`);
  console.log(`${APPLY ? "Creados" : "A crear"}: ${created}`);
  if (skippedExisting.length) console.log(`Salteados (SKU ya existe): ${skippedExisting.length} → ${skippedExisting.join(", ")}`);
  if (skippedInvalid.length) console.log(`Salteados (faltan sku/nombre/precio): ${skippedInvalid.length} → ${skippedInvalid.join(", ")}`);
  if (!APPLY) console.log("\nDry-run. Para aplicar de verdad: agregá --apply");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
