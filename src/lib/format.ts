/** ARS money format — matches the wireframes' helper. */
export function ars(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

/** Strip de HTML defensivo (por si la descripción todavía viene con tags de Wix). */
export function plainText(s: string): string {
  return s
    .replace(/<\s*\/(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}
