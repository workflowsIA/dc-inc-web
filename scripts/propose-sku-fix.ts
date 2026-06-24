/**
 * Propone el CODIGO correcto para los productos de Sanity cuyo `sku` quedó basura
 * tras el import de Wix (los 113 "sin match" del sync Sheet→Sanity).
 *
 * Estrategia: cruza el `name` de cada producto sin match contra la `DESCRIPCION`
 * de la planilla de precios (`Precios Insumos`), por similitud normalizada de tokens.
 * NO escribe nada — solo genera reports/sku-fix-propuesta.csv para revisión manual.
 *
 * Uso:  npm run sku:propose
 * Después de revisar el CSV, se aplica con scripts/apply-sku-fix.ts (a crear).
 *
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON · SANITY_API_WRITE_TOKEN (mismas del sync).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { google } from "googleapis";
import { sanityWriteClient } from "../src/lib/sanity";

const SHEET_PRECIOS_ID =
  process.env.SHEET_PRECIOS_ID ?? "1rQoHe-bx5x8tBcEWgGGwyWIQi3zfUvYM5b7wYiLjdf0";
const TAB_PRECIOS = "Precios Insumos";

// ---- helpers de normalización / matching ----
function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca acentos
    .replace(/[^a-z0-9]+/g, " ") // todo lo no alfanumérico → espacio
    .trim();
}

function tokens(s: string): string[] {
  return norm(s).split(" ").filter(Boolean);
}

const STOP = new Set(["ml", "de", "para", "con", "tipo", "y"]);

/** Cobertura: qué fracción de los tokens del NOMBRE aparece en la DESCRIPCION.
 *  La descripción de la planilla es verbosa (vidrio/ambar/premium/unidad…), así que
 *  un Jaccard simétrico penaliza matches correctos. La cobertura name→desc es más justa.
 *  Los números (tamaño en ml) son discriminantes fuertes: si el nombre tiene un número
 *  y la descripción NO lo tiene, penaliza fuerte. */
function score(name: string, desc: string): number {
  const tn = tokens(name).filter((t) => !STOP.has(t));
  const td = new Set(tokens(desc));
  if (tn.length === 0 || td.size === 0) return 0;
  let inter = 0;
  for (const t of tn) if (td.has(t)) inter++;
  let cov = inter / tn.length;
  // chequeo de tamaño: números presentes en el nombre deben estar en la descripción
  const numsName = tn.filter((t) => /^\d+$/.test(t));
  if (numsName.length) {
    const allNumsMatch = numsName.every((n) => td.has(n));
    if (!allNumsMatch) cov *= 0.5;
  }
  return Math.min(1, cov);
}

function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function readPrecios(): Promise<{ codigo: string; descripcion: string }[]> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON.");
  const jsonStr = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf-8");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(jsonStr),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_PRECIOS_ID,
    range: TAB_PRECIOS,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = (res.data.values ?? []) as unknown[][];
  if (values.length < 2) return [];
  const headers = values[0].map((h) => norm(h));
  const iCod = headers.indexOf("codigo");
  const iDesc = headers.indexOf("descripcion");
  if (iCod < 0 || iDesc < 0)
    throw new Error("No encuentro columnas CODIGO/DESCRIPCION en Precios Insumos.");
  const out: { codigo: string; descripcion: string }[] = [];
  for (let r = 1; r < values.length; r++) {
    const codigo = String(values[r][iCod] ?? "").trim();
    const descripcion = String(values[r][iDesc] ?? "").trim();
    if (!codigo || !descripcion) continue;
    if (codigo.startsWith("product_")) continue; // ignorar basura
    out.push({ codigo, descripcion });
  }
  return out;
}

// Excluir del auto-match: packs (bundles, sin SKU de insumo único) y cristalería
// (Copa/Vaso/Copón no están en la planilla de precios).
function exclusion(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (n.startsWith("pack")) return "pack/bundle: no tiene SKU de insumo único (decisión de negocio)";
  if (/^(copa|vaso|copon|copón|valijin)\b/.test(n))
    return "cristalería: no está en la planilla de precios";
  return null;
}

function writeCsv(
  path: string,
  comment: string,
  cols: string[],
  rows: string[][],
) {
  const head = `# ${comment}\n# Generado: ${new Date().toISOString()} - Total: ${rows.length}\n${cols.join(",")}\n`;
  const body = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  writeFileSync(path, head + body + "\n", "utf-8");
}

