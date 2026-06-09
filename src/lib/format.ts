/** ARS money format — matches the wireframes' helper. */
export function ars(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}
