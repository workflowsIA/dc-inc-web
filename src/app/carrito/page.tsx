"use client";
import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import { totalsFor, unitPrice, waOrderURL } from "@/lib/whatsapp";
import { bandForCp, SHIPPING_BAND_LABEL } from "@/lib/shipping";

export default function CarritoPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const wholesale = role === "wholesale" || role === "admin";
  const [cp, setCp] = useState("");
  const [shipMsg, setShipMsg] = useState(false);

  const t = totalsFor(items, wholesale, cp);

  if (items.length === 0) {
    return (
      <div className="wrap" style={{ padding: "80px 24px", textAlign: "center" }}>
        <h1 className="h-lg">Tu carrito está vacío</h1>
        <p className="lead" style={{ marginTop: "12px" }}>
          Armá tu pedido desde el catálogo y cotizá por WhatsApp.
        </p>
        <Link className="btn btn-primary btn-lg" style={{ marginTop: "24px" }} href="/productos">
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <h1 className="h-lg">Tu pedido</h1>

      <div className="cart-layout">
        <div style={{ display: "grid", gap: "12px" }}>
          {items.map((i) => (
            <div
              key={i.id}
              className="cart-line"
              style={{
                padding: "16px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={i.imageUrl}
                    alt={i.name}
                    width={56}
                    height={56}
                    style={{
                      width: "56px",
                      height: "56px",
                      objectFit: "contain",
                      background: "#fff",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-sm)",
                      flex: "none",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      background: "var(--bg-2)",
                      borderRadius: "var(--r-sm)",
                      flex: "none",
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>{i.name}</div>
                  <div className="mono" style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {i.kind === "combo" ? "Combo armado" : i.sku}
                    {i.kind !== "combo" && i.bulto > 1 ? ` · bulto ${i.bulto} u` : ""}
                    {i.deco ? " · con decorado" : ""}
                  </div>
                </div>
              </div>
              {/* Venta por bulto cerrado: los ± y el input se mueven de a 1 bulto
                  (= i.bulto unidades). La cantidad mostrada son BULTOS. */}
              {(() => {
                const step = i.bulto > 0 ? i.bulto : 1;
                const bultos = Math.max(1, Math.round(i.qty / step));
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setQty(i.id, i.qty - step)}>
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={bultos}
                      onChange={(e) => setQty(i.id, (parseInt(e.target.value || "1") || 1) * step)}
                      aria-label={step > 1 ? "Cantidad de bultos" : "Cantidad"}
                      style={{
                        width: "60px",
                        textAlign: "center",
                        padding: "8px",
                        border: "1px solid var(--line-2)",
                        borderRadius: "var(--r-sm)",
                      }}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => setQty(i.id, i.qty + step)}>
                      +
                    </button>
                  </div>
                );
              })()}
              <div className="cart-line-price" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ textAlign: "right" }}>
                  {/* Cliente final ve el precio con IVA incluido; mayorista, neto */}
                  <strong>
                    {ars(unitPrice(i, wholesale) * i.qty * (wholesale ? 1 : 1.21))}
                  </strong>
                  {(() => {
                    const step = i.bulto > 0 ? i.bulto : 1;
                    const bultos = Math.max(1, Math.round(i.qty / step));
                    return (
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {i.kind === "combo"
                          ? `${i.qty} ${i.qty === 1 ? "combo" : "combos"}`
                          : step > 1
                            ? `${bultos} ${bultos === 1 ? "bulto" : "bultos"} · ${i.qty} u`
                            : `${i.qty} u`}
                      </div>
                    );
                  })()}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(i.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* RESUMEN */}
        <aside
          style={{
            padding: "24px",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            background: "var(--bg-2)",
            position: "sticky",
            top: "100px",
            height: "fit-content",
          }}
        >
          <h3 className="h-md" style={{ fontSize: "18px" }}>
            Resumen
          </h3>
          <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--amber-deep)", fontWeight: 700 }}>
            {wholesale
              ? "Precios mayoristas aplicados (neto + IVA)"
              : "Precios con IVA incluido"}
          </p>
          <dl style={{ marginTop: "16px", display: "grid", gap: "8px", fontSize: "14px" }}>
            <Row label="Subtotal (neto)" value={ars(t.sub)} />
            {t.rate > 0 && (
              <Row label={`Descuento volumen (${t.rate * 100}%)`} value={`-${ars(t.disc)}`} muted />
            )}
            <Row label="IVA 21%" value={ars(t.iva)} muted />
            {t.finalConsumer ? (
              <Row label="Envío estimado" value={ars(t.shipping)} muted />
            ) : (
              <Row label="Envío" value="a cotizar" muted />
            )}
            <Row label="Total estimado" value={ars(t.total)} strong />
          </dl>
          {t.finalConsumer && (
            <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--muted)" }}>
              Envío estimado — se confirma al cerrar el pedido.
            </p>
          )}
          {t.hasDeco && (
            <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--muted)" }}>
              Incluye decorado — coordinamos arte por WhatsApp.
            </p>
          )}

          {/* Envío — cálculo real llega en mes 2-3; por ahora deriva a WhatsApp */}
          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
              Calcular envío
            </label>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <input
                inputMode="numeric"
                placeholder="Tu código postal"
                value={cp}
                onChange={(e) => {
                  setCp(e.target.value);
                  setShipMsg(false);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 12px",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)",
                  fontSize: "14px",
                }}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShipMsg(cp.trim().length > 0)}
              >
                Calcular
              </button>
            </div>
            {shipMsg &&
              (bandForCp(cp) ? (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                  Envío a domicilio a <strong>{SHIPPING_BAND_LABEL[bandForCp(cp)!]}</strong>:{" "}
                  <strong>{ars(t.shipping)}</strong> (estimado, se confirma al cerrar).
                </p>
              ) : (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                  No reconocimos ese código postal. Verificá los 4 dígitos o coordinamos
                  el envío por WhatsApp al confirmar.
                </p>
              ))}
          </div>

          <Link
            className="btn btn-primary btn-lg btn-block"
            style={{ marginTop: "20px" }}
            href="/checkout"
          >
            Continuar →
          </Link>
          <a
            className="btn btn-wa btn-block"
            style={{ marginTop: "10px" }}
            href={waOrderURL(items, wholesale, cp)}
            target="_blank"
            rel="noopener"
          >
            O cotizá directo por WhatsApp
          </a>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <dt style={{ color: muted ? "var(--muted)" : undefined }}>{label}</dt>
      <dd style={{ fontWeight: strong ? 700 : 600 }}>{value}</dd>
    </div>
  );
}
