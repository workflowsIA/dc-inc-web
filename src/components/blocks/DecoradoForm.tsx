"use client";
import { useState } from "react";
import { WA_NUMBER } from "@/lib/whatsapp";

const PRODUCTOS = ["Botella", "Lata", "Copa", "Vaso / pinta", "Botellón", "Otro"];
const TECNICAS = [
  "Serigrafía 1 color",
  "Serigrafía 2 colores",
  "Serigrafía full color",
  "Calcos",
  "Grabado",
  "No estoy seguro / asesorame",
];

export default function DecoradoForm() {
  const [producto, setProducto] = useState(PRODUCTOS[0]);
  const [cantidad, setCantidad] = useState("");
  const [tecnica, setTecnica] = useState(TECNICAS[0]);
  const [marca, setMarca] = useState("");
  const [comentarios, setComentarios] = useState("");

  function buildUrl() {
    const lines = [
      "Hola DC Inc! Quiero cotizar un decorado:",
      "",
      `• Producto base: ${producto}`,
      `• Cantidad estimada: ${cantidad || "a definir"}`,
      `• Técnica: ${tecnica}`,
    ];
    if (marca) lines.push(`• Marca / logo: ${marca}`);
    if (comentarios) lines.push(`• Comentarios: ${comentarios}`);
    lines.push("", "Les paso el archivo del arte por acá.");
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  return (
    <div className="card" style={{ padding: "28px", maxWidth: "640px" }}>
      <h3 className="h-md" style={{ fontSize: "20px", marginBottom: "4px" }}>
        Cotizá tu decorado
      </h3>
      <p style={{ fontSize: "14px", color: "var(--muted)", marginBottom: "22px" }}>
        Completá estos datos y seguimos por WhatsApp, donde coordinamos el arte y
        te enviamos una muestra antes de producir.
      </p>

      <div style={{ display: "grid", gap: "16px" }}>
        <Select label="Producto base" value={producto} onChange={setProducto} options={PRODUCTOS} />
        <Field
          label="Cantidad estimada (unidades)"
          value={cantidad}
          onChange={setCantidad}
          placeholder="Ej: 500"
          inputMode="numeric"
        />
        <Select label="Técnica de decoración" value={tecnica} onChange={setTecnica} options={TECNICAS} />
        <Field label="Marca / logo (opcional)" value={marca} onChange={setMarca} placeholder="Nombre de tu marca" />
        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
            Comentarios (opcional)
          </span>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            rows={3}
            placeholder="Colores, ubicación del logo, fecha que lo necesitás…"
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

      <a
        className="btn btn-wa btn-lg"
        style={{ marginTop: "22px", display: "inline-flex" }}
        href={buildUrl()}
        target="_blank"
        rel="noopener"
      >
        Enviar cotización por WhatsApp
      </a>
      <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)" }}>
        El archivo del arte (logo en alta, PDF/AI/PNG) lo enviás directamente por
        WhatsApp cuando te respondamos.
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
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

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--r-sm)",
          fontSize: "14px",
          background: "#fff",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
