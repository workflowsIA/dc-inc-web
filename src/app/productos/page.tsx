import Link from "next/link";
import ProductCard from "@/components/blocks/ProductCard";
import { PRODUCTS, CATS, GLASS } from "@/data/products";
import { isWholesale } from "@/lib/user";
import { getProducts, toLegacyProduct } from "@/lib/sanity-data";

export const revalidate = 60;

/** Catálogo. Productos de Sanity (323 SKUs migrados del Wix). Si Sanity
 *  no responde por alguna razón, fallback al mock de 16 productos. */
export default async function CatalogPage() {
  const wholesale = await isWholesale();
  let products = PRODUCTS;
  try {
    const sanityProducts = await getProducts();
    if (sanityProducts.length > 0) {
      products = sanityProducts.map(toLegacyProduct);
    }
  } catch (e) {
    console.error("[catalog] Sanity fetch failed, usando mock:", (e as Error).message);
  }
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

      <div className="catalog-layout">
        {/* SIDEBAR FILTROS — estáticos por ahora */}
        <aside className="catalog-aside">
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
          {products.map((p) => (
            <ProductCard key={p.id} product={p} wholesale={wholesale} />
          ))}
        </div>
      </div>
    </div>
  );
}
