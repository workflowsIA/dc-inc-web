import Link from "next/link";
import ProductCard from "@/components/blocks/ProductCard";
import { PRODUCTS } from "@/data/products";
import type { Product } from "@/data/products";
import { isWholesale } from "@/lib/user";
import { getProducts, toLegacyProduct } from "@/lib/sanity-data";

export const revalidate = 60;

interface SearchParams {
  q?: string;
  cat?: string;
  sub?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Catálogo. Productos de Sanity (323 SKUs migrados del Wix). Si Sanity
 *  no responde, fallback al mock. Filtra por ?q= / ?cat= / ?sub=. */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, cat, sub } = await searchParams;
  const wholesale = await isWholesale();

  let products: Product[] = PRODUCTS;
  try {
    const sanityProducts = await getProducts();
    if (sanityProducts.length > 0) {
      products = sanityProducts.map(toLegacyProduct);
    }
  } catch (e) {
    console.error("[catalog] Sanity fetch failed, usando mock:", (e as Error).message);
  }

  // Categorías y subtipos reales, derivados del catálogo (no hardcodeados)
  const cats = [...new Set(products.map((p) => p.cat).filter(Boolean))].sort();
  const subs = [...new Set(products.map((p) => p.sub).filter(Boolean))].sort();

  // Filtrado
  const qn = q ? norm(q) : "";
  const filtered = products.filter((p) => {
    if (cat && p.cat !== cat) return false;
    if (sub && p.sub !== sub) return false;
    if (qn) {
      const hay = norm(`${p.name} ${p.sku} ${p.cat} ${p.sub}`);
      if (!hay.includes(qn)) return false;
    }
    return true;
  });

  const hasFilter = !!(q || cat || sub);

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">
            Catálogo · {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
            {hasFilter ? " (filtrado)" : ""}
          </span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            {q ? `Resultados para "${q}"` : "Todo nuestro packaging y cristalería"}
          </h1>
        </div>
        <Link className="btn btn-ghost" href="/">
          ← Volver al inicio
        </Link>
      </div>

      <div className="catalog-layout">
        {/* SIDEBAR FILTROS */}
        <aside className="catalog-aside">
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--r-lg)",
              padding: "20px",
              background: "#fff",
            }}
          >
            {hasFilter && (
              <Link
                href="/productos"
                className="btn btn-ghost btn-sm"
                style={{ marginBottom: "16px", width: "100%" }}
              >
                Limpiar filtros
              </Link>
            )}

            <h4 className="h-md" style={{ fontSize: "16px", marginBottom: "16px" }}>
              Categoría
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
              {cats.map((c) => (
                <li key={c}>
                  <Link
                    href={`/productos?cat=${encodeURIComponent(c)}`}
                    style={{
                      fontSize: "14px",
                      color: c === cat ? "var(--amber-deep)" : "var(--muted)",
                      fontWeight: c === cat ? 700 : 400,
                    }}
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>

            {subs.length > 0 && (
              <>
                <h4 className="h-md" style={{ fontSize: "16px", margin: "24px 0 16px" }}>
                  Tipo de cristalería
                </h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
                  {subs.map((g) => (
                    <li key={g}>
                      <Link
                        href={`/productos?sub=${encodeURIComponent(g)}`}
                        style={{
                          fontSize: "14px",
                          color: g === sub ? "var(--amber-deep)" : "var(--muted)",
                          fontWeight: g === sub ? 700 : 400,
                        }}
                      >
                        {g}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>

        {/* GRILLA */}
        {filtered.length > 0 ? (
          <div className="grid grid-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} wholesale={wholesale} />
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--muted)",
              border: "1px dashed var(--line-2)",
              borderRadius: "var(--r-lg)",
              alignSelf: "start",
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: "8px" }}>
              No encontramos productos con ese filtro.
            </p>
            <Link href="/productos" className="btn btn-ghost btn-sm" style={{ marginTop: "8px" }}>
              Ver todo el catálogo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
