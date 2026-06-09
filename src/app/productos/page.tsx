import Link from "next/link";
import ProductCard from "@/components/blocks/ProductCard";
import { PRODUCTS, CATS, GLASS } from "@/data/products";

/** Catálogo. PLACEHOLDER de filtros funcionales: el wireframe los tiene en JS,
 *  acá los renderizo estáticos. Filtrado real se conecta con server actions
 *  en cuanto Sanity esté online. */
export default function CatalogPage() {
  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">Catálogo · ~300 SKUs</span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            Todo nuestro packaging y cristalería
          </h1>
        </div>
        <Link className="btn btn-ghost" href="/">
          ← Volver al inicio
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: "32px",
          alignItems: "start",
        }}
      >
        {/* SIDEBAR FILTROS — estáticos por ahora */}
        <aside style={{ position: "sticky", top: "80px" }}>
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              padding: "20px",
              background: "#fff",
            }}
          >
            <h4 className="h-md" style={{ fontSize: "16px", marginBottom: "16px" }}>
              Categoría
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
              {CATS.map((c) => (
                <li key={c}>
                  <Link
                    href={`/productos?cat=${encodeURIComponent(c)}`}
                    style={{ fontSize: "14px", color: "var(--muted)" }}
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="h-md" style={{ fontSize: "16px", margin: "24px 0 16px" }}>
              Tipo de cristalería
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
              {GLASS.map((g) => (
                <li key={g}>
                  <Link
                    href={`/productos?sub=${encodeURIComponent(g)}`}
                    style={{ fontSize: "14px", color: "var(--muted)" }}
                  >
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* GRILLA */}
        <div className="grid grid-3">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
