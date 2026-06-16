import Image from "next/image";
import Link from "next/link";
import { waSimpleURL } from "@/lib/whatsapp";
import { getClients } from "@/lib/sanity-data";
import type { SanityClient } from "@/lib/queries";

export const revalidate = 300;

const NOSOTROS_DESC =
  "DC Inc es distribuidor B2B de packaging y cristalería para bebidas en Argentina desde 2018. Botellas, latas, cajas, copas, vasos y decorado propio.";

export const metadata = {
  title: "Nosotros",
  description: NOSOTROS_DESC,
  alternates: { canonical: "/nosotros" },
  openGraph: {
    title: "Nosotros · DC Inc",
    description: NOSOTROS_DESC,
    url: "/nosotros",
    type: "website",
  },
};

/* NOTA: texto institucional placeholder basado en el brief — pendiente de
   redacción final de Marce (ver placeholders-y-pedidos-web-mvp). */
export default async function NosotrosPage() {
  // Clientes de la vidriera (schema `client`). Si no hay, ocultamos la sección.
  let clients: SanityClient[] = [];
  try {
    clients = await getClients();
  } catch {
    // sin Sanity → sección oculta
  }

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Nosotros</span>
          <h1 className="h-lg" style={{ marginTop: "12px", maxWidth: "18ch" }}>
            Packaging y cristalería para los que hacen bebidas
          </h1>
        </div>
        <Link className="btn btn-ghost" href="/productos">
          Ver catálogo →
        </Link>
      </div>

      <div style={{ maxWidth: "62ch", display: "grid", gap: "18px" }}>
        <p className="lead">
          Desde 2018 abastecemos a quienes producen y venden bebidas en
          Argentina: cervecerías independientes, destilerías, bodegas, bares y
          fábricas. Botellas, latas, cajas, copas, vasos, botellones, tapas,
          accesorios y servicio de decorado propio.
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Trabajamos B2B con más de 1.600 clientes activos y un catálogo de
          alrededor de 300 productos. Somos un proveedor industrial serio para
          gente que ya sabe lo que necesita: stock real, precios claros para
          mayoristas y atención directa por WhatsApp con un vendedor asignado.
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Nuestro diferencial es la logística del vidrio —algo que muchos
          transportes no aceptan— y un servicio de decorado y serigrafía propio
          que te permite poner tu marca en el producto sin intermediarios.
        </p>
      </div>

      <div className="grid grid-3" style={{ marginTop: "48px" }}>
        <Value title="Confiable" body="Stock real y plazos que cumplimos. Lo que ves disponible, está." />
        <Value title="Eficiente" body="Carga de pedido simple y cotización al instante por WhatsApp." />
        <Value title="Conveniente" body="Precios mayoristas, mínimo accesible y factura A, B o E." />
      </div>

      {/* CLIENTES QUE CONFÍAN — schema `client` (getClients). Sin clientes
          cargados, la sección no se muestra. */}
      {clients.length > 0 && (
        <div style={{ marginTop: "64px" }}>
          <span className="eyebrow">Marcas que confían en nosotros</span>
          <h2 className="h-md" style={{ marginTop: "12px", fontSize: "24px" }}>
            Producimos para algunas de las mejores marcas del rubro
          </h2>
          <div className="grid grid-4" style={{ marginTop: "24px" }}>
            {clients.map((c) => (
              <div
                key={c._id}
                title={c.name}
                style={{
                  aspectRatio: "3/2",
                  background: "var(--bg-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "12px",
                }}
              >
                {c.logo ? (
                  <Image
                    src={c.logo}
                    alt={c.name}
                    width={160}
                    height={80}
                    unoptimized
                    style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%", width: "auto" }}
                  />
                ) : (
                  c.name
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          marginTop: "64px",
          padding: "40px",
          textAlign: "center",
          display: "grid",
          gap: "16px",
          justifyItems: "center",
        }}
      >
        <h2 className="h-md" style={{ fontSize: "24px", maxWidth: "20ch" }}>
          ¿Listo para hacer tu primer pedido?
        </h2>
        <p style={{ color: "var(--muted)", maxWidth: "44ch" }}>
          Armá tu pedido desde el catálogo o escribinos y te asesoramos.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="btn btn-primary btn-lg" href="/productos">
            Ver catálogo
          </Link>
          <a
            className="btn btn-wa btn-lg"
            href={waSimpleURL("Hola DC Inc! Quiero más información.")}
            target="_blank"
            rel="noopener"
          >
            Escribinos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <div className="card" style={{ padding: "24px" }}>
      <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "8px" }}>
        {title}
      </h3>
      <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}
