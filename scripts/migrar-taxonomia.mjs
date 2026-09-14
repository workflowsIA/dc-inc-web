/**
 * MIGRACIÓN DE TAXONOMÍA — categoría → grupo de filtro → subcategoría.
 *
 * Qué hace, en orden:
 *   1. Crea los grupos de filtro (Bebida, Modelo, Tipo de pieza).
 *   2. A cada subcategoría le asigna su grupo y las categorías donde se ofrece.
 *   3. Fusiona los pares que son el mismo concepto cargado dos veces porque
 *      antes una subcategoría no podía vivir en dos categorías:
 *        Aguas y refrescos → Agua y refrescos
 *        Espumantes        → Espumante
 *        Destilados        → Destilados y licores
 *   4. Parte los valores compuestos en sus partes:
 *        Cerveza y sidra → Cerveza + Sidra   (Sidra se crea)
 *        Vinos y vermut  → Vino + Vermut
 *   5. Deja el slug de cada categoría igual a la dirección que tiene HOY en la
 *      web, y guarda las direcciones anteriores para redirigirlas.
 *   6. Borra lo que quedó sin uso (subcategoría "Trago", categoría "Otros"),
 *      siempre y cuando de verdad no lo use ningún producto.
 *
 * Es idempotente: correrlo dos veces no cambia nada la segunda vez.
 * Por defecto NO escribe: muestra lo que haría. Para aplicar, pasar --apply.
 *
 *   node --env-file=.env.local scripts/migrar-taxonomia.mjs
 *   node --env-file=.env.local scripts/migrar-taxonomia.mjs --apply
 *
 * Toca documentos de categoría y subcategoría, y de los productos SOLO el campo
 * de subcategorías (y únicamente en los que apuntaban a un valor fusionado o
 * compuesto). Ni precio, ni stock, ni fotos, ni descripciones.
 */

const APPLY = process.argv.includes("--apply");

const pid = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const ds = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const ver = (process.env.SANITY_API_VERSION || "2025-02-19").replace(/^v/, "");
const tok = process.env.SANITY_API_WRITE_TOKEN;

if (!pid || !tok) {
  console.error("Faltan NEXT_PUBLIC_SANITY_PROJECT_ID o SANITY_API_WRITE_TOKEN en .env.local");
  process.exit(1);
}

const base = "https://" + pid + ".api.sanity.io/v" + ver + "/data";
const auth = { Authorization: "Bearer " + tok };

async function query(groq, params = {}) {
  const qs = new URLSearchParams({ query: groq, perspective: "raw" });
  for (const [k, v] of Object.entries(params)) qs.set("$" + k, JSON.stringify(v));
  const res = await fetch(base + "/query/" + ds + "?" + qs.toString(), { headers: auth });
  if (!res.ok) throw new Error("query " + res.status + " " + (await res.text()).slice(0, 300));
  return (await res.json()).result;
}

async function mutate(mutations) {
  if (!mutations.length) return;
  for (let i = 0; i < mutations.length; i += 50) {
    const lote = mutations.slice(i, i + 50);
    const res = await fetch(base + "/mutate/" + ds + "?returnIds=false", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: lote }),
    });
    if (!res.ok) throw new Error("mutate " + res.status + " " + (await res.text()).slice(0, 500));
  }
}

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Mismo slug que usa la web hoy para armar /categoria/<slug> (src/lib/slug.ts).
 *  Lo replicamos acá para que el slug guardado quede EXACTAMENTE igual a la
 *  dirección actual y no se rompa ningún link al pasar a rutear por slug. */
