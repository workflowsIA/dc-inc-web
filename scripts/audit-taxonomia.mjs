/**
 * CENSO DE TAXONOMÍA — SOLO LEE. No escribe nada en Sanity.
 *
 * Contesta: qué categorías y qué subtipos existen HOY (Marce los estuvo
 * tocando), cuántos productos cuelga de cada uno, qué quedó huérfano y qué
 * valores son casi-duplicados entre sí (Espumante / Espumantes).
 *
 * Mira borradores Y publicados (perspective=raw, mismo truco que
 * audit-fichas.ts: con el perspective por defecto los drafts no se ven).
 *
 * Uso:  node --env-file=.env.local scripts/audit-taxonomia.mjs
 * Salida: consola + reports/taxonomia-actual.csv
 */
import { writeFileSync, mkdirSync } from "node:fs";

const pid = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const ds = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const ver = (process.env.SANITY_API_VERSION || "2025-02-19").replace(/^v/, "");
const tok = process.env.SANITY_API_WRITE_TOKEN;

if (!pid) {
  console.error("Falta NEXT_PUBLIC_SANITY_PROJECT_ID en .env.local");
  process.exit(1);
}
if (!tok) {
  console.warn("AVISO: sin SANITY_API_WRITE_TOKEN no se ven los borradores.\n");
}

async function q(groq) {
  const url =
    "https://" + pid + ".api.sanity.io/v" + ver + "/data/query/" + ds +
    "?perspective=raw&query=" + encodeURIComponent(groq);
  const res = await fetch(url, tok ? { headers: { Authorization: "Bearer " + tok } } : undefined);
  if (!res.ok) throw new Error(res.status + " " + (await res.text()).slice(0, 300));
  return (await res.json()).result;
}

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
const dedupeKey = (s) => norm(s).replace(/s\b/g, "");

const [cats, subs, prodsRaw] = await Promise.all([
  q('*[_type=="category"]{_id,name,"slug":slug.current,order,showOnHome,"tieneFoto":defined(image)}'),
  q('*[_type=="subtype"]{_id,name,scope}'),
  q('*[_type=="product"]{_id,sku,name,"cat":category->name,"subs":array::compact(coalesce(subtypes[]->name,[subtype->name]))}'),
]);

// una fila por SKU: gana el borrador si existe
const byBase = new Map();
for (const p of prodsRaw) {
  const base = p._id.replace(/^drafts\./, "");
  const isDraft = p._id.startsWith("drafts.");
  const prev = byBase.get(base);
  if (!prev || (isDraft && !prev.isDraft)) byBase.set(base, { ...p, isDraft });
}
const prods = [...byBase.values()];

const catCount = new Map();
const catDraft = new Map();
const subCount = new Map();
const subInCats = new Map();
const sinCat = [];

for (const p of prods) {
  if (p.cat) {
    catCount.set(p.cat, (catCount.get(p.cat) || 0) + 1);
    if (p.isDraft) catDraft.set(p.cat, (catDraft.get(p.cat) || 0) + 1);
  } else sinCat.push(p.sku || p._id);
  for (const s of p.subs || []) {
    subCount.set(s, (subCount.get(s) || 0) + 1);
    if (!subInCats.has(s)) subInCats.set(s, new Map());
    const m = subInCats.get(s);
    const c = p.cat || "(sin categoría)";
    m.set(c, (m.get(c) || 0) + 1);
  }
}

const line = (t) => console.log("\n" + t + "\n" + "-".repeat(t.length));

console.log("Productos (1 fila por SKU, gana el borrador): " + prods.length +
  "  |  borradores: " + prods.filter((p) => p.isDraft).length);

line("CATEGORÍAS EN SANITY (" + cats.length + ")");
for (const c of [...cats].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))) {
  const n = catCount.get(c.name) || 0;
  console.log(
    String(n).padStart(4) + " prod  " + (c.name || "(sin nombre)").padEnd(24) +
    " slug=" + (c.slug || "—").padEnd(22) +
    " orden=" + String(c.order ?? "—").padEnd(4) +
    " home=" + (c.showOnHome === undefined ? "sin definir" : c.showOnHome ? "sí" : "no") +
    (n === 0 ? "   <-- VACÍA" : "")
  );
}
const catsUsadasSinDoc = [...catCount.keys()].filter((n) => !cats.some((c) => c.name === n));
if (catsUsadasSinDoc.length) console.log("\nOJO, categorías referenciadas que no matchean ningún doc: " + catsUsadasSinDoc.join(", "));

line("SUBTIPOS EN SANITY (" + subs.length + ")");
for (const s of [...subs].sort((a, b) => (subCount.get(b.name) || 0) - (subCount.get(a.name) || 0))) {
  const n = subCount.get(s.name) || 0;
  const en = subInCats.get(s.name);
  const donde = en ? [...en.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => c + "(" + k + ")").join(", ") : "";
  console.log(
    String(n).padStart(4) + " prod  " + (s.name || "(sin nombre)").padEnd(26) +
    " scope=" + (s.scope || "—").padEnd(10) + (n === 0 ? "  <-- SIN USO" : "  " + donde)
  );
}

line("PRODUCTOS SIN CATEGORÍA: " + sinCat.length);
if (sinCat.length) console.log(sinCat.slice(0, 20).join(", ") + (sinCat.length > 20 ? " … (+" + (sinCat.length - 20) + ")" : ""));

line("POSIBLES DUPLICADOS DE SUBTIPO");
const grupos = new Map();
for (const s of subs) {
  const k = dedupeKey(s.name);
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(s.name);
}
let dup = 0;
for (const [, nombres] of grupos) {
  if (nombres.length > 1) {
    dup++;
    console.log("  " + nombres.map((n) => n + " (" + (subCount.get(n) || 0) + ")").join("  ==  "));
  }
}
if (!dup) console.log("  ninguno por normalización directa.");

mkdirSync("reports", { recursive: true });
const csv = [["Tipo", "Nombre", "Scope/Slug", "Productos", "Aparece en"].join(",")];
const cell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
for (const c of cats) csv.push([cell("Categoría"), cell(c.name), cell(c.slug), cell(catCount.get(c.name) || 0), cell("")].join(","));
for (const s of subs) {
  const en = subInCats.get(s.name);
  const donde = en ? [...en.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => c + " (" + k + ")").join(" | ") : "";
  csv.push([cell("Subtipo"), cell(s.name), cell(s.scope), cell(subCount.get(s.name) || 0), cell(donde)].join(","));
}
writeFileSync("reports/taxonomia-actual.csv", csv.join("\r\n"), "utf8");
console.log("\nEscrito: reports/taxonomia-actual.csv");
