export const metadata = { title: "Términos y condiciones" };

export default function TerminosPage() {
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px", maxWidth: "760px" }}>
      <span className="eyebrow">Legales</span>
      <h1 className="h-lg" style={{ marginTop: "12px" }}>
        Términos y condiciones
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "8px" }}>
        Borrador — sujeto a revisión legal antes del go-live.
      </p>

      <div style={{ marginTop: "28px", display: "grid", gap: "22px", lineHeight: 1.7, color: "var(--ink)" }}>
        <Section title="1. Quiénes somos">
          DC Inc SRL es un distribuidor mayorista de packaging y cristalería para
          bebidas. Estos términos regulan el uso del sitio y la compra de
          productos a través del mismo.
        </Section>
        <Section title="2. Operación mayorista">
          Las ventas son mayoristas, por bulto cerrado, con un pedido mínimo de
          $150.000 + IVA. Los precios mayoristas se muestran a los clientes
          registrados y aprobados por DC Inc.
        </Section>
        <Section title="3. Precios y facturación">
          Los precios se expresan en pesos argentinos e incluyen/excluyen IVA
          según se indique. Emitimos factura A, B o E según la condición fiscal
          del cliente. Los precios pueden variar sin previo aviso hasta la
          confirmación del pedido.
        </Section>
        <Section title="4. Pedidos y cierre">
          El sitio permite armar un pedido y enviarlo para cotización. El cierre,
          el pago y la coordinación del envío se realizan por WhatsApp con un
          representante. Ningún pago se procesa en línea.
        </Section>
        <Section title="5. Envíos">
          Realizamos envíos a todo el país a través de transportes con convenio.
          Los plazos son orientativos (24-48 hs para envases en stock; ~1 mes para
          trabajos con decorado) y se confirman al cerrar el pedido.
        </Section>
        <Section title="6. Decorado y personalización">
          Los trabajos de serigrafía/decorado requieren aprobación de arte y, en
          su caso, de una muestra previa. Los plazos y mínimos se informan en cada
          cotización.
        </Section>
        <Section title="7. Contacto">
          Ante cualquier consulta, escribinos a info@dcinc.com.ar o por WhatsApp
          al +54 9 11 6107 2310.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="h-md" style={{ fontSize: "18px", marginBottom: "6px" }}>
        {title}
      </h2>
      <p style={{ color: "var(--muted)", fontSize: "15px" }}>{children}</p>
    </div>
  );
}
