import Link from "next/link";
import DecoradoForm from "@/components/blocks/DecoradoForm";

export const metadata = {
  title: "Personalizá tu producto · Decorado y serigrafía",
  description:
    "Decorado propio: serigrafía 1 color, 2 colores o full color, calcos y grabado. Poné tu marca en botellas, latas, copas y vasos. Cotizá por WhatsApp.",
};

const TIPOS = [
  {
    title: "Serigrafía 1 color",
    body: "La opción más elegida para logos simples. Económica y de alto contraste sobre vidrio.",
  },
  {
    title: "Serigrafía 2 colores",
    body: "Para isologos con dos tintas o más detalle, manteniendo costos contenidos.",
  },
  {
    title: "Serigrafía full color",
    body: "Diseños complejos, degradés y fotografía sobre el producto.",
  },
  {
    title: "Calcos",
    body: "Calcomanías al horno para piezas con curvas o tiradas más chicas.",
  },
  {
    title: "Grabado",
    body: "Acabado premium permanente, ideal para cristalería de bar y destilados.",
  },
];

const PROCESO = [
  { n: 1, title: "Cotización", body: "Nos contás qué producto, cantidad y tipo de decoración querés." },
  { n: 2, title: "Arte", body: "Recibimos tu logo o diseño y lo adaptamos a la técnica elegida." },
  { n: 3, title: "Muestra", body: "Te enviamos una muestra para aprobar antes de producir." },
  { n: 4, title: "Producción", body: "Producimos la tirada completa con tu marca." },
  { n: 5, title: "Entrega", body: "Coordinamos el despacho a todo el país." },
];

export default function PersonalizaPage() {
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      {/* HERO */}
      <div className="section-head">
        <div>
          <span className="eyebrow">Personalización · Decorado propio</span>
          <h1 className="h-lg" style={{ marginTop: "12px", maxWidth: "20ch" }}>
            Poné tu marca en el producto
          </h1>
        </div>
      </div>
      <p className="lead" style={{ maxWidth: "60ch" }}>
        Tenemos servicio de decorado y serigrafía in-house. Botellas, latas,
        copas y vasos con tu logo, sin intermediarios y con muestra previa antes
        de producir.
      </p>
      <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <a className="btn btn-primary btn-lg" href="#cotizar">
          Cotizar mi decorado
        </a>
        <Link className="btn btn-ghost btn-lg" href="/productos">
          Ver productos base
        </Link>
      </div>

      {/* TIPOS DE DECORACIÓN */}
      <div style={{ marginTop: "64px" }}>
        <span className="eyebrow">Técnicas disponibles</span>
        <h2 className="h-md" style={{ marginTop: "12px", fontSize: "24px" }}>
          Elegí cómo querés tu marca
        </h2>
        <div className="grid grid-3" style={{ marginTop: "24px" }}>
          {TIPOS.map((t) => (
            <div key={t.title} className="card" style={{ padding: "24px" }}>
              <h3 className="h-md" style={{ fontSize: "17px", marginBottom: "8px" }}>
                {t.title}
              </h3>
              <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                {t.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* PROCESO */}
      <div style={{ marginTop: "64px" }}>
        <span className="eyebrow">Cómo funciona</span>
        <h2 className="h-md" style={{ marginTop: "12px", fontSize: "24px" }}>
          De tu logo al producto en 5 pasos
        </h2>
        <div className="grid grid-3" style={{ marginTop: "24px" }}>
          {PROCESO.map((p) => (
            <div key={p.n} className="card" style={{ padding: "24px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: "var(--amber-soft, var(--bg-2))",
                  color: "var(--amber-deep, var(--ink))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--mono)",
                  fontWeight: 700,
                  marginBottom: "12px",
                }}
              >
                {p.n}
              </div>
              <h3 className="h-md" style={{ fontSize: "17px", marginBottom: "6px" }}>
                {p.title}
              </h3>
              <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--muted)" }}>
          Plazo típico de un trabajo con decorado: alrededor de un mes desde la
          aprobación del arte.
        </p>
      </div>

      {/* FORM DE COTIZACIÓN */}
      <div style={{ marginTop: "64px" }} id="cotizar">
        <span className="eyebrow">Pedí tu presupuesto</span>
        <h2 className="h-md" style={{ marginTop: "12px", fontSize: "24px", marginBottom: "20px" }}>
          Armá tu cotización de decorado
        </h2>
        <DecoradoForm />
      </div>
    </div>
  );
}
