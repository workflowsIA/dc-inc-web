/**
 * Limpieza de pedidos de prueba en Sanity (checkout dev/pruebas de Nave, 22-jul).
 *
 * Por defecto SOLO LISTA — no borra nada. Los pedidos con paymentStatus="pagado"
 * NUNCA se borran (quedan marcados aparte, son plata real y hacen falta para
 * reconciliar con Marce), sin importar los flags.
 *
 * Uso:
 *   npm run orders:cleanup                # lista todo, no toca nada
 *   npm run orders:cleanup -- --delete    # borra los pedidos NO pagados (test/abandonados)
 *
 * Env: SANITY_API_WRITE_TOKEN.
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DELETE = process.argv.includes("--delete");

interface OrderRow {
  _id: string;
  orderNumber?: string;
  paymentStatus?: string;
  total?: number;
  customerName?: string;
  customerCompany?: string;
  _createdAt?: string;
}

function arsFmt(n: number | undefined): string {
  if (typeof n !== "number") return "—";
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

async function main() {
  const orders = await sanityWriteClient.fetch<OrderRow[]>(
    `*[_type == "order"] | order(_createdAt desc){
       _id, orderNumber, paymentStatus, total, customerName, customerCompany, _createdAt
     }`,
  );

  const paid = orders.filter((o) => (o.paymentStatus ?? "").toLowerCase() === "pagado");
  const unpaid = orders.filter((o) => (o.paymentStatus ?? "").toLowerCase() !== "pagado");

  console.log(`\n📦 Total de pedidos en Sanity: ${orders.length}\n`);

  console.log(`💰 PAGADOS (${paid.length}) — plata real, NUNCA se borran automáticamente:`);
  for (const o of paid) {
    console.log(
      `   ${o.orderNumber ?? o._id} — ${o.customerCompany || o.customerName || "?"} — ${arsFmt(o.total)} — ${o._createdAt}`,
    );
  }

  console.log(`\n🗑️  NO PAGADOS / test-abandonados (${unpaid.length}):`);
  for (const o of unpaid) {
    console.log(
      `   ${o.orderNumber ?? o._id} — estado="${o.paymentStatus ?? "?"}" — ${arsFmt(o.total)} — ${o._createdAt}`,
    );
  }

  if (!DELETE) {
    console.log(`\n(dry run — nada borrado. Corré con --delete para borrar los ${unpaid.length} NO pagados de arriba.)\n`);
    return;
  }

  console.log(`\nBorrando ${unpaid.length} pedidos no pagados...\n`);
  let ok = 0;
  let failed = 0;
  for (const o of unpaid) {
    try {
      await sanityWriteClient.delete(o._id);
      ok++;
    } catch (err) {
      failed++;
      console.error(`   ❌ no se pudo borrar ${o.orderNumber ?? o._id}:`, (err as Error).message);
    }
  }
  console.log(`\n✅ Borrados: ${ok}${failed ? ` — ❌ Fallaron: ${failed}` : ""}\n`);
  console.log(`Pedidos PAGADOS intactos: ${paid.length} (esos quedan para reconciliar con Marce).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
