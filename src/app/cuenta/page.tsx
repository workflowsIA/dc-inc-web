import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";

/** Página de cuenta: pestañas login + registro mayorista. */
export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const mode = tab === "registro" ? "signup" : "signin";

  return (
    <div
      className="wrap"
      style={{
        padding: "48px 24px 80px",
        maxWidth: "560px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <span className="eyebrow">Acceso · Soy mayorista</span>
        <h1 className="h-lg" style={{ marginTop: "12px" }}>
          {mode === "signup" ? "Registrate como mayorista" : "Ingresá a tu cuenta"}
        </h1>
        <p className="lead" style={{ marginTop: "10px" }}>
          Los mayoristas aprobados ven precios diferenciados y pueden repetir
          pedidos al toque.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        {mode === "signup" ? (
          <SignUp
            routing="hash"
            signInUrl="/cuenta"
            forceRedirectUrl="/mi-cuenta"
          />
        ) : (
          <SignIn
            routing="hash"
            signUpUrl="/cuenta?tab=registro"
            forceRedirectUrl="/mi-cuenta"
          />
        )}
      </div>

      <p style={{ textAlign: "center", marginTop: "24px", color: "var(--muted)" }}>
        {mode === "signup" ? (
          <>
            ¿Ya tenés cuenta?{" "}
            <Link href="/cuenta" style={{ color: "var(--amber-deep)", fontWeight: 600 }}>
              Ingresá
            </Link>
          </>
        ) : (
          <>
            ¿No tenés cuenta?{" "}
            <Link
              href="/cuenta?tab=registro"
              style={{ color: "var(--amber-deep)", fontWeight: 600 }}
            >
              Registrate
            </Link>
          </>
        )}
      </p>

      <div
        style={{
          marginTop: "40px",
          padding: "16px 20px",
          background: "var(--amber-soft)",
          borderRadius: "var(--r)",
          fontSize: "13px",
          color: "var(--charcoal)",
        }}
      >
        <strong>Cómo funciona el alta mayorista:</strong> creás tu cuenta con
        mail + datos de empresa. DC Inc aprueba tu cuenta manualmente (1
        día hábil) y a partir de ahí ves precios mayoristas en todo el catálogo.
      </div>
    </div>
  );
}
