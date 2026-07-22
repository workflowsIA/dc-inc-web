/**
 * Limpieza de pedidos de prueba en Sanity (checkout dev/pruebas de Nave, 22-jul).
 *
 * Por defecto SOLO LISTA — no borra nada. Los pedidos con paymentStatus="pagado"
 * NUNCA se borran (quedan marcados aparte, son plata real y hacen falta para
 * reconciliar con Marce), sin importar los flags.
 *
 * IMPORTANTE: un pedido "no_pagado" no siempre es un carrito abandonado sin
 * plata real — puede ser un pago que SÍ se cobró en Nave pero nunca se
 * concilió en Sanity (bug viejo, antes de la barredora). Por eso se imprime
 * navePaymentRequestId: si un "no_pagado" tiene uno, hay que verificar en el
 * portal de Nave (o el resumen de la tarjeta) si esa intención se cobró antes
 * de borrarlo — si se cobró, mejor reconciliarlo (ver /api/nave/status o la
 * barredora) que borrar el registro.
 *
 * Uso:
 *   npm run orders:cleanup                                   # lista todo, no toca nada
 *   npm run orders:cleanup -- --delete                        # borra TODOS los no pagados
 *   npm run orders:cleanup -- --delete --keep=301793-HQN,268531-ELQ
 *                                                              # borra los no pagados EXCEPTO estos orderNumber
 *
 * Env: SANITY_API_WRITE_TOKEN.
 */
import { sanityWriteClient } from "../src/lib/sanity";

const DELETE = process.argv.includes("--delete");
const KEEP = new Set(
  (process.argv.find((a) => a.startsWith("--keep=")) ?? "")
    .replace("--keep=", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

interface OrderRow {
  _id: string;
  orderNumber?: string;
  paymentStatus?: string;
  total?: number;
  customerName?: string;
  customerCompany?: string;
  _createdAt?: string;
  navePaymentRequestId?: string;
}

function arsFmt(n: number | undefined): string {
  if (typeof n !== "number") return "—";
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

async function main() {
  const orders = await sanityWriteClient.fetch<OrderRow[]>(
    `*[_type == "order"] | order(_createdAt desc){
       _id, orderNumber, paymentStatus, total, customerName, customerCompany, _createdAt, navePaymentRequestId
     }`,
  );

  const paid = orders.filter((o) => (o.paymentStatus ?? "").toLowerCase() === "pagado");
  const unpaidAll = orders.filter((o) => (o.paymentStatus ?? "").toLowerCase() !== "pagado");
  const kept = unpaidAll.filter((o) => o.orderNumber && KEEP.has(o.orderNumber));
  const unpaid = unpaidAll.filter((o) => !(o.orderNumber && KEEP.has(o.orderNumber)));

  console.log(`\n📦 Total de pedidos en Sanity: ${orders.length}\n`);

  console.log(`💰 PAGADOS (${paid.length}) — plata real, NUNCA se borran automáticamente:`);
  for (const o of paid) {
    console.log(
      `   ${o.orderNumber ?? o._id} — ${o.customerCompany || o.customerName || "?"} — ${arsFmt(o.total)} — ${o._createdAt}`,
    );
  }

  if (kept.length) {
    console.log(`\n🔒 EXCLUIDOS por --keep (${kept.length}), no se tocan:`);
    for (const o of kept) {
      console.log(
        `   ${o.orderNumber ?? o._id} — estado="${o.paymentStatus ?? "?"}" — ${arsFmt(o.total)} — naveRequestId=${o.navePaymentRequestId ?? "—"} — ${o._createdAt}`,
      );
    }
  }

  console.log(`\n🗑️  NO PAGADOS / candidatos a borrar (${unpaid.length}):`);
  for (const o of unpaid) {
    const flag = o.navePaymentRequestId ? "  ⚠️ TIENE navePaymentRequestId — verificar en Nave antes de borrar" : "";
    console.log(
      `   ${o.orderNumber ?? o._id} — estado="${o.paymentStatus ?? "?"}" — ${arsFmt(o.total)} — ${o._createdAt}${flag}`,
    );
  }

  if (!DELETE) {
    console.log(`\n(dry run — nada borrado. Corré con --delete para borrar los ${unpaid.length} de arriba, o sumá --keep=orderNumber1,orderNumber2 para excluir alguno.)\n`);
    return;
  }

  console.log(`\nBorrando ${unpaid.length} pedidos...\n`);
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
  console.log(`Pedidos PAGADOS intactos: ${paid.length}. Excluidos por --keep: ${kept.length}.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
