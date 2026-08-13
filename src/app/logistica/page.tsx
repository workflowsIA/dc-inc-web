import Link from "next/link";
import { waSimpleURL } from "@/lib/whatsapp";

export const metadata = {
  title: "Cómo trabajamos · Logística y condiciones",
  description:
    "Envíos a todo el país con transportes con convenio que se hacen cargo del vidrio. Factura A/B/E, stock real y plazos 24-48 hs.",
};

const DIFERENCIALES = [
  {
    title: "Mayorista y minorista",
    body: "Atendemos pedidos por mayor y por menor. Coordinamos las condiciones según tu operación.",
  },
  {
    title: "Factura A, B o E",
    body: "Emitimos el comprobante que tu operación necesite.",
  },
  {
    title: "Stock real",
    body: "Lo que ves disponible en el catálogo está físicamente en depósito. Sin sorpresas al confirmar el pedido.",
  },
  {
    title: "Envíos a todo el país",
    body: "Logística propia en CABA y GBA, y transportes con convenio que se hacen cargo del vidrio para el resto del país.",
  },
  {
    title: "Decorado propio",
    body: "Decorado in-house: ponés tu marca en el producto sin intermediarios. Coordinamos arte y muestra por WhatsApp.",
  },
  {
    title: "Atención directa",
    body: "Un vendedor asignado por WhatsApp que está atento a lo que comprás, cómo lo recibís y cómo lo pagás.",
  },
];

const PLAZOS = [
  { label: "Insumos genéricos", value: "24 – 48 hs" },
  { label: "Personalizados", value: "20 – 30 días" },
];

const TRANSPORTES =
  "Logística propia en CABA y GBA · Andreani, Conte Hnos., Interprovincial, Mostto y Andesmar para el resto del país.";

export default function LogisticaPage() {
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Cómo trabajamos</span>
          <h1 className="h-lg" style={{ marginTop: "12px", maxWidth: "20ch" }}>
            Logística pensada para mercadería frágil
          </h1>
        </div>
        <Link className="btn btn-ghost" href="/productos">
          Ver catálogo →
        </Link>
      </div>

      <p className="lead" style={{ maxWidth: "60ch" }}>
        Mover mercadería frágil no es como mover cualquier cosa. Por eso armamos
        una operación que prioriza que el producto llegue entero y a tiempo, con
        condiciones claras desde el primer pedido.
      </p>

      <div className="grid grid-3" style={{ marginTop: "48px" }}>
        {DIFERENCIALES.map((d) => (
          <div key={d.title} className="card" style={{ padding: "24px" }}>
            <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "8px" }}>
              {d.title}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
              {d.body}
            </p>
          </div>
        ))}
      </div>

      {/* PLAZOS */}
      <div style={{ marginTop: "64px" }}>
        <span className="eyebrow">Plazos típicos</span>
        <div className="grid grid-2" style={{ marginTop: "16px", maxWidth: "640px" }}>
          {PLAZOS.map((p) => (
            <div
              key={p.label}
              className="card"
              style={{ padding: "24px", display: "grid", gap: "4px" }}
            >
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontSize: "28px",
                  fontWeight: 700,
                }}
              >
                {p.value}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "14px" }}>{p.label}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--muted)" }}>
          El costo de envío se coordina por WhatsApp al confirmar el pedido, según
          destino y volumen.
        </p>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
          <strong style={{ color: "var(--ink)" }}>Transportes:</strong> {TRANSPORTES}
        </p>
      </div>

      {/* CONTACTO / DIRECCIONES */}
      <div className="grid grid-2" style={{ marginTop: "64px", maxWidth: "760px" }}>
        <div className="card" style={{ padding: "24px" }}>
          <h3 className="h-md" style={{ fontSize: "16px", marginBottom: "10px" }}>
            Depósito
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.6 }}>
            Rivadavia 1831, Villa Maipú, San Martín
          </p>
        </div>
        <div className="card" style={{ padding: "24px" }}>
          <h3 className="h-md" style={{ fontSize: "16px", marginBottom: "10px" }}>
            Oficina
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.6 }}>
            Av. Álvarez Thomas 1171, Colegiales, CABA
          </p>
        </div>
      </div>
      <p style={{ marginTop: "16px", color: "var(--muted)", fontSize: "14px" }}>
        Horario de atención: lunes a viernes de 9 a 18 hs.
      </p>

      <div style={{ marginTop: "40px" }}>
        <a
          className="btn btn-wa btn-lg"
          href={waSimpleURL("Hola DC Inc! Quiero consultar por un envío.")}
          target="_blank"
          rel="noopener"
        >
          Consultar por un envío
        </a>
      </div>
    </div>
  );
}
