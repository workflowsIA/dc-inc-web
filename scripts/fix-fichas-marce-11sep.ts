/**
 * Arreglos de fichas que salieron de la devolución de Marce del 11-sep-2026
 * (thread "Sobre web"). Son cuatro documentos de Sanity que quedaron con el
 * nombre o el SKU de OTRO producto —herencia del import de Wix— y que por eso
 * se pisaban entre ellos en la web.
 *
 * 1. PRECINTOS. En la planilla la verdad es: el de 61 mm viene en CRISTAL
 *    (PTT61) y en COLORES (PTC61, con paquetes negro / plata / dorado), y el
 *    de 50 mm (PTTC50) es OTRO modelo (alto 30 × diám 30). En la web había dos
 *    fichas diciendo las dos "61x45 mm" y la de colores llevaba el SKU del de
 *    50. Marce: "la verdad está en la hoja ProductosDC-Todos. 50x30 es otro
 *    modelo de precinto. el que hay en cristal y otros colores es el 61x45".
 *      → PTTC50 pasa a llamarse 50x30 (libera el slug de colores).
 *      → se crea PTC61, el de colores, que no existía en Sanity. Sus tres
 *        colores son filas de la planilla (PTC61BN / BP / BD) y entran solos
 *        como presentaciones "Paquete · Negro / Plata / Dorado" en el próximo
 *        sync: no hay que cargarlos a mano.
 *
 * 2. VASO SEELZE. Estaba dos veces con el mismo nombre Y el mismo slug. Marce:
 *    "es uno solo". El Seelze de verdad es RIPS0360 (caja x48); el otro
 *    documento tiene el SKU B360AMAF63, que en la planilla es
 *    "360 ml - AMANECER Frasco - Vidrio FLINT - B/T OFF 63". O sea: no es un
 *    duplicado para borrar, es un frasco con la ficha de un vaso.
 *
 * 3. COPA FLORIDA. Mismo caso, ya detectado en el mail: la copa de verdad es
 *    NAF0300 y el documento BITFLINTPACKPIL1 —que es el pack de bitter flint
 *    con tapa pilfer— quedó con su nombre y su slug.
 *
 * Lo que NO hace este script, a propósito:
 *   · No toca precios ni stock: eso lo escribe el sync desde la planilla.
 *   · No toca fotos ni descripciones. La descripción del que pasa a 50x30
 *     quedó redactada para el de 61 mm (habla de 61 mm de ancho y 45 de largo)
 *     y hay que reescribirla con Marce; el de colores nuevo va sin foto hasta
 *     que la mande.
 *   · No cambia categorías. El frasco Amanecer queda en "Copas y vasos", que
 *     tampoco corresponde, pero eso se define con Marce.
 *
 * Uso (desde la Mac, que es la que tiene red a Sanity):
 *   cd ~/Documents/Claude/Projects/DC\ INC/dc-inc-web && npx tsx --env-file=.env.local scripts/fix-fichas-marce-11sep.ts --dry-run
 *   cd ~/Documents/Claude/Projects/DC\ INC/dc-inc-web && npx tsx --env-file=.env.local scripts/fix-fichas-marce-11sep.ts
 *
 * Es idempotente: si ya está aplicado, no vuelve a escribir nada.
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");

interface Doc {
  _id: string;
  sku?: string;
  name?: string;
  slug?: { current?: string };
  category?: unknown;
}

/** Renombres: SKU → nombre y slug que le corresponden según la planilla. */
const RENOMBRES: { sku: string; name: string; slug: string; porque: string }[] = [
  {
    sku: "PTTC50",
    name: "Precinto termocontraible 50x30 mm - Cristal - botellas",
    slug: "precinto-termocontraible-50x30-mm-cristal-botellas",
    porque:
      'tenía el nombre del de colores ("61x45 mm - Colores") con el SKU del de 50 mm',
  },
  {
    sku: "B360AMAF63",
    name: "Frasco Amanecer 360 ml - Flint",
    slug: "frasco-amanecer-360-ml-flint",
    porque: 'estaba publicado como "Vaso Seelze 360 ml", con el mismo slug que el Seelze real',
  },
  {
    sku: "BITFLINTPACKPIL1",
    name: "Pack Botella Bitter Flint 750 ml - Pilfer",
    slug: "pack-botella-bitter-flint-750-ml-pilfer",
    porque: 'estaba publicado como "Copa Florida 300 ml", con el mismo slug que la copa real',
  },
];

