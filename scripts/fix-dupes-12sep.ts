/**
 * Limpieza de duplicados y SKUs repunteados — 12-sep-2026.
 *
 * Sale del diagnóstico de `npm run sku:find-dupes` (3 clusters confirmados +
 * 18 a revisar a mano) y de dos mails de Marce del mismo día: "en sanity no
 * puedo borrar productos, estoy queriendo borrar algunos que están duplicados"
 * y "este artículo tiene presentación paquete x6 unidades pero esto no aparece
 * en la web".
 *
 * Los 18 "a revisar" no eran 18 problemas distintos: son tres patrones.
 *
 * 1. REPUNTEO DE SKU. La ficha buena —la que migró de Wix, con foto y con la
 *    URL que Google ya tiene indexada— quedó con un SKU que Marce cambió en la
 *    planilla. El sync dejó de alimentarla (aparece en "sin match") y creó el
 *    SKU nuevo como borrador aparte, con los precios y las presentaciones
 *    adentro. Por eso el paquete x6 de la tapa growler existe pero no se ve.
 *    La solución es la que pidió Marce: quedarse con la ficha de Wix y
 *    apuntarle el SKU nuevo. No se publica el borrador: se borra.
 *
 * 2. NOMBRES CRUZADOS. Dos fichas publicadas con el nombre de la otra. Los
 *    copones Aruba: la que tiene SKU NABA0345 se llama "alto 465" y la que
 *    tiene NAAA0465 se llama "bajo 345" — cruzadas en el nombre Y en la
 *    capacidad, así que no hay ambigüedad sobre cuál es cuál. Y la Copa Cata
 *    importada (ARCN0215) se quedó con el nombre genérico y comparte URL con
 *    la nacional (PRCN0215), que sí quedó renombrada.
 *
 * 3. GEMELOS DEL SUFIJO. Borradores que el sync creó en su momento con el SKU
 *    viejo (…U, …1, …UN) y que quedaron al lado del que hoy trae la planilla.
 *    Ninguno tiene foto ni fue publicado nunca: se borran.
 *
 * Lo que NO hace: no toca la tapa growler SIN cono (TGRPSC), que es un
 * producto nuevo de verdad y necesita foto y categoría antes de publicarse.
 *
 * Uso:
 *   cd ~/Documents/Claude/Projects/DC\ INC/dc-inc-web && npx tsx --env-file=.env.local scripts/fix-dupes-12sep.ts --dry-run
 *   cd ~/Documents/Claude/Projects/DC\ INC/dc-inc-web && npx tsx --env-file=.env.local scripts/fix-dupes-12sep.ts
 *
 * Es idempotente. Sanity rechaza el borrado de un documento referenciado (por
 * ejemplo en un pedido): eso se reporta y sigue con el resto.
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");

interface Doc {
  _id: string;
  sku?: string;
  name?: string;
  slug?: { current?: string };
}

/** Fichas publicadas cuyo SKU hay que apuntar al de la planilla. */
const REPUNTEOS: { from: string; to: string; porque: string }[] = [
  {
    from: "TGRP",
    to: "TGRPCC",
    porque:
      "Marce abrió la tapa growler en con cono / sin cono; la ficha publicada quedó con el SKU viejo y sin la presentación Paquete x6",
  },
  {
    from: "BBSLA700FU",
    to: "BBSLA700F",
    porque: "la planilla le sacó la U final; la ficha publicada quedó sin match",
  },
];

/** Fichas publicadas con el nombre o la URL de otro producto. */
const RENOMBRES: { sku: string; name: string; slug: string; porque: string }[] = [
  {
    sku: "NAAA0465",
    name: "Copon s/pie alto Aruba 465 ml",
    slug: "copon-s-pie-alto-aruba-465-ml",
    porque: "estaba con el nombre del bajo de 345; el SKU y la capacidad dicen alto 465",
  },
  {
    sku: "NABA0345",
    name: "Copon s/pie bajo Aruba 345 ml",
    slug: "copon-s-pie-bajo-aruba-345-ml",
    porque: "estaba con el nombre del alto de 465; el SKU y la capacidad dicen bajo 345",
  },
  {
    sku: "ARCN0215",
    name: "Copa Cata Normalizada Importada 215 ml",
    slug: "copa-cata-normalizada-importada-215-ml",
    porque:
      "es la importada (así figura en la planilla) y compartía nombre y URL con la nacional",
  },
];

/**
 * Borradores gemelos, por SKU: son los `drafts.product-sheet-<SKU>` que el
 * sync creó con un SKU que la planilla ya no usa (o que duplican una ficha
 * publicada). Ninguno tiene foto.
 */
