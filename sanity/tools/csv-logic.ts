/**
 * Lógica pura (sin React) de la herramienta "Actualizar por CSV".
 * Matcheo de columnas, coerción de valores por tipo y cálculo del "plan de
 * cambios" (diff) contra el estado actual en Sanity.
 *
 * El parseo del archivo vive en `csv-parse.ts` (sin dependencias, con chequeos
 * en `npm run csv:check`). Todo acá es testeable y no toca la red: la parte de
 * fetch/patch vive en el componente.
 */
import {
  BADGE_VALUES,
  COLUMNS,
  PUBLISH_HEADERS,
  SKU_HEADERS,
  norm,
  type ColumnDef,
} from "./csv-columns";
import { parseCsv } from "./csv-parse";
import { isWixFormat, wixToCanonical, type WixCreateInfo } from "./wix-adapter";

export { parseCsv };

/* ---------------- Matcheo de columnas ---------------- */

export interface MatchedColumn {
  col: ColumnDef;
  header: string; // header normalizado presente en el CSV
}

export function matchColumns(headers: string[]): {
  skuHeader: string | null;
  publishHeader: string | null;
  matched: MatchedColumn[];
  unknownHeaders: string[];
} {
  const set = new Set(headers);
  const skuHeader = SKU_HEADERS.map(norm).find((h) => set.has(h)) ?? null;
  // Columna de publicación: no es un campo del producto, se maneja aparte.
  const publishHeader = PUBLISH_HEADERS.map(norm).find((h) => set.has(h)) ?? null;

  const matched: MatchedColumn[] = [];
  const usedHeaders = new Set<string>();
  if (skuHeader) usedHeaders.add(skuHeader);
  if (publishHeader) usedHeaders.add(publishHeader);

  for (const col of COLUMNS) {
    // Aceptamos los alias definidos + el propio label normalizado. Esto último
    // garantiza el round-trip export→import: el CSV exportado usa los labels como
    // headers (ej. "Imagen (URL)", "Precio anterior (tachado)"), que de otro modo
    // no matchearían ningún alias por los paréntesis/puntuación.
    const candidates = [...col.headers.map(norm), norm(col.label)];
    const header = candidates.find((h) => set.has(h));
    if (header) {
      matched.push({ col, header });
      usedHeaders.add(header);
    }
  }
  const unknownHeaders = headers.filter((h) => h && !usedHeaders.has(h));
  return { skuHeader, publishHeader, matched, unknownHeaders };
}

/* ---------------- Coerción de valores ---------------- */

export interface RefMaps {
  category: Map<string, string>; // norm(name) -> _id
  subtype: Map<string, string>;
}

export interface Spec {
  _key?: string;
  key: string;
  value: string;
}

export type Coerced =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/**
 * Intención de imagen resuelta desde una URL del CSV.
 * - "sanity": la URL ya es del CDN de Sanity → se arma la referencia sin re-subir.
 * - "upload": URL externa → el apply la baja y la sube a Sanity.
 */
export type ImageIntent =
  | { kind: "sanity"; assetId: string }
  | { kind: "upload"; url: string };

/**
 * Extrae el asset _id de una URL del CDN de Sanity. Devuelve null si no lo es.
 * Ej: https://cdn.sanity.io/images/4sov2yyo/production/ab12…f9-1200x800.jpg
 *     → "image-ab12…f9-1200x800-jpg"
 */
export function sanityAssetIdFromUrl(url: string): string | null {
  const m = /cdn\.sanity\.io\/images\/[^/]+\/[^/]+\/([a-f0-9]+)-(\d+x\d+)\.(\w+)/i.exec(url);
  if (!m) return null;
  return `image-${m[1]}-${m[2]}-${m[3].toLowerCase()}`;
}

