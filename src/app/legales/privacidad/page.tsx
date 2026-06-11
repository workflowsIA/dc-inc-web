export const metadata = { title: "Política de privacidad" };

export default function PrivacidadPage() {
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px", maxWidth: "760px" }}>
      <span className="eyebrow">Legales</span>
      <h1 className="h-lg" style={{ marginTop: "12px" }}>
        Política de privacidad
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "8px" }}>
        Borrador — sujeto a revisión legal antes del go-live.
      </p>

      <div style={{ marginTop: "28px", display: "grid", gap: "22px", lineHeight: 1.7, color: "var(--ink)" }}>
        <Section title="1. Datos que recopilamos">
          Recopilamos los datos que nos brindás al registrarte o al armar un
          pedido: nombre, empresa, CUIT, email y teléfono. No procesamos pagos en
          línea, por lo que no almacenamos datos de tarjetas.
        </Section>
        <Section title="2. Para qué los usamos">
          Usamos tus datos para gestionar tu cuenta mayorista, aprobar tu
          registro, cotizar y coordinar pedidos, y contactarte sobre tu operación.
          No vendemos ni cedemos tus datos a terceros.
        </Section>
        <Section title="3. Autenticación">
          La gestión de cuentas se realiza con un proveedor de autenticación de
          terceros (Clerk). Tus credenciales se administran de forma segura en esa
          plataforma.
        </Section>
        <Section title="4. Derechos">
          Podés solicitar el acceso, la rectificación o la eliminación de tus
          datos escribiéndonos a info@dcinc.com.ar. El titular de los datos tiene
          derecho a ejercer las facultades previstas por la Ley 25.326 de
          Protección de Datos Personales.
        </Section>
        <Section title="5. Cookies">
          Utilizamos cookies y almacenamiento local estrictamente necesarios para
          el funcionamiento del sitio (por ejemplo, mantener tu carrito y tu
          sesión).
        </Section>
        <Section title="6. Contacto">
          Por consultas sobre privacidad, escribinos a info@dcinc.com.ar.
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
