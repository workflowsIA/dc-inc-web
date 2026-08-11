// One-off idempotente: asegura la categoría "Cajas y estuches" y apunta los
// productos de cajas/bandejas/estuches a esa REFERENCIA (category es reference,
// no string). Correr desde la raíz del repo (lee ./.env.local).
//   node scripts/retag-cajas.mjs         -> aplica
//   node scripts/retag-cajas.mjs --dry   -> solo lista
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const pid = g('NEXT_PUBLIC_SANITY_PROJECT_ID');
const ds = g('NEXT_PUBLIC_SANITY_DATASET') || 'production';
const av = g('SANITY_API_VERSION') || '2024-01-01';
const tok = g('SANITY_API_WRITE_TOKEN');
if (!pid || !tok) { console.error('Faltan credenciales de Sanity en .env.local'); process.exit(1); }

const H = { Authorization: `Bearer ${tok}` };
const api = (p) => `https://${pid}.api.sanity.io/v${av}/data/${p}/${ds}`;
const query = async (q) => { const r = await (await fetch(api('query') + `?query=${encodeURIComponent(q)}`, { headers: H })).json(); if (r.error) throw new Error(JSON.stringify(r.error)); return r.result; };
const mutate = async (m) => { const r = await (await fetch(api('mutate'), { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ mutations: m }) })).json(); if (r.error) throw new Error(JSON.stringify(r.error)); return r; };

const TARGET = 'Cajas y estuches';
const CAT_ID = 'category-cajas-y-estuches';
const DRY = process.argv.includes('--dry');

// 1) Asegurar el documento de categoría (idempotente).
if (!DRY) {
  await mutate([{ createIfNotExists: { _id: CAT_ID, _type: 'category', name: TARGET, slug: { _type: 'slug', current: 'cajas-y-estuches' }, order: 60 } }]);
}
const cats = await query(`*[_type=="category" && name=="${TARGET}"]{_id}`);
const catId = cats[0]?._id || CAT_ID;

// 2) Productos-caja por nombre; cat = nombre de la categoría referenciada (null si está roto).
const prods = await query(`*[_type=="product"]{_id, title, name, "cat": category->name}`);
const re = /^(caja|bandeja|estuche)\b/i;
const boxes = prods.filter((p) => re.test((p.name || p.title || '').trim()));
const toFix = boxes.filter((b) => b.cat !== TARGET);

console.log(`Cajas encontradas: ${boxes.length} | a corregir: ${toFix.length} | catId: ${catId}`);
for (const b of boxes) console.log(`  ${b.cat === TARGET ? 'ok   ' : 'fix  '} [${b.cat ?? 'roto/otros'}] ${b.name || b.title}`);
if (DRY) { console.log('DRY RUN: no se aplicó nada.'); process.exit(0); }
if (toFix.length) {
  await mutate(toFix.map((b) => ({ patch: { id: b._id, set: { category: { _type: 'reference', _ref: catId } } } })));
}
console.log(`OK: ${toFix.length} productos ahora referencian "${TARGET}".`);
