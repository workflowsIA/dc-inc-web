/**
 * CLI de la sincronización Sheet → Sanity (precios + stock).
 * La lógica vive en src/lib/sheet-sync.ts (la comparte el cron de Vercel).
 *
 * Env requeridas: GOOGLE_SERVICE_ACCOUNT_JSON · SANITY_API_WRITE_TOKEN
 *   (opcionales con default: SHEET_PRECIOS_ID · SHEET_INVENTARIO_ID)
 *
 * Uso:
 *   npm run sync:sheet -- --dry-run    # muestra qué cambiaría, no escribe
 *   npm run sync:sheet                 # aplica los cambios en Sanity
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runSheetSync } from "../src/lib/sheet-sync";

const DRY_RUN = process.argv.includes("--dry-run");

/** Escribe reports/skus-sin-match.csv con el detalle de los productos cuyo SKU
 *  no matchea ninguna fila de las planillas. Se regenera en cada corrida.
 *  Estos productos quedan AFUERA del sync a propósito (SKU basura del import de Wix);
 *  ver entregables/skus-sin-match-sanity.md en el vault para el contexto y plan. */
function escapeCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function writeNoMatchReport(
  details: { _id: string; sku: string; name: string; slug: string }[],
): string {
  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "skus-sin-match.csv");
  const header =
    "# SKUs en Sanity sin match en las planillas (precios/inventario).\n" +
    "# Quedan AFUERA del sync a proposito (SKU basura del import de Wix).\n" +
    "# Generado por npm run sync:sheet. Contexto/plan: entregables/skus-sin-match-sanity.md\n" +
    `# Generado: ${new Date().toISOString()} - Total: ${details.length}\n` +
    "sku,name,slug,_id\n";
  const rows = details
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((d) => [d.sku, d.name, d.slug, d._id].map(escapeCsv).join(","))
    .join("\n");
  writeFileSync(path, header + rows + "\n", "utf-8");
  return path;
}

async function main() {
  console.log(`\n🔄 Sync Sheet → Sanity${DRY_RUN ? " (DRY RUN)" : ""}\n`);
  const r = await runSheetSync({ dryRun: DRY_RUN });
  console.log(`   Precios leídos:      ${r.pricesRead} SKUs`);
  console.log(`   Inventario leído:    ${r.stockRead} SKUs`);
  console.log(`   Productos en Sanity: ${r.productsInSanity}\n`);
  if (DRY_RUN && r.changes) {
    for (const c of r.changes) {
      console.log(`   ${c.sku.padEnd(16)} ${JSON.stringify(c.set)}`);
    }
  }
  console.log(
    `\n✅ Actualizados: ${r.patched} · sin cambios: ${r.skipped} · sin match en planilla: ${r.noMatch.length}`,
  );
  if (r.createdDrafts.length) {
    console.log(
      `\n🆕 SKUs nuevos en la planilla → ${DRY_RUN ? "se crearían" : "creados"} como BORRADOR (${r.createdDrafts.length}):`,
    );
    for (const d of r.createdDrafts) console.log(`   ${d.sku.padEnd(16)} ${d.name}`);
    console.log(
      "   → Studio: Catálogo → Productos → «Nuevos desde la planilla» (completar foto/categoría y publicar).",
    );
  }
  if (r.unlinkedVariants.length) {
    console.log(
      `\n⚠️  Filas de presentación (UxB > 1) sin fila base en la planilla (${r.unlinkedVariants.length}) — no se ofrecen en la web:`,
    );
    for (const u of r.unlinkedVariants)
      console.log(`   ${u.sku.padEnd(18)} ${String(u.unitsPerBulk ?? "").padStart(6)} u  ${u.name}`);
    console.log("   → Revisar con Marce: SKU mal formado o falta la fila Unidad de ese producto.");
  }
  if (r.noMatch.length) {
    console.log(
      `   (SKUs en Sanity sin fila en las planillas: ${r.noMatch.slice(0, 20).join(", ")}${r.noMatch.length > 20 ? "…" : ""})`,
    );
    const reportPath = writeNoMatchReport(r.noMatchDetails);
    console.log(`   📄 Detalle completo → ${reportPath}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌ Sync falló:", err.message);
  process.exit(1);
});
