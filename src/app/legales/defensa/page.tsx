import Link from "next/link";

export const metadata = { title: "Defensa al consumidor" };

export default function DefensaPage() {
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px", maxWidth: "760px" }}>
      <span className="eyebrow">Legales</span>
      <h1 className="h-lg" style={{ marginTop: "12px" }}>
        Defensa al consumidor
      </h1>
      <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "8px" }}>
        Borrador — sujeto a revisión legal antes del go-live.
      </p>

      <div style={{ marginTop: "28px", display: "grid", gap: "22px", lineHeight: 1.7 }}>
        <p style={{ color: "var(--muted)", fontSize: "15px" }}>
          En DC Inc SRL operamos en cumplimiento de la Ley 24.240 de Defensa del
          Consumidor y normas complementarias. Si tenés un reclamo, escribinos a{" "}
          <a href="mailto:info@dcinc.com.ar" style={{ color: "var(--amber-deep)", fontWeight: 600 }}>
            info@dcinc.com.ar
          </a>{" "}
          y te responderemos a la brevedad.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "15px" }}>
          Para consultas o denuncias ante la autoridad de aplicación, podés
          comunicarte con la Dirección Nacional de Defensa del Consumidor a través
          de sus canales oficiales.
        </p>
        <div
          className="card"
          style={{ padding: "20px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}
        >
          <span style={{ fontSize: "14px", color: "var(--muted)" }}>
            ¿Tenés un reclamo o consulta?
          </span>
          <Link className="btn btn-primary btn-sm" href="/faq">
            Ver preguntas frecuentes
          </Link>
        </div>
      </div>
    </div>
  );
}
