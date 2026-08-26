/**
 * Cantidad de unidades de una presentación a partir de su etiqueta
 * ("24un en Caja", "Pallet x 2.025", "Caja 12 u (500 ml)").
 *
 * Antes se tomaba el PRIMER número que apareciera en el texto: una etiqueta
 * como "500 ml x 24 en Caja" daba 500 unidades por caja (y un total de caja
 * de $1M+). Ahora:
 *   - se ignoran los números seguidos de una medida (ml, cc, l, cl, mm, cm,
 *     g, gr, kg, oz, %);
 *   - se prefiere el número acompañado de "u"/"un"/"unid"/"unidades"/"piezas"
 *     o precedido de "x";
 *   - si no hay ninguno así, el último número que quede.
 * Devuelve 1 si no encuentra nada (unidad).
 */
const MEASURE = /^(ml|cc|cl|lt?|mm|cm|gr?|kg|oz|%)/i;
const UNIT_WORD = /^(u|un|unid|unids|unidad|unidades|pz|pzas|piezas|bot|botellas|latas|copas|vasos)\b/i;

export function parsePresentationUnits(label: string): number {
  if (!label) return 1;
  // "2.025" → "2025" (miles con punto). No tocamos "0,5" ni decimales con coma.
  const s = label.replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2");
  const re = /(\d+)/g;
  const candidates: { n: number; unitWord: boolean; afterX: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const after = s.slice(m.index + m[1].length).replace(/^\s+/, "");
    const before = s.slice(0, m.index).replace(/\s+$/, "");
    if (MEASURE.test(after)) continue; // "500 ml" → medida, no cantidad
    candidates.push({
      n,
      unitWord: UNIT_WORD.test(after),
      afterX: /[x×]$/i.test(before),
    });
  }
  if (!candidates.length) return 1;
  const strong = candidates.find((c) => c.unitWord || c.afterX);
  return (strong ?? candidates[candidates.length - 1]).n;
}
