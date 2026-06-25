import MiCuentaTabs from "@/components/site/MiCuentaTabs";
import RepeatOrderButton, { type RepeatItem } from "@/components/site/RepeatOrderButton";
import { auth } from "@clerk/nextjs/server";
import { sanityClient } from "@/lib/sanity";
import {
  ordersByUserQuery,
  productsBySkusQuery,
  combosBySlugsQuery,
  type SanityOrder,
  type OrderPricingProduct,
  type OrderPricingCombo,
} from "@/lib/queries";
import { ars } from "@/lib/format";
import type { ProductSnapshot } from "@/lib/cart-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi cuenta" };

const FULFILLMENT_LABEL: Record<string, string> = {
  no_procesado: "En preparación",
  procesado: "Procesado",
  enviado: "Enviado",
};

export default async function MiCuentaPage() {
  // El middleware ya protege esta ruta.
  const { userId } = await auth();

  const orders = userId
    ? await sanityClient.fetch<SanityOrder[]>(ordersByUserQuery, { uid: userId })
    : [];

  // Para "repetir pedido" resolvemos los productos/combos actuales por SKU/slug.
  const allKeys = Array.from(
    new Set(orders.flatMap((o) => (o.items ?? []).map((i) => i.sku).filter(Boolean) as string[])),
  );
  const [products, combos] = allKeys.length
    ? await Promise.all([
        sanityClient.fetch<OrderPricingProduct[]>(productsBySkusQuery, { skus: allKeys }),
        sanityClient.fetch<OrderPricingCombo[]>(combosBySlugsQuery, { slugs: allKeys }),
      ])
    : [[], []];
  const productBySku = new Map(products.map((p) => [p.sku, p]));
  const comboBySlug = new Map(combos.map((c) => [c.slug, c]));

  function repeatItemsFor(o: SanityOrder): RepeatItem[] {
    const out: RepeatItem[] = [];
    for (const it of o.items ?? []) {
      if (!it.sku) continue;
      const prod = productBySku.get(it.sku);
      if (prod) {
        const snapshot: ProductSnapshot = {
          id: prod.slug ?? prod.sku,
          name: prod.name,
          sku: prod.sku,
          pub: prod.pricePublic,
          may: prod.priceWholesale,
          bulto: prod.unitsPerBulk,
          pallet: prod.unitsPerPallet,
          imageUrl: prod.image,
        };
        out.push({ snapshot, qty: it.unidades ?? prod.unitsPerBulk ?? 1 });
        continue;
      }
      const combo = comboBySlug.get(it.sku);
      if (combo) {
        const snapshot: ProductSnapshot = {
          id: combo.slug,
          name: combo.name,
          sku: combo.slug,
          pub: combo.pricePublicFrom ?? 0,
          may: combo.pricePublicFrom ?? 0,
          bulto: 1,
          imageUrl: combo.image,
          kind: "combo",
        };
        out.push({ snapshot, qty: it.unidades ?? 1 });
      }
    }
    return out;
  }

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <MiCuentaTabs />

      <section style={{ marginTop: "48px" }}>
        <h2 className="h-md" style={{ marginBottom: "4px" }}>
          Mis pedidos
        </h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "20px" }}>
          {orders.length === 0
            ? "Todavía no hiciste pedidos desde tu cuenta."
            : `${orders.length} pedido${orders.length === 1 ? "" : "s"}.`}
        </p>

        {orders.length > 0 && (
          <div style={{ display: "grid", gap: "14px" }}>
            {orders.map((o) => {
              const fecha = o.createdAt
                ? new Date(o.createdAt).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "";
              return (
                <div
                  key={o._id}
                  style={{
                    padding: "18px 20px",
                    background: "#fff",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{o.orderNumber}</div>
                      <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                        {fecha} · {FULFILLMENT_LABEL[o.fulfillmentStatus ?? "no_procesado"]}
                        {o.paymentStatus === "pagado" ? " · Pagado" : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <strong>{ars(o.total ?? 0)}</strong>
                      <RepeatOrderButton items={repeatItemsFor(o)} />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--line)",
                      display: "grid",
                      gap: "4px",
                      fontSize: "13px",
                    }}
                  >
                    {(o.items ?? []).map((it, idx) => {
                      const cant =
                        typeof it.bultos === "number"
                          ? `${it.bultos} bulto${it.bultos === 1 ? "" : "s"} (${it.unidades ?? 0} u)`
                          : `${it.unidades ?? 0} u`;
                      return (
                        <div
                          key={idx}
                          style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}
                        >
                          <span style={{ color: "var(--muted)" }}>
                            {cant} — {it.name || it.sku}
                          </span>
                          <span>{ars(it.subtotal ?? 0)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
