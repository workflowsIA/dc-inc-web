"use client";
import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import { totalsFor, unitPrice, waOrderURL } from "@/lib/whatsapp";

export default function CarritoPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const { user } = useUser();
  const wholesale = (user?.publicMetadata?.role as string | undefined) === "wholesale";
  const [cp, setCp] = useState("");
  const [shipMsg, setShipMsg] = useState(false);

  const t = totalsFor(items, wholesale);

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
              <div>
                <div style={{ fontWeight: 700 }}>{i.name}</div>
                <div className="mono" style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {i.sku} · bulto {i.bulto} u
                  {i.deco ? " · con decorado" : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setQty(i.id, i.qty - 1)}>
                  −
                </button>
                <input
                  type="number"
                  value={i.qty}
                  onChange={(e) => setQty(i.id, parseInt(e.target.value || "1"))}
                  style={{
                    width: "60px",
                    textAlign: "center",
                    padding: "8px",
                    border: "1px solid var(--line-2)",
                    borderRadius: "var(--r-sm)",
                  }}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => setQty(i.id, i.qty + 1)}>
                  +
                </button>
              </div>
              <div className="cart-line-price" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <strong>{ars(unitPrice(i, wholesale) * i.qty)}</strong>
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
          {wholesale && (
            <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--amber-deep)", fontWeight: 700 }}>
              Precios mayoristas aplicados
            </p>
          )}
          <dl style={{ marginTop: "16px", display: "grid", gap: "8px", fontSize: "14px" }}>
            <Row label="Subtotal" value={ars(t.sub)} />
            {t.rate > 0 && (
              <Row label={`Descuento volumen (${t.rate * 100}%)`} value={`-${ars(t.disc)}`} muted />
            )}
            <Row label="IVA 21%" value={ars(t.iva)} muted />
            <Row label="Total estimado" value={ars(t.total)} strong />
          </dl>
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
            {shipMsg && (
              <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                Coordinamos el costo de envío por WhatsApp al confirmar el pedido,
                según destino y volumen.
              </p>
            )}
          </div>

          <a
            className="btn btn-wa btn-lg btn-block"
            style={{ marginTop: "20px" }}
            href={waOrderURL(items, wholesale)}
            target="_blank"
            rel="noopener"
          >
            Cotizar por WhatsApp
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
