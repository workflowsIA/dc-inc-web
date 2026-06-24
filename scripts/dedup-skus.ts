/**
 * Borra de Sanity los productos DUPLICADOS detectados en el triage
 * (reports/sku-fix-eliminar.csv: mismo nombre que otro producto que sí queda).
 *
 * Uso:
 *   npm run sku:dedup -- --dry-run   # lista qué borraría, no toca nada
 *   npm run sku:dedup                # borra en Sanity
 *
 * Seguridad: Sanity rechaza el delete si el doc está referenciado (p.ej. en un
 * pedido). En ese caso lo reporta y sigue, no rompe el resto.
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
  console.log(`\n🗑️  Borrar productos duplicados${DRY_RUN ? " (DRY RUN)" : ""}\n`);
  const path = join(process.cwd(), "reports", "sku-fix-eliminar.csv");
  const rows = parseCsv(readFileSync(path, "utf-8")).filter((r) => r._id);
  console.log(`   Duplicados a borrar: ${rows.length}\n`);

  let ok = 0;
  const blocked: string[] = [];
  for (const r of rows) {
    if (DRY_RUN) {
      console.log(`   ${r.name.padEnd(42)} (${r._id})`);
      continue;
    }
    try {
      await sanityWriteClient.delete(r._id);
      console.log(`   ✓ ${r.name}`);
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      blocked.push(`${r.name} → ${msg.slice(0, 80)}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n(DRY RUN — no se borró nada. Quitá --dry-run para aplicar.)\n`);
  } else {
    console.log(`\n✅ Borrados: ${ok}/${rows.length}`);
    if (blocked.length) {
      console.log(`⚠️  Bloqueados (referenciados, borrar a mano):`);
      blocked.forEach((b) => console.log(`   - ${b}`));
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
