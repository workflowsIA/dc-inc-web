"use client";
import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import { totalsFor, unitPrice, waCheckoutURL, type CheckoutInfo } from "@/lib/whatsapp";

export default function CheckoutPage() {
  const items = useCart((s) => s.items);
  const { user } = useUser();
  const wholesale = (user?.publicMetadata?.role as string | undefined) === "wholesale";
  const md = (user?.unsafeMetadata ?? {}) as Record<string, string>;

  const [info, setInfo] = useState<CheckoutInfo>({
    nombre: user?.firstName ?? md.contacto ?? "",
    empresa: md.empresa ?? "",
    email: user?.primaryEmailAddress?.emailAddress ?? "",
    telefono: md.telefono ?? "",
    cp: "",
    notas: "",
  });

  const t = totalsFor(items, wholesale);
  const set = (k: keyof CheckoutInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInfo((s) => ({ ...s, [k]: e.target.value }));

  if (items.length === 0) {
    return (
      <div className="wrap" style={{ padding: "80px 24px", textAlign: "center" }}>
        <h1 className="h-lg">No tenés un pedido en curso</h1>
        <Link className="btn btn-primary btn-lg" style={{ marginTop: "20px" }} href="/productos">
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      {/* Wizard */}
      <div className="chips" style={{ marginBottom: "28px" }}>
        <Link className="chip" href="/carrito">1 · Carrito</Link>
        <span className="chip on">2 · Tus datos</span>
        <span className="chip">3 · Confirmar por WhatsApp</span>
      </div>

      <h1 className="h-lg">Revisá y confirmá tu pedido</h1>

      <div className="cart-layout">
        {/* DATOS */}
        <div className="card" style={{ padding: "24px", height: "fit-content" }}>
          <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "4px" }}>
            Tus datos
          </h3>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
            Coordinamos el cierre, el pago y el envío por WhatsApp. No se cobra nada online.
          </p>
          <div style={{ display: "grid", gap: "14px" }}>
            <In label="Nombre" value={info.nombre} onChange={set("nombre")} />
            <In label="Empresa" value={info.empresa} onChange={set("empresa")} />
            <In label="Email" value={info.email} onChange={set("email")} />
            <In label="Teléfono" value={info.telefono} onChange={set("telefono")} />
            <In label="Código postal (para estimar envío)" value={info.cp} onChange={set("cp")} />
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
                Notas (opcional)
              </span>
              <textarea
                value={info.notas}
                onChange={set("notas")}
                rows={3}
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)",
                  fontSize: "14px",
                  resize: "vertical",
                }}
              />
            </label>
          </div>
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
          <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "12px" }}>
            Tu pedido
          </h3>
          <div style={{ display: "grid", gap: "8px", fontSize: "14px" }}>
            {items.map((i) => (
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "var(--muted)" }}>
                  {i.qty}× {i.name}
                </span>
                <strong>{ars(unitPrice(i, wholesale) * i.qty)}</strong>
              </div>
            ))}
          </div>
          <div style={{ height: "1px", background: "var(--line)", margin: "14px 0" }} />
          <Row label="Subtotal" value={ars(t.sub)} />
          {t.rate > 0 && <Row label={`Descuento (${t.rate * 100}%)`} value={`-${ars(t.disc)}`} muted />}
          <Row label="IVA 21%" value={ars(t.iva)} muted />
          <Row label="Total estimado" value={ars(t.total)} strong />

          <a
            className="btn btn-wa btn-lg btn-block"
            style={{ marginTop: "20px" }}
            href={waCheckoutURL(items, wholesale, info)}
            target="_blank"
            rel="noopener"
          >
            Confirmar pedido por WhatsApp
          </a>
          <Link
            className="btn btn-ghost btn-block"
            style={{ marginTop: "10px" }}
            href="/carrito"
          >
            ← Volver al carrito
          </Link>
        </aside>
      </div>
    </div>
  );
}

function In({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
      <input
        value={value}
        onChange={onChange}
        style={{
          padding: "10px 12px",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--r-sm)",
          fontSize: "14px",
        }}
      />
    </label>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginTop: "4px" }}>
      <span style={{ color: muted ? "var(--muted)" : undefined }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  );
}
