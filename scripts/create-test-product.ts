/**
 * Crea (o reemplaza) un PRODUCTO DE PRUEBA baratísimo para testear el checkout
 * y el webhook de Nave sin gastar plata.
 *
 * 🔑 Truco del envío: comprá logueado como ADMIN. Como admin el envío es $0
 * (vista mayorista) y el pago con Nave SIGUE habilitado (solo el rol "wholesale"
 * puro va obligado a WhatsApp; admin no). En la ficha elegí "Individual" (1 u)
 * → total ≈ precio + IVA. Con precio $1 el cobro real es ~$1,21.
 *
 * Uso:    npx tsx --env-file=.env.local scripts/create-test-product.ts
 * Precio: TEST_PRODUCT_PRICE=50 npx tsx --env-file=.env.local scripts/create-test-product.ts
 * Borrar: npx tsx --env-file=.env.local scripts/delete-test-product.ts
 */
import { createClient } from "@sanity/client";

const PRICE = Number(process.env.TEST_PRODUCT_PRICE ?? "1"); // pesos (neto), editable

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) throw new Error("Falta SANITY_API_WRITE_TOKEN en .env.local.");

  // Referenciamos la primera categoría existente (category es requerido).
  const cat = await client.fetch<{ _id: string; name?: string } | null>(
    `*[_type == "category"] | order(order asc)[0]{ _id, name }`,
  );
  if (!cat?._id) throw new Error("No encontré ninguna categoría para referenciar.");

  const doc = {
    _id: "product-TEST-CENTAVO", // determinístico → createOrReplace, sin duplicados
    _type: "product",
    sku: "TEST-CENTAVO", // no está en la planilla → el sync lo ignora (no lo pisa ni borra)
    name: "TEST — producto de prueba (NO comprar)",
    slug: { _type: "slug", current: "test-centavo" },
    category: { _type: "reference", _ref: cat._id },
    description: "Producto de prueba para testear checkout/pago. Borrar después con delete-test-product.ts.",
    pricePublic: PRICE,
    priceWholesale: PRICE,
    unitsPerBulk: 1,
    stockQty: 999,
    stockLevel: "ok",
    fromSheet: false,
  };

  await client.createOrReplace(doc);
  console.log(`✅ Producto de prueba creado: "${doc.name}"`);
  console.log(`   SKU ${doc.sku} · precio $${PRICE} (neto) · categoría "${cat.name}" · stock 999`);
  console.log(`   Ficha: /productos/test-centavo`);
  console.log(`   👉 Comprá logueado como ADMIN → envío $0; elegí "Individual" (1 u) → total ≈ $${(PRICE * 1.21).toFixed(2)}.`);
  console.log(`   Borrar: npx tsx --env-file=.env.local scripts/delete-test-product.ts`);
}

main().catch((e) => {
  console.error("❌ Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
