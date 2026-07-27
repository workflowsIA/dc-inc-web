/**
 * Carga masiva de logos de clientes (la "vidriera" de marcas del home / Nosotros).
 *
 * Lee una carpeta con imágenes (PNG/JPG/WEBP), sube cada una como asset a Sanity
 * y crea un documento `client` con:
 *   - name   = nombre del archivo sin extensión (ej: "Partha.png" → "Partha")
 *   - logo   = la imagen subida
 *   - active = true
 *   - order  = orden alfabético de carga (continúa después de los que ya existan)
 *
 * Idempotente: si ya existe un `client` con ese nombre (sin distinguir mayúsculas/
 * acentos), lo saltea (no duplica). Para renombrar/reordenar/desactivar después, se
 * edita en el Studio → Contenido del sitio → "Marcas con las que trabajamos".
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/import-client-logos.ts --dir=/ruta/logos --dry-run
 *   npx tsx --env-file=.env.local scripts/import-client-logos.ts --dir=/ruta/logos
 *
 * Env: SANITY_API_WRITE_TOKEN (ya está en .env.local).
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");
const dirArg = process.argv.find((a) => a.startsWith("--dir="));
const DIR = dirArg ? dirArg.split("=")[1] : "";

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

async function main() {
  if (!DIR) {
    console.error("Falta --dir=/ruta/a/logos");
    process.exit(1);
  }
  const files = readdirSync(DIR)
    .filter((f) => MIME[extname(f).toLowerCase()])
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    console.error(`No encontré imágenes (png/jpg/webp) en ${DIR}`);
    process.exit(1);
  }
  console.log(`[logos] DRY_RUN=${DRY_RUN} · ${files.length} imágenes en ${DIR}`);

  const existing = await sanityWriteClient.fetch<{ name: string }[]>(
    `*[_type == "client" && defined(name)]{ name }`,
  );
  const known = new Set(existing.map((c) => norm(c.name)));

  let created = 0;
  const skipped: string[] = [];
  let order = existing.length;

  for (const file of files) {
    const name = basename(file, extname(file)).trim();
    if (known.has(norm(name))) {
      skipped.push(name);
      continue;
    }
    if (DRY_RUN) {
      console.log(`(dry-run) crearía cliente: "${name}"  ← ${file}`);
      created++;
      continue;
    }
    const ext = extname(file).toLowerCase();
    const buf = readFileSync(join(DIR, file));
    const asset = await sanityWriteClient.assets.upload("image", buf, {
      filename: file,
      contentType: MIME[ext],
    });
    await sanityWriteClient.create({
      _type: "client",
      name,
      active: true,
      order: order++,
      logo: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
    });
    known.add(norm(name));
    created++;
    console.log(`✓ cliente creado: "${name}"`);
  }

  console.log("\n— Resumen —");
  console.log(`${DRY_RUN ? "A crear" : "Creados"}: ${created}`);
  if (skipped.length) console.log(`Salteados (ya existían): ${skipped.length} → ${skipped.join(", ")}`);
  if (DRY_RUN) console.log("\nDry-run. Para cargar de verdad, sacá --dry-run.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
