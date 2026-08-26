/**
 * Búsqueda tolerante del catálogo (buscador del header + /productos?q=).
 *
 * Antes se comparaba la frase entera con `includes`: "botella 500" no
 * encontraba "Botella R - 500 ml" porque el texto no contiene esa secuencia
 * exacta. Ahora la consulta se parte en palabras y CADA palabra tiene que
 * aparecer en el texto del producto (nombre + SKU + categoría + subtipo), en
 * cualquier orden. Se ignoran acentos, mayúsculas y signos ("500ml" también
 * matchea "500 ml").
 */

/** Minúsculas, sin acentos, signos → espacio. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palabras de la consulta ya normalizadas (vacías descartadas). */
export function searchTokens(q: string): string[] {
  return normalizeSearch(q).split(" ").filter(Boolean);
}

/**
 * true si TODAS las palabras de la consulta aparecen en `haystack`.
 * `haystack` puede venir crudo: se normaliza acá. Consulta vacía → true.
 */
export function matchesSearch(haystack: string, q: string | string[]): boolean {
  const tokens = Array.isArray(q) ? q : searchTokens(q);
  if (tokens.length === 0) return true;
  const hay = normalizeSearch(haystack);
  // Versión sin espacios para que "500ml" pegue con "500 ml" y viceversa.
  const hayTight = hay.replace(/ /g, "");
  return tokens.every((t) => hay.includes(t) || hayTight.includes(t.replace(/ /g, "")));
}

/**
 * Puntaje para ordenar resultados: primero los que matchean al principio del
 * nombre, después los que tienen todas las palabras en el nombre, después el
 * resto (match por SKU/categoría). Mayor = mejor.
 */
export function searchScore(name: string, q: string | string[]): number {
  const tokens = Array.isArray(q) ? q : searchTokens(q);
  if (tokens.length === 0) return 0;
  const n = normalizeSearch(name);
  let score = 0;
  if (n.startsWith(tokens[0])) score += 4;
  if (tokens.every((t) => n.includes(t))) score += 2;
  if (n === tokens.join(" ")) score += 8;
  return score;
}
