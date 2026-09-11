import Link from "next/link";
import DecoradoForm from "@/components/blocks/DecoradoForm";

// Textos revisados contra los documentos de Decorado (28-ago) y Logística
// (29-ago) y aprobados por Marce el 10-sep-2026, punto por punto. Ver
// `DC INC/Correcciones_Textos_Logistica_Decorado_DC_Inc.md`.
// Las dos salvedades que puso: la nota de la tabla habla de la TINTA
// (vitrificable 580° vs epoxi 250°), no de la técnica; y la serigrafía
// indirecta también se hace sobre botellas.

export const metadata = {
  title: "Decorado y personalización de vasos, botellas y cajas | DC Inc",
  description:
    "Personalizamos vasos, copas, botellas, botellones, cajas y estuches para marcas de bebidas. Desde 24 unidades, hasta 6 colores, envíos a todo el país.",
};

/** Técnicas reales, por producto. Reemplaza la lista vieja, que ofrecía full
 *  color sobre vidrio y grabado — ninguno de los dos existe — y presentaba el
 *  calco como la opción para tiradas chicas cuando es la más usada. */
const TECNICAS = [
  {
    tecnica: "Serigrafía indirecta",
    detalle: "calco vitrificable",
    sobre: "Vasos y copas — la que usamos en la mayoría de los trabajos",
    desde: "24 un.",
    colores: "Hasta 6",
  },
  {
    tecnica: "Serigrafía indirecta",
    detalle: "calco vitrificable",
    sobre: "Botellas y botellones — conveniente para envases retornables",
    desde: "Consultar",
    colores: "Más de 2",
  },
  {
    tecnica: "Serigrafía directa",
    detalle: "tinta epoxi",
    sobre: "Vasos y copas",
    desde: "500 un.",
    colores: "Hasta 2, admite Pantone",
  },
  {
    tecnica: "Serigrafía directa",
    detalle: null,
    sobre: "Botellas y botellones",
    desde: "24 un.",
    colores: "Hasta 2, sin costo de matriz",
  },
  {
    tecnica: "Flexografía",
    detalle: null,
    sobre: "Cajas de cartón",
    desde: "500 un. con pool de compra",
    colores: "Hasta 2, con Pantone",
  },
  {
    tecnica: "Impresión digital o serigrafía",
    detalle: null,
    sobre: "Estuches",
    desde: "1.000 un. full color · 40 un. a 1 color",
    colores: "Sin costo de matriz",
  },
  {
    tecnica: "Tampografía",
    detalle: null,
    sobre: "Tapas",
    desde: "Hasta 4.000 un.",
    colores: "Todos",
  },
];

/** Siete pasos: el proceso publicado antes se salteaba el anticipo del 50% y
 *  prometía una muestra física que sólo existe a pedido y con costo. */
const PROCESO = [
  {
    n: 1,
    title: "Consulta y cotización",
    body: "Definimos producto, técnica, cantidad, tamaño de impresión, colores y caras.",
  },
  {
    n: 2,
    title: "Anticipo del 50%",
    body: "Con el diseño definitivo y el anticipo acreditado arranca el trabajo. El 50% restante se abona cuando el pedido está listo para entregar.",
  },
  {
    n: 3,
    title: "Revisión del arte",
    body: "Verificamos formato, colores posibles según la técnica, tamaño y registro.",
  },
  {
    n: 4,
    title: "Mockup digital",
    body: "Te enviamos una simulación de la pieza con tu diseño aplicado. Sin esa aprobación no se manda a producción.",
  },
  { n: 5, title: "Producción", body: "Producimos la tirada completa con tu marca." },
  {
    n: 6,
    title: "Foto del primer ejemplar",
    body: "En cristalería y envases te mandamos una foto de la primera pieza para validar la posición de la impresión.",
  },
  { n: 7, title: "Saldo, entrega o despacho", body: "Coordinamos el despacho a todo el país." },
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
      <p className="lead" style={{ maxWidth: "62ch" }}>
        Decoramos y personalizamos prácticamente todo lo que vendemos: vasos, copas,
        botellas, botellones, cajas de cartón, estuches y tapas. Vendemos el producto y
        lo decoramos nosotros, así que resolvés en un solo lugar el envase, la
        cristalería, la caja y la impresión.
      </p>
      <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <a className="btn btn-primary btn-lg" href="#cotizar">
          Cotizar mi decorado
        </a>
        <Link className="btn btn-ghost btn-lg" href="/productos">
          Ver productos base
        </Link>
      </div>

      {/* TÉCNICAS */}
      <div style={{ marginTop: "64px" }}>
        <span className="eyebrow">Técnicas disponibles</span>
        <h2 className="h-md" style={{ marginTop: "12px", fontSize: "24px" }}>
          Qué técnica va sobre cada producto
        </h2>
        <div style={{ marginTop: "24px", overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "620px",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr>
                {["Técnica", "Sobre qué", "Desde", "Colores"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "10px 16px 10px 0",
                      borderBottom: "2px solid var(--line-2, var(--line))",
                      fontSize: "12px",
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TECNICAS.map((t, i) => (
                <tr key={`${t.tecnica}-${i}`}>
                  <td style={{ padding: "12px 16px 12px 0", borderBottom: "1px solid var(--line)", fontWeight: 600 }}>
                    {t.tecnica}
                    {t.detalle && (
                      <span style={{ display: "block", fontWeight: 400, color: "var(--muted)", fontSize: "13px" }}>
                        {t.detalle}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px 12px 0", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                    {t.sobre}
                  </td>
                  <td style={{ padding: "12px 16px 12px 0", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {t.desde}
                  </td>
                  <td style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                    {t.colores}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--muted)", maxWidth: "62ch" }}>
          La <strong>tinta vitrificable</strong> se hornea a más de 580 °C: se funde con
          el vidrio y pasa a formar parte de la pieza. La <strong>tinta epoxi</strong> se
          hornea a 250 °C.
        </p>
      </div>

      {/* LATAS */}
      <div style={{ marginTop: "48px" }}>
        <div className="card" style={{ padding: "24px", maxWidth: "68ch" }}>
          <h3 className="h-md" style={{ fontSize: "17px", marginBottom: "8px" }}>
            Latas de aluminio: por qué no las decoramos
          </h3>
          <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.7 }}>
            El aluminio de la lata es demasiado fino y frágil para imprimirlo una vez
            fabricado: no resiste el proceso. La única forma de personalizar una lata es
            la litografía durante la fabricación, que exige tiradas muy por encima de los
            volúmenes del mercado artesanal argentino. La alternativa real es la etiqueta
            autoadhesiva o el sleeve, que se aplican sobre la lata ya llena. En casos
            puntuales lo resolvemos nosotros y, cuando no, te recomendamos empresas de
            etiquetas y fundas con las que sabemos cómo se trabaja.
          </p>
        </div>
      </div>

      {/* PROCESO */}
      <div style={{ marginTop: "64px" }}>
        <span className="eyebrow">Cómo funciona</span>
        <h2 className="h-md" style={{ marginTop: "12px", fontSize: "24px" }}>
          De tu logo al producto en 7 pasos
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
        <p style={{ marginTop: "16px", fontSize: "14px", color: "var(--muted)", maxWidth: "62ch" }}>
          <strong>Plazos:</strong> 15 a 18 días hábiles en cristalería, botellas,
          botellones, cajas, estuches y tapas. Se cuentan desde que está acreditado el
          anticipo y aprobado el mockup, no desde la consulta. Si entrás en un pool de
          compra, sumá una semana.
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