async function main() {
  console.log("\n🔎 Proponiendo CODIGO para los SKUs sin match (v2: asignación golosa)\n");
  const precios = await readPrecios();
  console.log(`   Filas de precios con CODIGO+DESCRIPCION: ${precios.length}`);

  const productos: { _id: string; sku: string; name?: string }[] =
    await sanityWriteClient.fetch(
      `*[_type == "product" && defined(sku) && sku match "product_*"]{ _id, sku, name }`,
    );
  console.log(`   Productos sin match (sku basura): ${productos.length}`);

  // todo el catálogo (para detectar duplicados contra productos ya corregidos)
  const catalogo: { _id: string; name?: string; sku: string }[] =
    await sanityWriteClient.fetch(
      `*[_type == "product" && defined(sku)]{ _id, name, sku }`,
    );
  // códigos YA en uso por productos correctos → la asignación golosa no debe reusarlos.
  const usados = catalogo
    .filter((p) => !p.sku.startsWith("product_"))
    .map((p) => p.sku);
  // nombres que ya tienen una versión "buena" (con código real)
  const nombresBuenos = new Set(
    catalogo
      .filter((p) => !p.sku.startsWith("product_") && p.name)
      .map((p) => norm(p.name!)),
  );
  console.log(`   Códigos ya en uso (no reasignar): ${usados.length}\n`);

  // 1) candidatos rankeados por producto (score >= 0.4)
  type Cand = { codigo: string; desc: string; s: number; comp: number };
  type Prod = { _id: string; name: string; cands: Cand[]; excl: string | null };
  const prods: Prod[] = productos.map((p) => {
    const name = p.name ?? "";
    const cands: Cand[] = [];
    for (const c of precios) {
      const s = score(name, c.descripcion);
      if (s < 0.4) continue;
      const unidad = /unidad/i.test(c.descripcion) ? 0.03 : 0;
      const comp = s + unidad - tokens(c.descripcion).length * 0.0005;
      cands.push({ codigo: c.codigo, desc: c.descripcion, s, comp });
    }
    cands.sort((a, b) => b.comp - a.comp);
    return { _id: p._id, name, cands, excl: exclusion(name) };
  });

  // 2) detectar duplicados → borrar perdedores. Dos casos:
  //    (a) ya existe una versión "buena" (con código real) del mismo nombre
  //    (b) dos product_* con el mismo nombre dentro de este lote (queda uno)
  const eliminar: string[][] = [];
  const dupLosers = new Set<string>();
  const byName = new Map<string, Prod[]>();
  for (const p of prods) {
    if (p.excl) continue;
    if (nombresBuenos.has(norm(p.name))) {
      dupLosers.add(p._id);
      eliminar.push([p._id, p.name, "duplicado de producto ya corregido (mismo nombre)"]);
      continue;
    }
    const k = norm(p.name);
    (byName.get(k) ?? byName.set(k, []).get(k)!).push(p);
  }
  for (const [, grp] of byName) {
    if (grp.length < 2) continue;
    for (const loser of grp.slice(1)) {
      dupLosers.add(loser._id);
      eliminar.push([loser._id, loser.name, `duplicado de ${grp[0]._id}`]);
    }
  }

  // 3) asignación golosa: pares (producto, candidato) por score desc; cada código a un solo producto
  // Solo asignar automáticamente matches confiables (s >= 0.7). Por debajo, el
  // riesgo de pegar un código equivocado (lata→caja, precinto de otro tamaño) es alto.
  const MIN_ASSIGN = 0.7;
  const pairs: { p: Prod; c: Cand }[] = [];
  for (const p of prods) {
    if (p.excl || dupLosers.has(p._id)) continue;
    for (const c of p.cands) if (c.s >= MIN_ASSIGN) pairs.push({ p, c });
  }
  pairs.sort((a, b) => b.c.comp - a.c.comp);

  const takenCode = new Set<string>(usados);
  const assigned = new Map<string, Cand>();
  for (const { p, c } of pairs) {
    if (assigned.has(p._id)) continue;
    if (takenCode.has(c.codigo)) continue;
    assigned.set(p._id, c);
    takenCode.add(c.codigo);
  }

  // 4) armar las tres salidas
  const aplicar: string[][] = [];
  const revisar: string[][] = [];
  for (const p of prods) {
    if (dupLosers.has(p._id)) continue;
    if (p.excl) {
      revisar.push([p.name, "", p.excl, p._id]);
      continue;
    }
    const a = assigned.get(p._id);
    if (a) {
      aplicar.push([p._id, a.codigo, p.name, String(Math.round(a.s * 100) / 100)]);
    } else {
      const motivo = p.cands.length
        ? "todos sus códigos ya fueron tomados por otro producto (revisar a mano)"
        : "sin match en la planilla";
      revisar.push([p.name, p.cands[0]?.codigo ?? "", motivo, p._id]);
    }
  }
  aplicar.sort((a, b) => Number(b[3]) - Number(a[3]));

  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  writeCsv(
    join(dir, "sku-fix-aplicar.csv"),
    "SKUs a corregir (códigos únicos, sin colisión). Aplica con: npm run sku:apply",
    ["_id", "sku_nuevo", "name", "score"],
    aplicar,
  );
  writeCsv(
    join(dir, "sku-fix-eliminar.csv"),
    "Productos DUPLICADOS en Sanity (mismo nombre). Borra con: npm run sku:dedup",
    ["_id", "name", "motivo"],
    eliminar,
  );
  writeCsv(
    join(dir, "sku-fix-revisar.csv"),
    "Sin resolución automática (packs, cristalería, sin código libre). Necesitan decisión/Marce.",
    ["name", "codigo_sugerido", "motivo", "_id"],
    revisar,
  );

  console.log(`   ✅ Aplicar (SKU único):   ${aplicar.length}`);
  console.log(`   🗑️  Eliminar (duplicados): ${eliminar.length}`);
  console.log(`   ⏳ Revisar (packs/etc.):  ${revisar.length}`);
  console.log(`\n   📄 reports/sku-fix-{aplicar,eliminar,revisar}.csv\n`);
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