/**
 * Ficha nueva: el precinto de colores. Va con los datos mínimos para que se
 * pueda publicar; el precio y las presentaciones por color los completa el
 * sync en la próxima corrida (la fila PTC61 ya está en la planilla).
 */
const NUEVO = {
  _id: "product-PTC61",
  _type: "product" as const,
  sku: "PTC61",
  name: "Precinto termocontraible 61x45 mm - Colores - botellas",
  slug: { _type: "slug" as const, current: "precinto-termocontraible-61x45-mm-colores-botellas" },
  category: { _type: "reference" as const, _ref: "category-tapas" },
  deliveryTime: "24-48 hs",
  decoAvailable: true,
  description:
    "• Precinto de PVC reciclable\n" +
    "• Disponible en negro, plata y dorado\n" +
    "• Ideal para bocas de botella con hasta 3,5 cm de diámetro\n" +
    '• Con troquel "abrefácil"\n' +
    "• Ancho aplastado de 61 mm\n" +
    "• Largo 45 mm\n" +
    "Este insumo es util para la seguridad y estética de tu producto.\n" +
    "Tenemos la posibilidad de hacer el precinto que se adapte a tu medida a partir de cierta cantidad, consultar.\n" +
    "Tambien podemos personalizarlos a partir de 40000 unidades, consultar.\n" +
    "Precios sujetos a dólar billete del día Banco Nacion. Se fija cotización a partir de acreditación de pago.",
  // Semilla: el sync los pisa con los de la planilla en la próxima corrida.
  pricePublic: 52,
  priceWholesale: 52,
  unitsPerBulk: 1,
  fromSheet: true,
};

async function main() {
  console.log(`\n🔧 Fichas — devolución Marce 11-sep${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // --- 1) Renombres -------------------------------------------------------
  const skus = RENOMBRES.map((r) => r.sku);
  const docs = await sanityWriteClient.fetch<Doc[]>(
    `*[_type == "product" && sku in $skus && !(_id in path("drafts.**"))]{_id, sku, name, slug}`,
    { skus },
  );

  for (const r of RENOMBRES) {
    const d = docs.find((x) => x.sku === r.sku);
    if (!d) {
      console.log(`   ⚠️  ${r.sku.padEnd(18)} no está publicado en Sanity — se saltea`);
      continue;
    }
    if (d.name === r.name && d.slug?.current === r.slug) {
      console.log(`   ✓  ${r.sku.padEnd(18)} ya estaba bien`);
      continue;
    }
    console.log(`   →  ${r.sku.padEnd(18)} "${d.name}" → "${r.name}"`);
    console.log(`      ${"".padEnd(18)} /${d.slug?.current} → /${r.slug}`);
    console.log(`      ${"".padEnd(18)} ${r.porque}`);
    if (!DRY_RUN) {
      await sanityWriteClient
        .patch(d._id)
        .set({ name: r.name, slug: { _type: "slug", current: r.slug } })
        .commit();
    }
  }

  // --- 2) Alta del precinto de colores ------------------------------------
  const yaEsta = await sanityWriteClient.fetch<Doc | null>(
    `*[_type == "product" && sku == $sku][0]{_id, sku, name, slug}`,
    { sku: NUEVO.sku },
  );
  if (yaEsta) {
    console.log(`\n   ✓  ${NUEVO.sku.padEnd(18)} ya existe (${yaEsta._id}) — no se crea`);
  } else {
    console.log(`\n   +  ${NUEVO.sku.padEnd(18)} alta: "${NUEVO.name}"`);
    console.log(`      ${"".padEnd(18)} /${NUEVO.slug.current} — sin foto (falta que la mande Marce)`);
    if (!DRY_RUN) await sanityWriteClient.createIfNotExists(NUEVO);
  }

  console.log(
    DRY_RUN
      ? "\nDRY RUN: no se escribió nada. Sacá --dry-run para aplicarlo.\n"
      : "\nListo. Corré el sync (npm run sync:sheet) para que el precinto de colores\n" +
          "tome precio y sus paquetes por color.\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
