/**
 * Borra el producto de prueba creado por create-test-product.ts.
 * Uso: npx tsx --env-file=.env.local scripts/delete-test-product.ts
 */
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) throw new Error("Falta SANITY_API_WRITE_TOKEN en .env.local.");
  await client.delete("product-TEST-CENTAVO");
  console.log("✅ Producto de prueba borrado (product-TEST-CENTAVO).");
}

main().catch((e) => {
  console.error("❌ Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
