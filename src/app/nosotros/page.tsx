import Image from "next/image";
import Link from "next/link";
import { waSimpleURL } from "@/lib/whatsapp";
import { getClients } from "@/lib/sanity-data";
import type { SanityClient } from "@/lib/queries";

export const revalidate = 300;

const NOSOTROS_DESC =
  "Desde 2018 le ponemos envase a las bebidas argentinas: botellas, latas, tapas, cajas, botellones, vasos, copas y decorado propio. Logística del vidrio propia y stock real.";

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

/* NOTA: texto institucional FINAL — versión aprobada por Marce (mail 21-jul-2026). */
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
            Envases para los que hacen bebidas
          </h1>
        </div>
        <Link className="btn btn-ghost" href="/productos">
          Ver catálogo →
        </Link>
      </div>

      <div style={{ maxWidth: "62ch", display: "grid", gap: "18px" }}>
        <p className="lead">
          Desde 2018 le ponemos envase a las bebidas argentinas. Botellas y
          latas, tapas, cajas, botellones, vasos, copas y decorado propio: todo
          lo que una cervecería, destilería, bodega o bar necesita para salir a
          la calle con su producto.
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Trabajamos con más de 1.600 clientes en todo el país y un catálogo de
          alrededor de 300 productos —con sus distintas presentaciones y
          medidas—, con stock real y precios claros. No vendemos por vender:
          tenés un vendedor asignado que te atiende por WhatsApp y te ayuda a
          pedir justo lo que necesitás, ni de más ni de menos.
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Nuestro diferencial es doble. Por un lado, la logística del vidrio
          —esa que muchos transportes esquivan— la resolvemos nosotros: entrega
          en CABA y GBA y red de transportes al interior. Por el otro, decorado
          y serigrafía propios, para que pongas tu marca en el envase sin
          intermediarios y con tiempos que cumplimos.
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          Y si necesitás poco, también. Fraccionamos por caja: no hace falta que
          te lleves un pallet entero para arrancar. Pedís lo que tu producción
          necesita hoy y escalás cuando toque.
        </p>
      </div>

      <div className="grid grid-3" style={{ marginTop: "48px" }}>
        <Value title="Confiable" body="Stock real y plazos que cumplimos: 24/48 h en insumos genéricos, 10 a 15 días hábiles en personalizados." />
        <Value title="Cercano" body="Un vendedor asignado que te responde por WhatsApp y te ayuda a armar el pedido." />
        <Value title="Completo" body="Del envase a la tapa, la caja y el decorado: resolvés todo con un solo proveedor." />
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