const catSlug = (name) =>
  (name || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const key = () => Math.random().toString(36).slice(2, 12);

/* ------------------------------------------------------------------ *
 * EL MAPA. Es lo único que hay que tocar si Marce cambia de opinión.
 * ------------------------------------------------------------------ */

const GRUPOS = [
  { slug: "bebida", name: "Bebida", order: 1 },
  { slug: "modelo", name: "Modelo", order: 2 },
  { slug: "tipo-de-pieza", name: "Tipo de pieza", order: 3 },
];

const COPAS = "Copas y vasos";
const BOTELLAS = "Botellas";
const BOTELLONES = "Botellones";
const CAJAS = "Cajas y estuches";
const TAPAS = "Tapas y tapones";

/** subcategoría → { grupo, categorías donde se ofrece } */
const MAPA = {
  // --- Bebida ---
  "Cerveza": { grupo: "bebida", cats: [COPAS, BOTELLAS, BOTELLONES] },
  "Agua y refrescos": { grupo: "bebida", cats: [COPAS, BOTELLONES, BOTELLAS] },
  "Coctel": { grupo: "bebida", cats: [COPAS] },
  "Destilados y licores": { grupo: "bebida", cats: [BOTELLAS, COPAS] },
  "Vino": { grupo: "bebida", cats: [COPAS, BOTELLAS] },
  "Vermut": { grupo: "bebida", cats: [COPAS, BOTELLAS] },
  "Whisky": { grupo: "bebida", cats: [COPAS] },
  "Fernet": { grupo: "bebida", cats: [COPAS] },
  "Espumante": { grupo: "bebida", cats: [COPAS, BOTELLAS] },
  "Aceites": { grupo: "bebida", cats: [BOTELLONES, BOTELLAS] },
  "Cognac": { grupo: "bebida", cats: [COPAS] },
  "Sour": { grupo: "bebida", cats: [COPAS] },
  // Marce se lo puso a 13 copas de cerveza (Belga, Cervoise, Patagónica) entre
  // el censo y la migración. No es la forma del vaso: lo usa como "para qué
  // sirve", igual que Coctel. Queda en Bebida. Si después decide que Trago y
  // Coctel son lo mismo, los unifica ella desde el Studio.
  "Trago": { grupo: "bebida", cats: [COPAS] },
  "Sidra": { grupo: "bebida", cats: [BOTELLAS], crear: true },
  // --- Modelo (forma de la pieza; solo cristalería) ---
  "Copa": { grupo: "modelo", cats: [COPAS] },
  "Pinta": { grupo: "modelo", cats: [COPAS] },
  "Media pinta": { grupo: "modelo", cats: [COPAS] },
  "Lupuladas": { grupo: "modelo", cats: [COPAS] },
  "Pilsner": { grupo: "modelo", cats: [COPAS] },
  "Weizen": { grupo: "modelo", cats: [COPAS] },
  "Lager": { grupo: "modelo", cats: [COPAS] },
  "Belga": { grupo: "modelo", cats: [COPAS] },
  "Americana": { grupo: "modelo", cats: [COPAS] },
  "Inglesa": { grupo: "modelo", cats: [COPAS] },
  "Irlandesa": { grupo: "modelo", cats: [COPAS] },
  "Degustación": { grupo: "modelo", cats: [COPAS] },
  "Chopp": { grupo: "modelo", cats: [COPAS] },
  "Jarra": { grupo: "modelo", cats: [COPAS] },
  "Taster": { grupo: "modelo", cats: [COPAS] },
  "Shot": { grupo: "modelo", cats: [COPAS] },
  "Tubo": { grupo: "modelo", cats: [COPAS] },
  "Tulipa": { grupo: "modelo", cats: [COPAS] },
  "Cata": { grupo: "modelo", cats: [COPAS] },
  "Decantador": { grupo: "modelo", cats: [COPAS] },
  "Corte frio": { grupo: "modelo", cats: [COPAS] },
  // --- Tipo de pieza ---
  "Caja Distribucion": { grupo: "tipo-de-pieza", cats: [CAJAS] },
  "Estuche": { grupo: "tipo-de-pieza", cats: [CAJAS] },
  "Tapas": { grupo: "tipo-de-pieza", cats: [TAPAS] },
};

/** El de la izquierda desaparece; sus productos pasan al de la derecha. */
const FUSIONES = [
  ["Aguas y refrescos", "Agua y refrescos"],
  ["Espumantes", "Espumante"],
  ["Destilados", "Destilados y licores"],
];

/** El de la izquierda desaparece; sus productos quedan con los de la derecha. */
const SPLITS = [
  ["Cerveza y sidra", ["Cerveza", "Sidra"]],
  ["Vinos y vermut", ["Vino", "Vermut"]],
];

/** Sin uso: se borran solo si de verdad no los referencia ningún producto. */
const BORRAR_SUBCATS = [];
const BORRAR_CATS = ["Otros"];

/** Direcciones históricas a redirigir que no se pueden deducir del dato actual:
 *  Marce partió "Tapas y precintos" en dos el 12-sep-2026 y esa URL quedó 404. */
const REDIRECTS_HISTORICOS = { "Tapas y tapones": ["tapas-y-precintos"] };

/* ------------------------------------------------------------------ */

const log = [];
const anotar = (t) => { log.push(t); console.log(t); };
const titulo = (t) => console.log("\n" + t + "\n" + "-".repeat(t.length));

const [cats, subs, grupos] = await Promise.all([
  query('*[_type=="category"]{_id,name,"slug":slug.current,previousSlugs}'),
  query('*[_type=="subtype"]{_id,name,scope,"grupo":group._ref,"parents":parents[]._ref}'),
  query('*[_type=="subcategoryGroup"]{_id,name,"slug":slug.current,order}'),
]);

// Los documentos de taxonomía no deberían tener borradores, pero si alguno
// quedó a medio publicar lo ignoramos y trabajamos siempre sobre el publicado.
const pub = (arr) => arr.filter((d) => !d._id.startsWith("drafts."));
const catsPub = pub(cats);
const subsPub = pub(subs);
const gruposPub = pub(grupos);

const catPorNombre = new Map(catsPub.map((c) => [norm(c.name), c]));
const subPorNombre = new Map(subsPub.map((s) => [norm(s.name), s]));
const grupoPorSlug = new Map(gruposPub.map((g) => [g.slug, g]));

const mutaciones = [];
/* Los borrados van SIEMPRE al final de la tanda. Sanity rechaza borrar un
 * documento que todavía tiene referencias, y los patches que le sacan esas
 * referencias a los productos se arman después de recorrer todas las fusiones
 * (para que dos fusiones sobre el mismo producto no se pisen). Si el borrado
 * quedara encolado antes que esos patches, la transacción se cae con un 409
 * "cannot be deleted as there are references to it". */
const borrados = [];

/* 1 · Grupos ------------------------------------------------------- */
titulo("1 · GRUPOS DE FILTRO");
const grupoId = new Map();
for (const g of GRUPOS) {
  const existente = grupoPorSlug.get(g.slug);
  if (existente) {
    grupoId.set(g.slug, existente._id);
    anotar("  ya existe: " + g.name);
  } else {
    const _id = "subcategoryGroup-" + g.slug;
    grupoId.set(g.slug, _id);
    mutaciones.push({
      createIfNotExists: {
        _id, _type: "subcategoryGroup", name: g.name,
        slug: { _type: "slug", current: g.slug }, order: g.order, aliases: [],
      },
    });
    anotar("  CREAR: " + g.name);
  }
}

/* 2 · Altas de subcategorías nuevas -------------------------------- */
titulo("2 · SUBCATEGORÍAS NUEVAS");
let nuevas = 0;
for (const [nombre, def] of Object.entries(MAPA)) {
  if (subPorNombre.has(norm(nombre))) continue;
  if (!def.crear) { anotar("  OJO: «" + nombre + "» está en el mapa pero no existe en Sanity — se saltea"); continue; }
  const _id = "subtype-" + catSlug(nombre);
  mutaciones.push({ createIfNotExists: { _id, _type: "subtype", name: nombre } });
  subPorNombre.set(norm(nombre), { _id, name: nombre });
  nuevas++;
  anotar("  CREAR: " + nombre);
}
if (!nuevas) anotar("  (ninguna)");

/* 3 · Fusiones y splits -------------------------------------------- */
titulo("3 · FUSIONES Y SPLITS");

/** Acumulador de cambios por producto. Un mismo producto puede quedar afectado
 *  por dos fusiones distintas; si emitiéramos un patch por fusión, el segundo
 *  pisaría al primero (los dos se calcularon sobre el estado original). Por eso
 *  se acumula acá y se emite un solo patch por producto al final. */
const pendientes = new Map();

/** Reemplaza, en todos los productos (borradores y publicados), las referencias
 *  al que desaparece por las de los que quedan, sin duplicar lo que ya tenían. */
async function reapuntar(viejo, nuevos, etiqueta) {
  const docs = await query(
    '*[_type=="product" && references($id)]{_id,"subs":subtypes[]._ref,"sub":subtype._ref}',
    { id: viejo._id },
  );
  if (!docs.length) { anotar("  " + etiqueta + ": 0 productos"); return 0; }
  for (const d of docs) {
    const estado = pendientes.get(d._id) || { subs: [...(d.subs || [])], sub: d.sub ?? null };
    estado.subs = estado.subs.filter((r) => r !== viejo._id);
    for (const n of nuevos) if (!estado.subs.includes(n)) estado.subs.push(n);
    // El campo singular viejo (`subtype`) todavía existe en algunos productos.
    // Si apuntaba al que desaparece, lo dejamos en el primero de los nuevos.
    if (estado.sub === viejo._id) estado.sub = nuevos[0];
    pendientes.set(d._id, estado);
  }
  anotar("  " + etiqueta + ": " + docs.length + " productos");
  return docs.length;
}

/** Emite un patch por producto con el estado final acumulado. */
function volcarPendientes() {
  for (const [id, estado] of pendientes) {
    const set = {
      subtypes: estado.subs.map((_ref) => ({ _type: "reference", _ref, _key: key() })),
    };
    if (estado.sub) set.subtype = { _type: "reference", _ref: estado.sub };
    mutaciones.push({ patch: { id, set } });
  }
  if (pendientes.size) anotar("  productos a reescribir: " + pendientes.size);
}

for (const [perdedorN, ganadorN] of FUSIONES) {
  const perdedor = subPorNombre.get(norm(perdedorN));
  const ganador = subPorNombre.get(norm(ganadorN));
  if (!perdedor) { anotar("  ya fusionado: " + perdedorN + " → " + ganadorN); continue; }
  if (!ganador) { anotar("  NO SE PUEDE fusionar " + perdedorN + ": no existe " + ganadorN); continue; }
  await reapuntar(perdedor, [ganador._id], "fusión " + perdedorN + " → " + ganadorN);
  borrados.push({ delete: { id: perdedor._id } });
  subPorNombre.delete(norm(perdedorN));
}

for (const [compuestoN, partesN] of SPLITS) {
  const compuesto = subPorNombre.get(norm(compuestoN));
  if (!compuesto) { anotar("  ya partido: " + compuestoN); continue; }
  const partes = partesN.map((n) => subPorNombre.get(norm(n))).filter(Boolean);
  if (partes.length !== partesN.length) {
    anotar("  NO SE PUEDE partir " + compuestoN + ": falta alguna de " + partesN.join(" / "));
    continue;
  }
  await reapuntar(compuesto, partes.map((p) => p._id), "split " + compuestoN + " → " + partesN.join(" + "));
  borrados.push({ delete: { id: compuesto._id } });
  subPorNombre.delete(norm(compuestoN));
}

volcarPendientes();

/* 4 · Grupo y categorías de cada subcategoría ---------------------- */
titulo("4 · GRUPO Y CATEGORÍAS DE CADA SUBCATEGORÍA");
let tocadas = 0;
for (const [nombre, def] of Object.entries(MAPA)) {
  const sub = subPorNombre.get(norm(nombre));
  if (!sub) continue;
  const gid = grupoId.get(def.grupo);
  const parentIds = def.cats
    .map((c) => catPorNombre.get(norm(c)))
    .filter(Boolean)
    .map((c) => c._id);
  const faltanCats = def.cats.filter((c) => !catPorNombre.has(norm(c)));
  if (faltanCats.length) anotar("  OJO: «" + nombre + "» apunta a categorías que no existen: " + faltanCats.join(", "));

  const igualGrupo = sub.grupo === gid;
  const igualParents =
    Array.isArray(sub.parents) &&
    sub.parents.length === parentIds.length &&
    parentIds.every((id) => sub.parents.includes(id));
  if (igualGrupo && igualParents) continue;

  mutaciones.push({
    patch: {
      id: sub._id,
      set: {
        group: { _type: "reference", _ref: gid },
        parents: parentIds.map((_ref) => ({ _type: "reference", _ref, _key: key() })),
      },
    },
  });
  tocadas++;
}
anotar("  subcategorías a actualizar: " + tocadas);

/* 4b · Nadie puede quedar sin grupo sin que se vea -------------------
 * Marce sigue cargando mientras nosotros migramos: entre el censo y esta
 * corrida le puso "Trago" a 13 productos. Una subcategoría sin grupo NO aparece
 * en ningún filtro, así que si alguna quedaría afuera y encima la usa algún
 * producto, este script se planta y no aplica nada. */
titulo("4b · SUBCATEGORÍAS QUE QUEDARÍAN SIN GRUPO");
const enMapa = (nombre) => Object.keys(MAPA).some((n) => norm(n) === norm(nombre));
const aBorrar = (nombre) => BORRAR_SUBCATS.some((n) => norm(n) === norm(nombre));
const huerfanas = [];
for (const sub of subPorNombre.values()) {
  if (enMapa(sub.name)) continue;
  const usos = await query('count(*[_type=="product" && references($id)])', { id: sub._id });
  if (aBorrar(sub.name) && usos === 0) continue; // se borra más abajo, sin drama
  const ejemplos =
    usos > 0
      ? await query('*[_type=="product" && references($id)][0..4].name', { id: sub._id })
      : [];
  huerfanas.push({ name: sub.name, usos, ejemplos: ejemplos || [] });
}
if (!huerfanas.length) anotar("  ninguna: todas las subcategorías tienen grupo.");
for (const h of huerfanas) {
  anotar("  «" + h.name + "» — " + h.usos + " producto(s)");
  for (const e of h.ejemplos) anotar("      · " + e);
}
const bloqueantes = huerfanas.filter((h) => h.usos > 0);

/* 5 · Slugs de categoría ------------------------------------------- */
titulo("5 · DIRECCIONES DE CATEGORÍA");
for (const c of catsPub) {
  const deseado = catSlug(c.name);
  const previos = new Set(c.previousSlugs || []);
  for (const extra of REDIRECTS_HISTORICOS[c.name] || []) previos.add(extra);
  if (c.slug && c.slug !== deseado) previos.add(c.slug);
  previos.delete(deseado);

  const cambiaSlug = c.slug !== deseado;
  const cambiaPrev = [...previos].sort().join("|") !== [...(c.previousSlugs || [])].sort().join("|");
  if (!cambiaSlug && !cambiaPrev) continue;

  mutaciones.push({
    patch: {
      id: c._id,
      set: { slug: { _type: "slug", current: deseado }, previousSlugs: [...previos] },
    },
  });
  anotar(
    "  " + c.name + ": " + (c.slug || "(sin slug)") + " → " + deseado +
    (previos.size ? "   redirige: " + [...previos].join(", ") : ""),
  );
}

/* 6 · Limpieza ----------------------------------------------------- */
titulo("6 · LIMPIEZA");
for (const nombre of BORRAR_SUBCATS) {
  const sub = subPorNombre.get(norm(nombre));
  if (!sub) { anotar("  ya no está: " + nombre); continue; }
  const usos = await query('count(*[_type=="product" && references($id)])', { id: sub._id });
  if (usos > 0) { anotar("  NO se borra «" + nombre + "»: lo usan " + usos + " productos"); continue; }
  borrados.push({ delete: { id: sub._id } });
  anotar("  BORRAR subcategoría: " + nombre);
}
for (const nombre of BORRAR_CATS) {
  const cat = catPorNombre.get(norm(nombre));
  if (!cat) { anotar("  ya no está: " + nombre); continue; }
  const usos = await query('count(*[_type=="product" && references($id)])', { id: cat._id });
  if (usos > 0) { anotar("  NO se borra la categoría «" + nombre + "»: la usan " + usos + " productos"); continue; }
  borrados.push({ delete: { id: cat._id } });
  anotar("  BORRAR categoría: " + nombre);
}

// Recién ahora, con todos los patches encolados adelante.
mutaciones.push(...borrados);

/* ------------------------------------------------------------------ */
titulo("RESUMEN");
console.log("  cambios a aplicar: " + mutaciones.length);
if (bloqueantes.length) {
  console.log("\n  FRENADO. Estas subcategorías se usan y no tienen grupo asignado:");
  for (const h of bloqueantes) console.log("    · " + h.name + " (" + h.usos + " productos)");
  console.log("\n  Quedarían invisibles en los filtros. Agregalas al MAPA de este");
  console.log("  archivo (arriba de todo) con su grupo y volvé a correrlo.\n");
  process.exit(1);
}
if (!APPLY) {
  console.log("\n  MODO PRUEBA: no se escribió nada.");
  console.log("  Para aplicarlo de verdad, volvé a correrlo con --apply\n");
  process.exit(0);
}
if (!mutaciones.length) {
  console.log("\n  Nada para hacer: ya está todo migrado.\n");
  process.exit(0);
}
await mutate(mutaciones);
console.log("\n  Aplicado.\n");