const GEMELOS = [
  // Confirmados por find-sku-suffix-dupes
  "NAF0300UN",
  "RIPS0360UN",
  "PRCN0215UN",
  // Packs: la planilla los tiene con "1" final y en Sanity el SKU va pelado
  "BITFLINTPACKAL1",
  "GUAFLINTPACK1",
  // Botellas: la planilla les sacó la U final
  "BVEBO0750HU",
  "BVEBO0750VU",
  "BVEBU0750FU",
  "BVEES0750FU",
  "BVEES0750VU",
  // Cajas de cartón: la planilla les sacó el 1 final
  "C110LGX24CI1",
  "C70B500X12CF1",
  "C70B500X6CA1",
  "C70B500X6CF1",
  "C70LGX12CI1",
  "C70LGX24CI1",
  // Copones Aruba: gemelos de las dos fichas publicadas que arriba se destraban
  "NAAA0465UN",
  "NABA0345UN",
  // Gemelo con el MISMO sku que su ficha publicada
  "PWCH0670",
  // Los dos lados del repunteo de la Livi Ana
  "BBSLA700FU",
  "BBSLA700F",
  // El repunteo de la tapa growler con cono
  "TGRPCC",
];

async function main() {
  console.log(`\n🧹 Duplicados y SKUs repunteados${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // --- 1) Repunteo de SKU en la ficha publicada --------------------------
  console.log("— Fichas publicadas que cambian de SKU");
  for (const r of REPUNTEOS) {
    const pub = await sanityWriteClient.fetch<Doc | null>(
      `*[_type == "product" && sku == $sku && !(_id in path("drafts.**"))][0]{_id, sku, name}`,
      { sku: r.from },
    );
    if (!pub) {
      const ya = await sanityWriteClient.fetch<Doc | null>(
        `*[_type == "product" && sku == $sku && !(_id in path("drafts.**"))][0]{_id, sku}`,
        { sku: r.to },
      );
      console.log(
        ya
          ? `   ✓  ${r.from.padEnd(14)} ya estaba repunteado a ${r.to}`
          : `   ⚠️  ${r.from.padEnd(14)} no hay ficha publicada con ese SKU — se saltea`,
      );
      continue;
    }
    console.log(`   →  ${r.from.padEnd(14)} → ${r.to}   "${pub.name}"`);
    console.log(`      ${"".padEnd(14)}   ${r.porque}`);
    if (!DRY_RUN) await sanityWriteClient.patch(pub._id).set({ sku: r.to }).commit();
  }

  // --- 2) Nombres y URLs cruzados ----------------------------------------
  console.log("\n— Fichas publicadas con el nombre o la URL de otro producto");
  for (const r of RENOMBRES) {
    const d = await sanityWriteClient.fetch<Doc | null>(
      `*[_type == "product" && sku == $sku && !(_id in path("drafts.**"))][0]{_id, sku, name, slug}`,
      { sku: r.sku },
    );
    if (!d) {
      console.log(`   ⚠️  ${r.sku.padEnd(14)} no está publicado — se saltea`);
      continue;
    }
    if (d.name === r.name && d.slug?.current === r.slug) {
      console.log(`   ✓  ${r.sku.padEnd(14)} ya estaba bien`);
      continue;
    }
    console.log(`   →  ${r.sku.padEnd(14)} "${d.name}" → "${r.name}"`);
    console.log(`      ${"".padEnd(14)} /${d.slug?.current} → /${r.slug}`);
    console.log(`      ${"".padEnd(14)} ${r.porque}`);
    if (!DRY_RUN) {
      await sanityWriteClient
        .patch(d._id)
        .set({ name: r.name, slug: { _type: "slug", current: r.slug } })
        .commit();
    }
  }

  // --- 3) Borrado de los borradores gemelos -------------------------------
  console.log("\n— Borradores gemelos (ninguno publicado, ninguno con foto)");
  let borrados = 0;
  let inexistentes = 0;
  for (const sku of GEMELOS) {
    const id = `drafts.product-sheet-${sku.replace(/[^A-Za-z0-9._-]/g, "-")}`;
    // perspective:"raw" es obligatorio para VER borradores: la apiVersion del
    // cliente (2026-01-01) usa "published" por defecto y los filtra, así que
    // sin esto todos los gemelos parecen inexistentes. Mismo truco que usa
    // scripts/find-sku-suffix-dupes.ts.
    const d = await sanityWriteClient.fetch<Doc | null>(
      `*[_id == $id][0]{_id, sku, name}`,
      { id },
      { perspective: "raw" },
    );
    if (!d) {
      inexistentes++;
      continue;
    }
    console.log(`   🗑️  ${sku.padEnd(18)} ${d.name ?? ""}`);
    if (!DRY_RUN) {
      try {
        await sanityWriteClient.delete(id);
        borrados++;
      } catch (e) {
        console.log(`      ⚠️  no se pudo borrar: ${(e as Error).message}`);
      }
    } else {
      borrados++;
    }
  }
  console.log(`   ${borrados} para borrar · ${inexistentes} ya no existían`);

  console.log(
    DRY_RUN
      ? "\nDRY RUN: no se escribió nada. Sacá --dry-run para aplicarlo.\n"
      : "\nListo. Corré el sync (npm run sync:sheet) para que las fichas repunteadas\n" +
          "tomen precio y presentaciones, y volvé a correr npm run sku:find-dupes para\n" +
          "confirmar que no queda ningún cluster.\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
