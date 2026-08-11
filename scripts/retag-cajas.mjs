// One-off: mueve los productos de cajas/bandejas/estuches a la categoría
// "Cajas y estuches" en Sanity. Idempotente. Correr desde la raíz del repo
// (lee ./.env.local). Uso:
//   node scripts/retag-cajas.mjs         -> aplica
//   node scripts/retag-cajas.mjs --dry   -> solo lista, no toca nada
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

const TARGET = 'Cajas y estuches';
const q = `*[_type=="product"]{_id, title, name, "cat": category}`;
const qurl = `https://${pid}.api.sanity.io/v${av}/data/query/${ds}?query=${encodeURIComponent(q)}`;

const res = await (await fetch(qurl, { headers: { Authorization: `Bearer ${tok}` } })).json();
if (res.error) { console.error('Error en query:', JSON.stringify(res.error)); process.exit(1); }

const re = /^(caja|bandeja|estuche)\b/i;
const boxes = (res.result || []).filter((p) => re.test((p.name || p.title || '').trim()));
const toMove = boxes.filter((b) => b.cat !== TARGET);

console.log(`Productos de cajas encontrados: ${boxes.length}  (a re-taggear: ${toMove.length})`);
for (const b of boxes) console.log(`  ${b.cat === TARGET ? 'ya-ok' : 'mover '} [${b.cat}] ${b.name || b.title}`);

if (process.argv.includes('--dry')) { console.log('DRY RUN: no se aplicó nada.'); process.exit(0); }
if (toMove.length === 0) { console.log('Nada para mover.'); process.exit(0); }

const mutations = toMove.map((b) => ({ patch: { id: b._id, set: { category: TARGET } } }));
const murl = `https://${pid}.api.sanity.io/v${av}/data/mutate/${ds}`;
const mres = await (await fetch(murl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
  body: JSON.stringify({ mutations }),
})).json();
if (mres.error) { console.error('Error en mutate:', JSON.stringify(mres.error)); process.exit(1); }
console.log(`OK: ${toMove.length} productos movidos a "${TARGET}".`);
