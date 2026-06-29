"use client";
import { useState } from "react";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { waSimpleURL } from "@/lib/whatsapp";

type Tab = "pedidos" | "datos" | "vendedor";

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  visitor: { label: "Visitante", cls: "badge" },
  pending: { label: "En revisión", cls: "badge badge-low" },
  wholesale: { label: "Mayorista aprobado", cls: "badge badge-best" },
  admin: { label: "Admin", cls: "badge badge-deco" },
};

export default function MiCuentaTabs() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("datos");

  if (!isLoaded) {
    return <p className="lead" style={{ padding: "48px 0" }}>Cargando…</p>;
  }
  if (!user) return null;

  const role = (user.publicMetadata?.role as string | undefined) ?? "pending";
  const isAdmin = role === "admin";
  const empresa = (user.unsafeMetadata?.empresa as string | undefined) ?? "";
  const badge = ROLE_BADGE[role] ?? ROLE_BADGE.visitor;

  return (
    <div>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <span className="eyebrow">Mi cuenta</span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            Hola, {user.firstName ?? user.username ?? "mayorista"}
          </h1>
          <p className="lead" style={{ marginTop: "8px" }}>
            {empresa ? `${empresa} · ` : ""}
            <span className={badge.cls}>{badge.label}</span>
          </p>
        </div>
        <UserButton />
      </div>

      {role === "pending" && (
        <div
          style={{
            padding: "16px 20px",
            background: "var(--warn-bg)",
            border: "1px solid var(--warn)",
            borderRadius: "var(--r)",
            marginBottom: "24px",
            fontSize: "14px",
          }}
        >
          <strong>Tu cuenta está en revisión.</strong> En cuanto DC Inc apruebe tu
          registro vas a ver precios mayoristas en todo el catálogo. Completá tus
          datos en la pestaña “Datos” para agilizar la aprobación.
        </div>
      )}

      {/* TABS */}
      <div className="chips" style={{ marginBottom: "24px" }}>
        <button className={`chip ${tab === "datos" ? "on" : ""}`} onClick={() => setTab("datos")}>
          Datos
        </button>
        <button className={`chip ${tab === "pedidos" ? "on" : ""}`} onClick={() => setTab("pedidos")}>
          Pedidos
        </button>
        <button className={`chip ${tab === "vendedor" ? "on" : ""}`} onClick={() => setTab("vendedor")}>
          Mi vendedor
        </button>
      </div>

      {tab === "datos" && <DatosForm />}
      {tab === "pedidos" && <PedidosTab />}
      {tab === "vendedor" && <VendedorTab />}

      {isAdmin && (
        <div style={{ marginTop: "40px" }}>
          <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "12px" }}>
            Panel admin
          </h3>
          <Link
            href="/admin"
            className="card"
            style={{ display: "block", padding: "20px", maxWidth: "420px" }}
          >
            <h4 className="h-md" style={{ fontSize: "16px", marginBottom: "6px" }}>
              Abrir el backend
            </h4>
            <p style={{ fontSize: "14px", color: "var(--muted)" }}>
              Pedidos, clientes y catálogo en el Studio.
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}

function DatosForm() {
  const { user } = useUser();
  const md = (user?.unsafeMetadata ?? {}) as Record<string, string>;
  const [empresa, setEmpresa] = useState(md.empresa ?? "");
  const [cuit, setCuit] = useState(md.cuit ?? "");
  const [contacto, setContacto] = useState(md.contacto ?? "");
  const [telefono, setTelefono] = useState(md.telefono ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await user.update({
        unsafeMetadata: { ...md, empresa, cuit, contacto, telefono },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("No pudimos guardar. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: "24px", maxWidth: "520px" }}>
      <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "4px" }}>
        Datos de tu empresa
      </h3>
      <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "20px" }}>
        Estos datos nos ayudan a aprobar tu cuenta mayorista y a facturarte.
      </p>
      <div style={{ display: "grid", gap: "14px" }}>
        <Field label="Razón social / empresa" value={empresa} onChange={setEmpresa} placeholder="DC Bebidas SRL" />
        <Field label="CUIT" value={cuit} onChange={setCuit} placeholder="30-12345678-9" />
        <Field label="Nombre de contacto" value={contacto} onChange={setContacto} placeholder="Tu nombre" />
        <Field label="Teléfono" value={telefono} onChange={setTelefono} placeholder="11 5555 5555" />
      </div>
      <button
        className="btn btn-primary"
        style={{ marginTop: "20px" }}
        onClick={save}
        disabled={saving}
      >
        {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar datos"}
      </button>
      {error && <p style={{ marginTop: "10px", color: "var(--err, #DC2626)", fontSize: "13px" }}>{error}</p>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function PedidosTab() {
  return (
    <div className="card" style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
      <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>
        Tus pedidos — próximamente
      </h3>
      <p style={{ fontSize: "14px", maxWidth: "44ch", margin: "0 auto" }}>
        Acá vas a poder ver el historial y repetir pedidos con un toque. Por ahora
        cada pedido se cierra y coordina por WhatsApp.
      </p>
      <Link className="btn btn-ghost btn-sm" href="/productos" style={{ marginTop: "16px" }}>
        Armar un pedido
      </Link>
    </div>
  );
}

function VendedorTab() {
  return (
    <div className="card" style={{ padding: "32px", textAlign: "center" }}>
      <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "8px" }}>
        Tu vendedor asignado
      </h3>
      <p style={{ fontSize: "14px", color: "var(--muted)", maxWidth: "44ch", margin: "0 auto 16px" }}>
        Cuando se te asigne un vendedor, vas a ver acá su contacto directo.
        Mientras tanto, escribinos por el WhatsApp general y te derivamos.
      </p>
      <a
        className="btn btn-wa"
        href={waSimpleURL("Hola DC Inc! Soy cliente y quiero contactar a mi vendedor.")}
        target="_blank"
        rel="noopener"
      >
        Escribir por WhatsApp
      </a>
    </div>
  );
}
