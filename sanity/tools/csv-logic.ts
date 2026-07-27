/**
 * Lógica pura (sin React) de la herramienta "Actualizar por CSV".
 * Parseo de CSV, matcheo de columnas, coerción de valores por tipo y cálculo
 * del "plan de cambios" (diff) contra el estado actual en Sanity.
 *
 * Todo acá es testeable y no toca la red: la parte de fetch/patch vive en el
 * componente.
 */
import {
  BADGE_VALUES,
  COLUMNS,
  SKU_HEADERS,
  norm,
  type ColumnDef,
} from "./csv-columns";

/* ---------------- Parseo de CSV ---------------- */

/** Parser tolerante: comillas, comas escapadas, CRLF, autodetección de ; o , como separador. */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Separador: el que más aparezca en la cabecera (soporta ; que usa Excel-AR).
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

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
      } else if (ch === sep && !q) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(norm);
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

/* ---------------- Matcheo de columnas ---------------- */

export interface MatchedColumn {
  col: ColumnDef;
  header: string; // header normalizado presente en el CSV
}

export function matchColumns(headers: string[]): {
  skuHeader: string | null;
  matched: MatchedColumn[];
  unknownHeaders: string[];
} {
  const set = new Set(headers);
  const skuHeader = SKU_HEADERS.map(norm).find((h) => set.has(h)) ?? null;

  const matched: MatchedColumn[] = [];
  const usedHeaders = new Set<string>();
  if (skuHeader) usedHeaders.add(skuHeader);

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
  return { skuHeader, matched, unknownHeaders };
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

function toBool(v: string): boolean | null {
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
  return doc[col.field];
}

export function valuesEqual(col: ColumnDef, current: unknown, next: unknown): boolean {
  if (col.kind === "ref") {
    const cur = current ?? null;
    const nx = (next as { _ref?: string })?._ref ?? null;
    return cur === nx;
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
  name?: string;
  changes: FieldChange[];
  errors: string[];
}

export interface ProductDoc extends Record<string, unknown> {
  _id: string;
  sku: string;
  name?: string;
}

export interface Plan {
  rows: RowPlan[];
  toUpdate: RowPlan[];
  unchanged: RowPlan[];
  notFound: RowPlan[];
  withErrors: RowPlan[];
  totalFieldChanges: number;
}

export function buildPlan(
  csvText: string,
  productsBySku: Map<string, ProductDoc[]>,
  refs: RefMaps,
): { plan: Plan | null; error?: string; matched: MatchedColumn[]; unknownHeaders: string[] } {
  const { headers, rows } = parseCsv(csvText);
  if (rows.length === 0)
    return { plan: null, error: "El CSV está vacío o no tiene filas de datos.", matched: [], unknownHeaders: [] };

  const { skuHeader, matched, unknownHeaders } = matchColumns(headers);
  if (!skuHeader)
    return {
      plan: null,
      error: 'No encontré la columna SKU. Agregá una columna "SKU" (o "codigo").',
      matched,
      unknownHeaders,
    };
  if (matched.length === 0)
    return {
      plan: null,
      error: "No reconocí ninguna columna actualizable además de SKU. Revisá los nombres de las columnas.",
      matched,
      unknownHeaders,
    };

  const rowPlans: RowPlan[] = [];
  for (const row of rows) {
    const sku = row[skuHeader]?.trim();
    if (!sku) continue; // fila sin sku → se ignora

    const docs = productsBySku.get(norm(sku)) ?? [];
    const rp: RowPlan = {
      sku,
      found: docs.length > 0,
      docIds: docs.map((d) => d._id),
      name: docs[0]?.name,
      changes: [],
      errors: [],
    };

    if (docs.length > 0) {
      // Doc de referencia para valores actuales (preferimos published = id sin "drafts.").
      const ref = docs.find((d) => !d._id.startsWith("drafts.")) ?? docs[0];
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
          toText: col.kind === "ref" ? raw.trim() : display(col, c.value, undefined),
          nextValue: c.value,
        });
      }
    }
    rowPlans.push(rp);
  }

  const toUpdate = rowPlans.filter((r) => r.found && r.changes.length > 0 && r.errors.length === 0);
  const unchanged = rowPlans.filter((r) => r.found && r.changes.length === 0 && r.errors.length === 0);
  const notFound = rowPlans.filter((r) => !r.found);
  const withErrors = rowPlans.filter((r) => r.found && r.errors.length > 0);
  const totalFieldChanges = toUpdate.reduce((a, r) => a + r.changes.length, 0);

  return {
    plan: { rows: rowPlans, toUpdate, unchanged, notFound, withErrors, totalFieldChanges },
    matched,
    unknownHeaders,
  };
}
