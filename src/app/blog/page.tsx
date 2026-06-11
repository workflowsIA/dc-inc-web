import Link from "next/link";

export const metadata = {
  title: "Blog · Guías de packaging y cristalería · DC Inc",
  description:
    "Guías técnicas sobre packaging para bebidas, tipos de vidrio, decorado y envío de cristalería. Próximamente.",
};

/* Layout listo para los artículos GEO del mes 2. El contenido se carga
   desde Sanity (schema blogPost) cuando estén publicados. Por ahora
   mostramos los temas planeados como "próximamente". */
const PROXIMOS = [
  {
    cat: "Packaging",
    title: "Guía de packaging para bebidas",
    body: "Cómo elegir botella, lata o caja según tu producto, tu volumen y tu logística.",
  },
  {
    cat: "Materiales",
    title: "Vidrio templado vs. común vs. PET",
    body: "Ventajas, costos y casos de uso de cada material para envasar bebidas.",
  },
  {
    cat: "Decorado",
    title: "Decorado y serigrafía: qué pedir y cómo cotizar",
    body: "Técnicas, plazos y qué necesitás tener listo para poner tu marca en el producto.",
  },
  {
    cat: "Logística",
    title: "Envío de cristalería: lo que tenés que saber",
    body: "Por qué el vidrio necesita transporte con convenio y cómo evitar roturas.",
  },
];

export default function BlogPage() {
  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <span className="eyebrow">Blog</span>
      <h1 className="h-lg" style={{ marginTop: "12px", maxWidth: "18ch" }}>
        Guías técnicas para elegir mejor
      </h1>
      <p className="lead" style={{ marginTop: "12px", maxWidth: "56ch" }}>
        Estamos preparando contenido práctico sobre packaging, materiales,
        decorado y logística. Estos son los primeros temas que vienen.
      </p>

      <div className="grid grid-2" style={{ marginTop: "40px", maxWidth: "820px" }}>
        {PROXIMOS.map((p) => (
          <div key={p.title} className="card" style={{ padding: "24px", display: "grid", gap: "10px" }}>
            <span className="eyebrow">{p.cat}</span>
            <h3 className="h-md" style={{ fontSize: "19px" }}>
              {p.title}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
              {p.body}
            </p>
            <span
              className="badge"
              style={{ justifySelf: "start", marginTop: "4px" }}
            >
              Próximamente
            </span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: "40px", fontSize: "14px" }}>
        <Link href="/productos" style={{ color: "var(--muted)" }}>
          Mientras tanto, explorá el catálogo →
        </Link>
      </p>
    </div>
  );
}
