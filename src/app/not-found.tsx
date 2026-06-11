import Link from "next/link";
import { waSimpleURL } from "@/lib/whatsapp";

export default function NotFound() {
  return (
    <div
      className="wrap"
      style={{
        padding: "96px 24px",
        textAlign: "center",
        minHeight: "60vh",
        display: "grid",
        justifyItems: "center",
        alignContent: "center",
        gap: "16px",
      }}
    >
      <span className="eyebrow">Error 404</span>
      <h1 className="h-lg" style={{ maxWidth: "18ch" }}>
        Esta página no existe
      </h1>
      <p className="lead" style={{ maxWidth: "46ch" }}>
        Puede que el producto haya cambiado de nombre o el enlace esté roto.
        Probá desde el catálogo o escribinos.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link className="btn btn-primary btn-lg" href="/productos">
          Ver catálogo
        </Link>
        <a
          className="btn btn-wa btn-lg"
          href={waSimpleURL("Hola DC Inc! No encontré lo que buscaba en la web.")}
          target="_blank"
          rel="noopener"
        >
          Escribinos por WhatsApp
        </a>
      </div>
    </div>
  );
}
