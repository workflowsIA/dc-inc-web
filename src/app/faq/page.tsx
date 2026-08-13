import Link from "next/link";
import { waSimpleURL } from "@/lib/whatsapp";

export const metadata = {
  title: "Preguntas frecuentes",
  description:
    "Mínimo de compra, bulto cerrado, factura A/B/E, decorado, plazos, formas de pago y envíos. Todo lo que un mayorista necesita saber para comprar en DC Inc.",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "¿Cuál es el mínimo de compra?",
    a: "El pedido mínimo es de $150.000 + IVA. Podés combinar distintos productos del catálogo para llegar al mínimo.",
  },
  {
    q: "¿Se vende por bulto cerrado?",
    a: "Sí, la mayoría de los productos se comercializan por bulto cerrado. En la ficha de cada producto ves las unidades por bulto y por pallet.",
  },
  {
    q: "¿Qué tipo de factura emiten?",
    a: "Emitimos factura A, B o E según tu condición fiscal y tu operación.",
  },
  {
    q: "¿Hacen decorado o serigrafía?",
    a: "Sí, tenemos servicio de decorado propio: serigrafía (1 color, 2 colores o full color), calcos y grabado. Coordinamos el arte, te enviamos una muestra y producimos. El plazo típico de decorado es de 20 a 30 días hábiles.",
  },
  {
    q: "¿Cuáles son los plazos de entrega?",
    a: "Los envases en stock se despachan en 24 a 48 hs. Los pedidos con decorado tardan de 20 a 30 días hábiles. Al confirmar el pedido coordinamos la fecha exacta por WhatsApp.",
  },
  {
    q: "¿Cómo son los envíos?",
    a: "Enviamos a todo el país con transportes con convenio que se hacen cargo del vidrio. El costo se coordina por WhatsApp al confirmar el pedido, según destino y volumen.",
  },
  {
    q: "¿Qué formas de pago aceptan?",
    a: "Aceptamos tarjeta de crédito, cheques electrónicos, transferencia, depósito y efectivo. El pago se coordina por WhatsApp al confirmar el pedido.",
  },
  {
    q: "¿Cómo me registro como mayorista?",
    a: "Creás tu cuenta con el mail, los datos de tu empresa y el CUIT. DC Inc revisa el registro y, una vez aprobado, vas a ver los precios mayoristas en todo el catálogo. La aprobación suele tardar menos de 24 hs hábiles.",
  },
];

export default function FaqPage() {
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <span className="eyebrow">Preguntas frecuentes</span>
      <h1 className="h-lg" style={{ marginTop: "12px", maxWidth: "16ch" }}>
        Todo lo que necesitás saber antes de comprar
      </h1>

      <div style={{ marginTop: "40px", maxWidth: "760px", display: "grid", gap: "12px" }}>
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="card"
            style={{ padding: "0", overflow: "hidden" }}
          >
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                padding: "18px 22px",
                fontFamily: "var(--display)",
                fontWeight: 600,
                fontSize: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
              }}
            >
              {f.q}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>+</span>
            </summary>
            <p
              style={{
                padding: "0 22px 20px",
                color: "var(--muted)",
                fontSize: "14px",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {f.a}
            </p>
          </details>
        ))}
      </div>

      <div
        className="card"
        style={{
          marginTop: "48px",
          padding: "28px",
          maxWidth: "760px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "4px" }}>
            ¿No encontraste tu respuesta?
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            Escribinos y te respondemos enseguida.
          </p>
        </div>
        <a
          className="btn btn-wa btn-lg"
          href={waSimpleURL("Hola DC Inc! Tengo una consulta.")}
          target="_blank"
          rel="noopener"
        >
          Consultar por WhatsApp
        </a>
      </div>

      <p style={{ marginTop: "24px", fontSize: "14px" }}>
        <Link href="/logistica" style={{ color: "var(--muted)" }}>
          Ver también cómo trabajamos y nuestras condiciones →
        </Link>
      </p>
    </div>
  );
}
