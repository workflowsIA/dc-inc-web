/**
 * Migra las imágenes de los productos desde el CDN de Wix al CDN de Sanity.
 *
 * Recorre todos los productos que tienen `legacyImageUrl` (URL Wix) pero no
 * tienen `images[]` cargadas, descarga la imagen, la sube como asset al CDN
 * de Sanity, y la setea en `images[0]`. Después podemos darle de baja a Wix
 * sin perder los packshots.
 *
 * Uso:
 *   npm run migrate:images -- --dry-run    # cuántas migrarían
 *   npm run migrate:images                 # migra todas
 *   npm run migrate:images -- --limit=20   # solo las primeras 20 (para probar)
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

interface ProductRow {
  _id: string;
  name: string;
  sku: string;
  legacyImageUrl?: string;
  hasImage: boolean;
}

const query = `*[_type == "product" && defined(legacyImageUrl) && !defined(images[0])][0...$limit] {
  _id, name, sku, legacyImageUrl, "hasImage": defined(images[0])
}`;

async function main() {
  process.stdout.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EPIPE") process.exit(0);
  });
  console.log(`[images] DRY_RUN=${DRY_RUN} LIMIT=${LIMIT}`);

  const products: ProductRow[] = await sanityWriteClient.fetch(query, {
    limit: Number.isFinite(LIMIT) ? LIMIT : 10_000,
  });
  console.log(`[images] ${products.length} productos con imagen pendiente`);

  let migrated = 0;
  let failed = 0;

  for (const p of products) {
    if (!p.legacyImageUrl) continue;
    const tag = `${p.sku} (${p.name.slice(0, 40)})`;
    try {
      if (DRY_RUN) {
        console.log(`[DRY] ${tag} ← ${p.legacyImageUrl}`);
        continue;
      }
      // Descarga
      const res = await fetch(p.legacyImageUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      // Nombre de archivo razonable
      const ext = p.legacyImageUrl.match(/\.(jpe?g|png|webp|gif)/i)?.[1] ?? "jpg";
      const filename = `${p.sku || p._id}.${ext}`.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
      // Subir asset
      const asset = await sanityWriteClient.assets.upload("image", buf, {
        filename,
        contentType: res.headers.get("content-type") ?? `image/${ext}`,
      });
      // Actualizar el producto con el asset
      await sanityWriteClient
        .patch(p._id)
        .set({
          images: [
            {
              _key: asset._id.slice(0, 12),
              _type: "image",
              asset: { _type: "reference", _ref: asset._id },
            },
          ],
        })
        .commit();
      migrated++;
      if (migrated % 10 === 0) {
        console.log(`[images] ${migrated}/${products.length} migradas`);
      }
    } catch (e) {
      failed++;
      console.error(`[error] ${tag}: ${(e as Error).message}`);
    }
  }

  console.log(`[images] terminado. ${DRY_RUN ? products.length + " (dry-run)" : migrated + " migradas"}, ${failed} fallaron.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
