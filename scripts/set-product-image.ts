/**
 * Cambia la foto principal de un producto: sube el archivo a Sanity como asset
 * y lo deja como `images[0]`.
 *
 * Nació del reporte de Marce del 10-sep-2026 (la Guarda Verde mostraba una
 * botella que no era; venía compartiendo foto con la Borgoña desde Wix), pero
 * es genérico a propósito: sirve para ir cargando las fichas sin foto que
 * lista `npm run fichas:audit`.
 *
 * Toca TODOS los documentos con ese SKU — el publicado y su borrador si existe —
 * para que no quede la foto vieja escondida en el draft.
 *
 * Uso:
 *   npm run producto:foto -- --sku=BOW750VG --file="../fotos/botella-guarda-verde-750.jpg"
 *   npm run producto:foto -- --sku=BOW750VG --file=... --dry-run
 *
 * Env: SANITY_API_WRITE_TOKEN.
 */
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { sanityWriteClient } from "../src/lib/sanity";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const sku = arg("sku");
  const file = arg("file");
  const dryRun = process.argv.includes("--dry-run");
  if (!sku || !file) {
    console.error('Uso: npm run producto:foto -- --sku=SKU --file=ruta/a/la/foto.jpg [--dry-run]');
    process.exit(1);
  }

  const path = resolve(process.cwd(), file);
  const buf = readFileSync(path);

  // perspective raw = también el borrador, si lo hay.
  const docs = await sanityWriteClient.fetch<{ _id: string; name?: string }[]>(
    `*[_type == "product" && sku == $sku]{ _id, name }`,
    { sku },
    { perspective: "raw" },
  );
  if (docs.length === 0) {
    console.error(`No hay ningún producto con SKU ${sku}.`);
    process.exit(1);
  }

  console.log(`\n📷 ${sku} — ${docs[0].name ?? "(sin nombre)"}`);
  console.log(`   archivo: ${path} (${Math.round(buf.length / 1024)} KB)`);
  for (const d of docs) console.log(`   documento: ${d._id}`);
  if (dryRun) {
    console.log("\n   --dry-run: no se subió ni se modificó nada.\n");
    return;
  }

  const asset = await sanityWriteClient.assets.upload("image", buf, {
    filename: basename(path),
  });
  console.log(`   asset subido: ${asset._id}`);

  const tx = sanityWriteClient.transaction();
  for (const d of docs) {
    tx.patch(d._id, (p) =>
      p.set({
        images: [
          {
            _type: "image",
            _key: `img-${asset._id.slice(-8)}`,
            asset: { _type: "reference", _ref: asset._id },
          },
        ],
      }),
    );
  }
  await tx.commit();
  console.log(`   ✅ foto actualizada en ${docs.length} documento(s).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
