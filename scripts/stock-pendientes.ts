/**
 * Pedidos PAGADOS cuyas unidades nunca se registraron en el inventario.
 *
 * Durante meses el descuento de stock estuvo apagado (STOCK_SALE_ON_PAYMENT sin
 * setear) y además apuntaba a "Stock Venta", que es una fórmula y por eso se
 * salteaba. Resultado: los pedidos web cobrados no movieron el inventario.
 *
 * Este script NO escribe nada. Lista los pedidos pagados sin sello
 * `stockAppliedAt` y consolida las unidades por SKU base, que es como se lleva
 * el stock en `Productos_Inventario_DC` (la fila Unidad). Sirve para que Marce
 * concilie a mano: ella ya descontó algunos, y cargarlos de prepo los contaría
 * dos veces.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/stock-pendientes.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { sanityWriteClient } from "../src/lib/sanity";

interface Row {
  orderNumber?: string;
  createdAt?: string;
  origin?: string;
  customerName?: string;
  customerCompany?: string;
  total?: number;
  items?: { name?: string; sku?: string; baseSku?: string; unidades?: number }[];
}

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const orders = await sanityWriteClient.fetch<Row[]>(
    `*[_type == "order" && paymentStatus == "pagado" && !defined(stockAppliedAt) && isTest != true]
      | order(createdAt asc){
        orderNumber, createdAt, origin, customerName, customerCompany, total,
        items[]{ name, sku, baseSku, unidades }
      }`,
  );

  if (!orders.length) {
    console.log("\nNo hay pedidos pagados sin registrar en el inventario.\n");
    return;
  }

  const porSku = new Map<string, { unidades: number; nombre: string; pedidos: Set<string> }>();
  let lineas = 0;
  for (const o of orders) {
    for (const it of o.items ?? []) {
      const sku = (it.baseSku || it.sku || "").trim();
      const u = Number(it.unidades) || 0;
      if (!sku || u <= 0) continue;
      lineas++;
      const cur = porSku.get(sku) ?? { unidades: 0, nombre: it.name ?? "", pedidos: new Set() };
      cur.unidades += u;
      if (!cur.nombre && it.name) cur.nombre = it.name;
      cur.pedidos.add(o.orderNumber ?? "?");
      porSku.set(sku, cur);
    }
  }

  console.log(`\n📦 Pedidos pagados sin registrar en el inventario: ${orders.length}`);
  console.log(`   Líneas: ${lineas} · SKUs distintos: ${porSku.size}\n`);

  console.log("── Por pedido ──");
  for (const o of orders) {
    const fecha = (o.createdAt ?? "").slice(0, 10);
    const quien = o.customerCompany || o.customerName || "";
    console.log(
      `   ${String(o.orderNumber ?? "?").padEnd(12)} ${fecha}  ${String(o.origin ?? "").padEnd(9)} ${quien}`,
    );
    for (const it of o.items ?? []) {
      const sku = (it.baseSku || it.sku || "").trim();
      if (!sku || !(Number(it.unidades) > 0)) continue;
      console.log(`      ${sku.padEnd(18)} ${String(it.unidades).padStart(7)} u  ${it.name ?? ""}`);
    }
  }

  console.log("\n── Consolidado por SKU (esto es lo que hay que sumar a «Pedidos WEB») ──");
  const orden = [...porSku.entries()].sort((a, b) => b[1].unidades - a[1].unidades);
  for (const [sku, v] of orden) {
    console.log(
      `   ${sku.padEnd(18)} ${String(v.unidades).padStart(8)} u   (${v.pedidos.size} pedido${v.pedidos.size > 1 ? "s" : ""})  ${v.nombre}`,
    );
  }

  const dir = join(process.cwd(), "reports");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "stock-pendientes.csv");
  const head = "sku,unidades,pedidos,producto\n";
  const body = orden
    .map(([sku, v]) => [sku, v.unidades, [...v.pedidos].join(" "), v.nombre].map(esc).join(","))
    .join("\n");
  writeFileSync(path, head + body + "\n", "utf-8");
  console.log(`\n📄 CSV para Marce → ${path}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