function toNum(v: string): number | null {
  if (!v) return null;
  // AR: miles con punto, decimal con coma. También acepta "1234.56" plano.
  let s = v.replace(/\s/g, "").replace(/[^0-9.,\-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (s === "" || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toBool(v: string): boolean | null {
  const n = norm(v);
  if (["si", "sí", "true", "1", "x", "verdadero", "activo", "yes"].includes(n)) return true;
  if (["no", "false", "0", "falso", "inactivo"].includes(n)) return false;
  return null;
}

function toDateISO(v: string): string | null {
  const s = v.trim();
  // yyyy-mm-dd (opcional hora)
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
  // dd/mm/yyyy o dd-mm-yyyy
  m = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/.exec(s);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}T00:00:00.000Z`;
  }
  return null;
}

let keyCounter = 0;
function makeKey(): string {
  // Clave estable-suficiente para items de array de Sanity (corre en el browser).
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : `k${(keyCounter++).toString(36)}${Date.now().toString(36).slice(-4)}`;
  return rnd;
}

export function coerce(col: ColumnDef, raw: string, refs: RefMaps): Coerced {
  const v = raw.trim();
  switch (col.kind) {
    case "string":
    case "text":
      return { ok: true, value: v };

    case "number": {
      const n = toNum(v);
      if (n === null) return { ok: false, error: `"${raw}" no es un número válido` };
      return { ok: true, value: n };
    }

    case "boolean": {
      const b = toBool(v);
      if (b === null) return { ok: false, error: `"${raw}" no es Sí/No` };
      return { ok: true, value: b };
    }

    case "date": {
      const d = toDateISO(v);
      if (!d) return { ok: false, error: `"${raw}" no es una fecha (usá dd/mm/aaaa)` };
      return { ok: true, value: d };
    }

    case "ref": {
      const map = col.refType === "subtype" ? refs.subtype : refs.category;
      const id = map.get(norm(v));
      if (!id)
        return {
          ok: false,
          error: `${col.label} "${raw}" no existe en Sanity`,
        };
      return { ok: true, value: { _type: "reference", _ref: id } };
    }

    case "refArray": {
      const map = col.refType === "subtype" ? refs.subtype : refs.category;
      const names = v
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const refsOut: { _type: "reference"; _ref: string; _key: string }[] = [];
      const missing: string[] = [];
      for (const name of names) {
        const id = map.get(norm(name));
        if (!id) missing.push(name);
        else if (!refsOut.some((r) => r._ref === id))
          refsOut.push({ _type: "reference", _ref: id, _key: makeKey() });
      }
      if (missing.length)
        return {
          ok: false,
          error: `${col.label}: "${missing.join('", "')}" no existe en Sanity (crealo primero en Catálogo → Subtipos)`,
        };
      return { ok: true, value: refsOut };
    }

    case "stringArray": {
      const arr = v
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return { ok: true, value: arr };
    }

    case "badges": {
      const parts = v
        .split(/[;,|]/)
        .map((s) => norm(s))
        .filter(Boolean);
      const values: string[] = [];
      const bad: string[] = [];
      for (const p of parts) {
        const found = BADGE_VALUES.find((b) => b.titles.includes(p) || b.value === p);
        if (found) {
          if (!values.includes(found.value)) values.push(found.value);
        } else bad.push(p);
      }
      if (bad.length)
        return {
          ok: false,
          error: `destacado(s) no reconocido(s): ${bad.join(", ")} (válidos: Más vendido, Nuevo, Promo del mes, Decorado bonificado)`,
        };
      return { ok: true, value: values };
    }

    case "specs": {
      const specs: Spec[] = [];
      for (const entry of v.split(";")) {
        const t = entry.trim();
        if (!t) continue;
        const mm = /^(.+?)\s*[:=]\s*(.+)$/.exec(t);
        if (!mm)
          return {
            ok: false,
            error: `especificación "${t}" mal formada (usá Atributo: Valor; separá con ;)`,
          };
        specs.push({ _key: makeKey(), key: mm[1].trim(), value: mm[2].trim() });
      }
      return { ok: true, value: specs };
    }

    case "image": {
      if (!/^https?:\/\//i.test(v))
        return { ok: false, error: `"${raw}" no parece una URL (tiene que empezar con http)` };
      const assetId = sanityAssetIdFromUrl(v);
      if (assetId) return { ok: true, value: { kind: "sanity", assetId } as ImageIntent };
      return { ok: true, value: { kind: "upload", url: v } as ImageIntent };
    }

    default:
      return { ok: false, error: "tipo de columna no soportado" };
  }
}

/* ---------------- Comparación / display del valor actual ---------------- */

/** Normaliza el valor "actual" traído de Sanity a algo comparable con el coercido. */
export function currentValue(col: ColumnDef, doc: Record<string, unknown>): unknown {
  if (col.kind === "ref") {
    return col.refType === "subtype" ? doc.subtypeId : doc.categoryId;
  }
  if (col.kind === "refArray") {
    // ids actuales (el query de CsvUpdate los resuelve como subtypeIds, con
    // fallback al campo viejo `subtype` si todavía no se migró el producto).
    return ((doc.subtypeIds as string[] | undefined) ?? []).filter(Boolean);
  }
  return doc[col.field];
}

export function valuesEqual(col: ColumnDef, current: unknown, next: unknown): boolean {
  if (col.kind === "ref") {
    const cur = current ?? null;
    const nx = (next as { _ref?: string })?._ref ?? null;
    return cur === nx;
  }
  if (col.kind === "refArray") {
    const cur = [...((current as string[]) ?? [])].sort();
    const nx = ((next as { _ref: string }[]) ?? []).map((r) => r._ref).sort();
    return JSON.stringify(cur) === JSON.stringify(nx);
  }
  if (col.kind === "specs") {
    const c = ((current as Spec[]) ?? []).map((s) => `${norm(s.key)}=${norm(s.value)}`);
    const n = ((next as Spec[]) ?? []).map((s) => `${norm(s.key)}=${norm(s.value)}`);
    return JSON.stringify(c) === JSON.stringify(n);
  }
  if (col.kind === "stringArray" || col.kind === "badges") {
    return JSON.stringify(current ?? []) === JSON.stringify(next ?? []);
  }
  if (col.kind === "number") {
    return Number(current ?? NaN) === Number(next ?? NaN);
  }
  if (col.kind === "boolean") {
    return Boolean(current) === Boolean(next);
  }
  // string/text/date
  return String(current ?? "").trim() === String(next ?? "").trim();
}

export function display(col: ColumnDef, value: unknown, doc?: Record<string, unknown>): string {
  if (value === undefined || value === null || value === "") return "—";
  if (col.kind === "image") {
    const i = value as ImageIntent;
    return i?.kind === "sanity" ? "(imagen del banco de Sanity)" : "(subir desde URL)";
  }
  if (col.kind === "ref") {
    // Para mostrar el nombre en vez del id.
    if (doc) return String(col.refType === "subtype" ? doc.subtypeName ?? "—" : doc.categoryName ?? "—");
    const ref = (value as { _ref?: string })?._ref;
    return ref ? `→ ${ref}` : "—";
  }
  if (col.kind === "refArray") {
    if (doc) return ((doc.subtypeNames as string[] | undefined) ?? []).filter(Boolean).join("; ") || "—";
    const refs = ((value as { _ref?: string }[]) ?? []).map((r) => r._ref).filter(Boolean);
    return refs.length ? `→ ${refs.length} subtipo(s)` : "—";
  }
  if (col.kind === "boolean") return value ? "Sí" : "No";
  if (col.kind === "specs")
    return ((value as Spec[]) ?? []).map((s) => `${s.key}: ${s.value}`).join(" · ") || "—";
  if (col.kind === "stringArray" || col.kind === "badges")
    return ((value as string[]) ?? []).join(", ") || "—";
  if (col.kind === "date") return String(value).slice(0, 10);
  return String(value);
}

/* ---------------- Plan de cambios ---------------- */

export interface FieldChange {
  field: string;
  label: string;
  fromText: string;
  toText: string;
  /** valor listo para patch.set() */
  nextValue: unknown;
}

export interface RowPlan {
  sku: string;
  found: boolean;
  docIds: string[]; // ids a patchear (published + draft si existen)
  /** Línea del archivo (1-based) para poder señalarla en los mensajes. */
  line?: number;
  name?: string;
  changes: FieldChange[];
  errors: string[];
  /** Cambio de visibilidad pedido en la columna "Publicado". */
  publish?: PublishAction;
}

/**
 * Acción de publicación pedida por la columna "Publicado".
 * - `publish`: el producto está solo como borrador y hay que ponerlo en la web.
 * - `unpublish`: está publicado y hay que sacarlo (queda como borrador).
 */
export interface PublishAction {
  kind: "publish" | "unpublish";
  publishedId: string;
  draftId: string;
  /** Avisos (ej. publicar sin foto) que no bloquean pero conviene mostrar. */
  warning?: string;
}

export interface ProductDoc extends Record<string, unknown> {
  _id: string;
  sku: string;
  name?: string;
}

/** Alta de un producto nuevo (borrador) a crear desde la ingesta. */
export interface CreatePlan {
  sku: string;
  name: string;
  categoryName: string;
  reason?: string; // por qué NO se puede crear (falta precio/categoría) → va a "no creables"
  doc?: Record<string, unknown>; // doc borrador listo para createOrReplace
}

export interface Plan {
  rows: RowPlan[];
  toUpdate: RowPlan[];
  unchanged: RowPlan[];
  notFound: RowPlan[];
  withErrors: RowPlan[];
  toCreate: CreatePlan[];
  /** Filas con cambio de visibilidad (columna "Publicado"). */
  toPublish: RowPlan[];
  toUnpublish: RowPlan[];
  totalFieldChanges: number;
  wixMode: boolean;
}

function slugify(name: string): string {
  return norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

export function buildPlan(
  csvText: string,
  productsBySku: Map<string, ProductDoc[]>,
  refs: RefMaps,
  opts?: { createMissing?: boolean },
): {
  plan: Plan | null;
  error?: string;
  matched: MatchedColumn[];
  unknownHeaders: string[];
  /** Avisos del parseo (columnas repetidas, filas desalineadas). */
  warnings: string[];
} {
  const parsed = parseCsv(csvText);
  // Formato Wix → traducimos a filas canónicas (nuestros headers) antes de seguir.
  const wixMode = isWixFormat(parsed.headers);
  let createInfo = new Map<string, WixCreateInfo>();
  let headers = parsed.headers;
  let rows = parsed.rows;
  // Línea de cada fila, para mensajes tipo "fila 12". El adaptador de Wix filtra
  // filas (variantes), así que ahí no podemos mapearlas y las dejamos sin número.
  let lines: number[] = parsed.lines;
  if (wixMode) {
    const conv = wixToCanonical(parsed.rows);
    headers = conv.headers;
    rows = conv.rows;
    createInfo = conv.createInfo;
    lines = [];
  }
  const warnings = [...parsed.warnings];
  if (rows.length === 0)
    return {
      plan: null,
      error: "El CSV está vacío o no tiene filas de datos.",
      matched: [],
      unknownHeaders: [],
      warnings,
    };

  const { skuHeader, publishHeader, matched, unknownHeaders } = matchColumns(headers);
  if (!skuHeader)
    return {
      plan: null,
      error: 'No encontré la columna SKU. Agregá una columna "SKU" (o "codigo").',
      matched,
      unknownHeaders,
      warnings,
    };
  if (matched.length === 0 && !publishHeader)
    return {
      plan: null,
      error: "No reconocí ninguna columna actualizable además de SKU. Revisá los nombres de las columnas.",
      matched,
      unknownHeaders,
      warnings,
    };

  const rowPlans: RowPlan[] = [];
  rows.forEach((row, i) => {
    const sku = row[skuHeader]?.trim();
    if (!sku) return; // fila sin sku → se ignora

    const docs = productsBySku.get(norm(sku)) ?? [];
    const rp: RowPlan = {
      sku,
      found: docs.length > 0,
      docIds: docs.map((d) => d._id),
      line: lines[i],
      name: docs[0]?.name,
      changes: [],
      errors: [],
    };

    if (docs.length > 0) {
      // Doc de referencia para los valores actuales: preferimos el BORRADOR si
      // existe, porque es la versión más nueva (lo que Marce ve en el Studio) y
      // es la que exporta esta misma herramienta. Si comparáramos contra el
      // publicado, un export → import sin tocar nada mostraría cambios falsos.
      const ref = docs.find((d) => d._id.startsWith("drafts.")) ?? docs[0];
      for (const { col, header } of matched) {
        const raw = row[header];
        if (raw === undefined || raw.trim() === "") continue; // celda vacía = no tocar
        const c = coerce(col, raw, refs);
        if (!c.ok) {
          rp.errors.push(`${col.label}: ${c.error}`);
          continue;
        }

        // Imagen: caso especial. Guardamos la "intención" (ImageIntent); la subida
        // real / armado de la referencia lo resuelve el apply (es asíncrono).
        if (col.kind === "image") {
          const intent = c.value as ImageIntent;
          const curRef = (ref.imageRef as string | undefined) ?? null;
          if (intent.kind === "sanity" && intent.assetId === curRef) continue; // misma imagen
          rp.changes.push({
            field: "images",
            label: col.label,
            fromText: ref.imageUrl ? "(imagen actual)" : "—",
            toText: intent.kind === "sanity" ? "(imagen del banco de Sanity)" : "(bajar y subir desde URL)",
            nextValue: intent,
          });
          continue;
        }

        const cur = currentValue(col, ref);
        if (valuesEqual(col, cur, c.value)) continue; // sin cambio real
        rp.changes.push({
          field: col.field,
          label: col.label,
          fromText: display(col, cur, ref),
          // Para referencias mostramos el nombre tal cual lo escribió el usuario
          // (el _ref resuelto no es legible). Para el resto, el display normal.
          toText: col.kind === "ref" || col.kind === "refArray" ? raw.trim() : display(col, c.value, undefined),
          nextValue: c.value,
        });
      }

      // --- Columna "Publicado" (visibilidad, no es un campo del producto) ---
      if (publishHeader) {
        const rawPub = (row[publishHeader] ?? "").trim();
        const want = rawPub ? toBool(rawPub) : null;
        if (rawPub && want === null) {
          rp.errors.push(`Publicado: "${rawPub}" no es Sí/No`);
        } else if (want !== null) {
          const published = docs.find((d) => !d._id.startsWith("drafts."));
          const draft = docs.find((d) => d._id.startsWith("drafts."));
          const publishedId = published?._id ?? draft!._id.replace(/^drafts\./, "");
          const draftId = draft?._id ?? `drafts.${published!._id}`;
          if (want && !published) {
            // Un producto sin categoría queda afuera de los filtros del catálogo
            // (es el "me lo muestra en rojo" del Studio): no lo dejamos publicar
            // así. Vale la categoría que traiga esta misma fila del CSV.
            const catEnCsv = rp.changes.some((c) => c.field === "category");
            if (!ref.categoryId && !catEnCsv) {
              rp.errors.push(
                "Publicado: no tiene categoría asignada — ponele una (podés hacerlo en este mismo CSV) antes de publicarlo.",
              );
            } else {
              rp.publish = {
                kind: "publish",
                publishedId,
                draftId,
                warning: ref.imageUrl ? undefined : "se publica sin foto",
              };
            }
          } else if (!want && published) {
            rp.publish = { kind: "unpublish", publishedId, draftId };
          }
        }
      }
    }
    rowPlans.push(rp);
  });

  const toUpdate = rowPlans.filter((r) => r.found && r.changes.length > 0 && r.errors.length === 0);
  const unchanged = rowPlans.filter(
    (r) => r.found && r.changes.length === 0 && !r.publish && r.errors.length === 0,
  );
  const withErrors = rowPlans.filter((r) => r.found && r.errors.length > 0);
  const toPublish = rowPlans.filter((r) => r.errors.length === 0 && r.publish?.kind === "publish");
  const toUnpublish = rowPlans.filter((r) => r.errors.length === 0 && r.publish?.kind === "unpublish");
  const totalFieldChanges = toUpdate.reduce((a, r) => a + r.changes.length, 0);

  // Altas (borradores) para SKU nuevos — solo cuando se pide y hay datos (formato Wix
  // trae precio para sembrar el borrador; nuestro formato no, así que ahí no se crea).
  const createOn = !!opts?.createMissing && wixMode;
  const badgeCol = COLUMNS.find((c) => c.field === "badges")!;
  const toCreate: CreatePlan[] = [];
  if (createOn) {
    const seen = new Set<string>();
    for (const row of rows) {
      const sku = (row["sku"] ?? "").trim();
      if (!sku) continue;
      const k = norm(sku);
      if (productsBySku.has(k) || seen.has(k)) continue;
      seen.add(k);
      const info = createInfo.get(k);
      const name = (row["nombre"] ?? info?.name ?? "").trim();
      const categoryName = (row["categoria"] ?? info?.categoryName ?? "").trim();
      const cp: CreatePlan = { sku, name, categoryName };
      const price = info?.pricePublic ?? null;
      if (!name) { cp.reason = "sin nombre en el archivo"; toCreate.push(cp); continue; }
      if (price == null || price <= 0) {
        cp.reason = "sin precio en el archivo (el borrador necesita un precio inicial)";
        toCreate.push(cp);
        continue;
      }
      const catId = refs.category.get(norm(categoryName));
      const description = (row["descripcion"] ?? "").trim();
      let badges: string[] = [];
      const braw = (row["destacados"] ?? "").trim();
      if (braw) {
        const bc = coerce(badgeCol, braw, refs);
        if (bc.ok) badges = bc.value as string[];
      }
      const idSafe = sku.replace(/[^A-Za-z0-9._-]/g, "-");
      cp.doc = {
        _id: `drafts.product-csv-${idSafe}`,
        _type: "product",
        sku,
        name,
        slug: { _type: "slug", current: slugify(name) || idSafe.toLowerCase() },
        pricePublic: price,
        priceWholesale: Math.round(price * 0.82),
        unitsPerBulk: 1,
        deliveryTime: "24-48 hs",
        decoAvailable: true,
        fromSheet: true, // cae en la bandeja "Nuevos desde la planilla" del Studio
        ...(catId ? { category: { _type: "reference", _ref: catId } } : {}),
        ...(description ? { description } : {}),
        ...(badges.length ? { badges } : {}),
      };
      toCreate.push(cp);
    }
  }
  // Si estamos creando, los "no encontrados" se manejan como altas (no se re-reportan).
  const notFound = createOn ? [] : rowPlans.filter((r) => !r.found);

  return {
    plan: {
      rows: rowPlans,
      toUpdate,
      unchanged,
      notFound,
      withErrors,
      toCreate,
      toPublish,
      toUnpublish,
      totalFieldChanges,
      wixMode,
    },
    matched,
    unknownHeaders,
    warnings,
  };
}
