"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart-store";
import { getProduct } from "@/data/products";
import { ars } from "@/lib/format";
import { totalsFor, waOrderURL, type CartLine } from "@/lib/whatsapp";

export default function CarritoPage() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  const lines: CartLine[] = items.flatMap((i) => {
    const product = getProduct(i.id);
    if (!product) return [];
    const line: CartLine = { product, qty: i.qty };
    if (i.deco) line.deco = true;
    return [line];
  });

  const t = totalsFor(lines);

  if (lines.length === 0) {
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
          {lines.map((l) => (
            <div
              key={l.product.id}
              className="cart-line"
              style={{
                padding: "16px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                background: "#fff",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{l.product.name}</div>
                <div className="mono" style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {l.product.sku} · bulto {l.product.bulto} u
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQty(l.product.id, l.qty - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  value={l.qty}
                  onChange={(e) => setQty(l.product.id, parseInt(e.target.value || "1"))}
                  style={{
                    width: "60px",
                    textAlign: "center",
                    padding: "8px",
                    border: "1px solid var(--line-2)",
                    borderRadius: "var(--r-sm)",
                  }}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQty(l.product.id, l.qty + 1)}
                >
                  +
                </button>
              </div>
              <div className="cart-line-price" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <strong>{ars(l.product.pub * l.qty)}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(l.product.id)}>
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
          <dl style={{ marginTop: "16px", display: "grid", gap: "8px", fontSize: "14px" }}>
            <Row label="Subtotal" value={ars(t.sub)} />
            {t.rate > 0 && (
              <Row
                label={`Descuento volumen (${t.rate * 100}%)`}
                value={`-${ars(t.disc)}`}
                muted
              />
            )}
            <Row label="IVA 21%" value={ars(t.iva)} muted />
            <Row label="Total estimado" value={ars(t.total)} strong />
          </dl>
          {t.hasDeco && (
            <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--muted)" }}>
              Incluye decorado — coordinamos arte por WhatsApp.
            </p>
          )}
          <a
            className="btn btn-wa btn-lg btn-block"
            style={{ marginTop: "20px" }}
            href={waOrderURL(lines)}
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
