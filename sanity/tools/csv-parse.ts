/**
 * Parser de CSV de la herramienta "Actualizar por CSV".
 *
 * Vive en su propio archivo, sin dependencias, para poder testearlo sin bundler:
 * `npm run csv:check` lo importa directo (node stripea los tipos).
 *
 * POR QUÉ SE REESCRIBIÓ (12-sep-2026, reporte de Marce)
 * El parser anterior cortaba el archivo por saltos de línea ANTES de mirar las
 * comillas. Una celda multilínea —una descripción con un Enter adentro, que es
 * lo que escribe el propio export de esta herramienta y lo que devuelve Excel—
 * partía la fila en dos: la segunda mitad del texto entraba como una fila nueva
 * y su primera celda caía en la columna SKU. De ahí los "SKU no encontrado" con
 * contenido de otras columnas, y de ahí también que la descripción/categoría de
 * la fila partida no se actualizara: el resto de sus columnas se perdía.
 *
 * Ahora se recorre el texto entero carácter por carácter y el salto de línea
 * dentro de comillas es parte del valor.
 */

/** Normaliza texto para comparar encabezados y valores (sin acentos, minúsculas). */
export function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export type Separator = "," | ";" | "\t";

export interface ParsedCsv {
  /** Encabezados normalizados, en el orden del archivo. */
  headers: string[];
  /** Una fila por registro, indexada por encabezado normalizado. */
  rows: Record<string, string>[];
  /** Número de línea (1-based, contando la cabecera) de cada fila de `rows`. */
  lines: number[];
  separator: Separator;
  /** Avisos no fatales para mostrarle al usuario. */
  warnings: string[];
}

/**
 * Corta el texto en registros y celdas respetando comillas.
 *
 * Tolerancias a propósito (los CSV reales de Marce salen de Excel y de Sheets):
 * - Una comilla solo abre si la celda venía vacía. Así `5" x 3"` en una celda
 *   sin comillas se lee literal en vez de desbalancear todo el archivo.
 * - Una comilla solo cierra si lo que sigue es separador, salto de línea o fin.
 *   Una comilla suelta en el medio de un texto citado se guarda como carácter.
 * - `""` adentro de comillas es una comilla escapada (estándar CSV).
 */
function splitRecords(text: string, sep: Separator): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cur = "";
  let quoted = false;
  // Línea física del archivo (1-based) para poder decirle al usuario "fila N".
  // Un registro puede ocupar varias líneas si trae una celda multilínea.
  let lineNo = 1;
  let recordLine = 1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else if (next === undefined || next === sep || next === "\n") {
          quoted = false;
        } else {
          cur += '"';
        }
      } else {
        if (ch === "\n") lineNo++;
        cur += ch;
      }
      continue;
    }

    if (ch === '"' && cur === "") {
      quoted = true;
    } else if (ch === sep) {
      cells.push(cur);
      cur = "";
    } else if (ch === "\n") {
      cells.push(cur);
      records.push({ cells, line: recordLine });
      cells = [];
      cur = "";
      lineNo++;
      recordLine = lineNo;
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  records.push({ cells, line: recordLine });
  return records;
}

interface CsvRecord {
  cells: string[];
  /** Línea física (1-based) donde arranca el registro. */
  line: number;
}

/** Registro sin ninguna celda con contenido. */
function isBlank(cells: string[]): boolean {
  return cells.every((c) => c.trim() === "");
}

/**
 * Elige el separador probando los tres candidatos y quedándose con el que parte
 * la cabecera en más columnas. Los saltos de línea dentro de comillas no dependen
 * del separador, así que los tres recorridos ven los mismos registros.
 */
function detectSeparator(text: string): Separator {
  const candidates: Separator[] = [",", ";", "\t"];
  let best: Separator = ",";
  let bestCols = 0;
  for (const sep of candidates) {
    const first = splitRecords(text, sep)[0]?.cells ?? [];
    if (first.length > bestCols) {
      bestCols = first.length;
      best = sep;
    }
  }
  return best;
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const warnings: string[] = [];
  const separator = detectSeparator(clean);
  const records = splitRecords(clean, separator);

  if (records.length === 0 || isBlank(records[0].cells)) {
    return { headers: [], rows: [], lines: [], separator, warnings };
  }

  const rawHeaders = records[0].cells;
  const headers: string[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const h of rawHeaders) {
    const n = norm(h);
    if (n && seen.has(n)) {
      duplicates.push(h.trim());
      headers.push(""); // la repetida se ignora: gana la primera
      continue;
    }
    if (n) seen.add(n);
    headers.push(n);
  }
  if (duplicates.length)
    warnings.push(
      `Columnas repetidas en la cabecera (uso la primera de cada una): ${duplicates.join(", ")}.`,
    );

  const rows: Record<string, string>[] = [];
  const lines: number[] = [];
  let ragged = 0;
  let firstRagged = 0;

  // El registro 0 es la cabecera. `line` ya viene con la línea física real,
  // que no coincide con el índice cuando alguna celda es multilínea.
  for (let i = 1; i < records.length; i++) {
    const { cells, line } = records[i];
    if (isBlank(cells)) continue; // filas vacías al final del archivo
    if (cells.length > headers.length) {
      ragged++;
      if (!firstRagged) firstRagged = line;
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, c) => {
      if (h) obj[h] = (cells[c] ?? "").trim();
    });
    rows.push(obj);
    lines.push(line);
  }

  if (ragged)
    warnings.push(
      `${ragged} fila(s) traen más celdas que columnas tiene la cabecera (la primera, línea ${firstRagged}). ` +
        `Suele ser un separador "${separator === "\t" ? "tab" : separator}" suelto adentro de un texto sin comillas: revisá esas filas.`,
    );

  return { headers, rows, lines, separator, warnings };
}
