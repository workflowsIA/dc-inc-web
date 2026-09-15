/**
 * Guarda de instancia de Clerk, compartida por los scripts que tocan cuentas.
 *
 * Clerk tiene una instancia de DESARROLLO y otra de PRODUCCIÓN, con usuarios e
 * IDs distintos. `.env.local` tiene la de desarrollo (`sk_test_…`); la web real
 * corre con la de producción (`sk_live_…`, está en Vercel). Un script que
 * compara Sanity contra la instancia equivocada devuelve un informe que parece
 * válido y es basura: el 15-sep-2026 marcó 33 clientes reales como "borrados"
 * solo porque no existen en la instancia de prueba.
 *
 * La variable del shell le gana a la de `--env-file`, así que para correr
 * contra producción alcanza con anteponerla y la clave no queda escrita en
 * ningún archivo:
 *
 *   CLERK_SECRET_KEY=sk_live_… npm run <script>
 */

export type Instancia = "produccion" | "desarrollo" | "desconocida";

/** De qué instancia es esta clave. El prefijo lo define Clerk. */
export function instanciaDe(key: string): Instancia {
  if (key.startsWith("sk_live_")) return "produccion";
  if (key.startsWith("sk_test_")) return "desarrollo";
  return "desconocida";
}

/**
 * Devuelve la CLERK_SECRET_KEY de producción o corta el proceso.
 * `--dev` en la línea de comandos permite apuntar a la de prueba a propósito.
 */
export function exigirProduccion(comando: string): string {
  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  if (!secretKey) {
    console.error("Falta CLERK_SECRET_KEY.");
    process.exit(1);
  }
  const instancia = instanciaDe(secretKey);
  console.log(`Instancia de Clerk: ${instancia.toUpperCase()}\n`);
  if (instancia === "produccion" || process.argv.includes("--dev")) return secretKey;

  console.error(
    `Esta clave es de ${instancia}, no de producción.\n\n` +
      "Contra la instancia de prueba el resultado es engañoso: los clientes reales\n" +
      "aparecen como inexistentes porque viven en la otra instancia.\n\n" +
      "Sacá la clave de producción de Vercel y corré:\n" +
      `  CLERK_SECRET_KEY=sk_live_… ${comando}\n\n` +
      "Si de verdad querés trabajar contra la instancia de prueba, agregá --dev.",
  );
  process.exit(1);
}
