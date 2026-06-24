/**
 * Aplica las correcciones de SKU a Sanity: lee reports/sku-fix-aplicar.csv
 * (_id, sku_nuevo) y setea el campo `sku` de cada producto.
 *
 * La lista la genera el triage (propose-sku-fix.ts → revisión → dedup). Solo
 * incluye códigos únicos (sin colisiones); los conflictivos van a sku-fix-revisar.csv.
 *
 * Uso:
 *   npm run sku:apply -- --dry-run   # muestra qué cambiaría, no escribe
 *   npm run sku:apply                # aplica en Sanity
 *
 * Env: SANITY_API_WRITE_TOKEN.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    // parser simple con soporte de comillas
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
      } else if (ch === "," && !q) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = (cells[i] ?? "").trim()));
    return row;
  });
}

async function main() {
  console.log(`\n🔧 Aplicar correcciones de SKU${DRY_RUN ? " (DRY RUN)" : ""}\n`);
  const path = join(process.cwd(), "reports", "sku-fix-aplicar.csv");
  const rows = parseCsv(readFileSync(path, "utf-8")).filter(
    (r) => r._id && r.sku_nuevo,
  );
  console.log(`   Correcciones a aplicar: ${rows.length}\n`);

  // chequeo de seguridad: que no haya sku_nuevo duplicado
  const seen = new Map<string, string>();
  const dups: string[] = [];
  for (const r of rows) {
    if (seen.has(r.sku_nuevo)) dups.push(r.sku_nuevo);
    seen.set(r.sku_nuevo, r._id);
  }
  if (dups.length) {
    console.error(`❌ Hay SKUs duplicados en la lista: ${dups.join(", ")}. Abortado.`);
    process.exit(1);
  }

  const tx = sanityWriteClient.transaction();
  for (const r of rows) {
    if (DRY_RUN) {
      console.log(`   ${r.name.padEnd(40)} → ${r.sku_nuevo}`);
    } else {
      tx.patch(r._id, (p) => p.set({ sku: r.sku_nuevo }));
    }
  }

  if (!DRY_RUN) {
    await tx.commit({ visibility: "async" });
    console.log(`✅ ${rows.length} SKUs corregidos en Sanity.`);
    console.log("   Corré 'npm run sync:sheet' para que tomen stock/precio.\n");
  } else {
    console.log(`\n(DRY RUN — no se escribió nada. Quitá --dry-run para aplicar.)\n`);
  }
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
