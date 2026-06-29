import { isAdmin } from "@/lib/user";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { sanityClient, sanityWriteClient } from "@/lib/sanity";
import { allOrdersQuery, type SanityOrder } from "@/lib/queries";
import { ars } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos · Admin" };

/** Marca un pedido como procesado/enviado/no procesado. */
async function setFulfillment(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  if (!id || !status) return;
  await sanityWriteClient.patch(id).set({ fulfillmentStatus: status }).commit();
  revalidatePath("/admin/pedidos");
}

/** Marca un pedido como pagado/no pagado. */
async function setPayment(formData: FormData) {
  "use server";
  if (!(await isAdmin())) return;
  const id = formData.get("id")?.toString();
  const status = formData.get("status")?.toString();
  if (!id || !status) return;
  await sanityWriteClient.patch(id).set({ paymentStatus: status }).commit();
  revalidatePath("/admin/pedidos");
}

const FULFILLMENT_LABEL: Record<string, string> = {
  no_procesado: "No procesado",
  procesado: "Procesado",
  enviado: "Enviado",
};

export default async function PedidosAdminPage() {
  if (!(await isAdmin())) redirect("/mi-cuenta");

  const orders = await sanityClient.fetch<SanityOrder[]>(allOrdersQuery);

  const totalVendido = orders
    .filter((o) => o.paymentStatus === "pagado")
    .reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <nav style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <span className="btn btn-primary btn-sm">Pedidos</span>
        <Link className="btn btn-ghost btn-sm" href="/admin/aprobaciones">Aprobaciones</Link>
        <Link className="btn btn-ghost btn-sm" href="/admin/clientes">Clientes</Link>
      </nav>
      <span className="eyebrow">Admin · Pedidos</span>
      <h1 className="h-lg" style={{ marginTop: "12px" }}>
        Pedidos web
      </h1>
      <p className="lead" style={{ marginTop: "8px" }}>
        {orders.length} pedido{orders.length === 1 ? "" : "s"} · cobrado{" "}
        {ars(totalVendido)} (pagados)
      </p>

      <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
        <Link href="/admin/aprobaciones" style={{ color: "var(--amber-deep)", fontWeight: 600 }}>
          → Aprobaciones de mayoristas
        </Link>
      </p>

      {orders.length === 0 ? (
        <div
          style={{
            marginTop: "32px",
            padding: "32px",
            background: "var(--bg-2)",
            borderRadius: "var(--r-lg)",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          Todavía no hay pedidos.
        </div>
      ) : (
        <div style={{ marginTop: "32px", display: "grid", gap: "14px" }}>
          {orders.map((o) => {
            const fecha = o.createdAt
              ? new Date(o.createdAt).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const cliente = [o.customerName, o.customerCompany].filter(Boolean).join(" · ");
            const pagado = o.paymentStatus === "pagado";
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
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {o.orderNumber} {cliente && `— ${cliente}`}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                      {fecha}
                      {o.origin ? ` · ${o.origin === "web" ? "Web" : "WhatsApp"}` : ""}
                      {o.priceBasis ? ` · ${o.priceBasis === "mayorista" ? "Mayorista" : "Cliente final"}` : ""}
                      {(o.customerEmail || o.customerPhone) && " · "}
                      {[o.customerEmail, o.customerPhone].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: "18px" }}>{ars(o.total ?? 0)}</div>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      <span
                        style={{
                          color: pagado ? "#0a7d34" : "var(--muted)",
                          fontWeight: 600,
                        }}
                      >
                        {pagado ? "Pagado" : "No pagado"}
                      </span>{" "}
                      · {FULFILLMENT_LABEL[o.fulfillmentStatus ?? "no_procesado"]}
                    </div>
                  </div>
                </div>

                {/* Items */}
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
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <span style={{ color: "var(--muted)" }}>
                          {cant} — {it.name || it.sku}
                        </span>
                        <span>{ars(it.subtotal ?? 0)}</span>
                      </div>
                    );
                  })}
                  {o.notes && (
                    <div style={{ marginTop: "6px", color: "var(--muted)", fontStyle: "italic" }}>
                      Notas: {o.notes}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <form action={setPayment}>
                    <input type="hidden" name="id" value={o._id} />
                    <input type="hidden" name="status" value={pagado ? "no_pagado" : "pagado"} />
                    <button className="btn btn-ghost btn-sm" type="submit">
                      {pagado ? "Marcar no pagado" : "Marcar pagado"}
                    </button>
                  </form>
                  {o.fulfillmentStatus !== "procesado" && (
                    <form action={setFulfillment}>
                      <input type="hidden" name="id" value={o._id} />
                      <input type="hidden" name="status" value="procesado" />
                      <button className="btn btn-ghost btn-sm" type="submit">
                        Marcar procesado
                      </button>
                    </form>
                  )}
                  {o.fulfillmentStatus !== "enviado" && (
                    <form action={setFulfillment}>
                      <input type="hidden" name="id" value={o._id} />
                      <input type="hidden" name="status" value="enviado" />
                      <button className="btn btn-primary btn-sm" type="submit">
                        Marcar enviado
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
