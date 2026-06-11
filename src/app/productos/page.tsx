import Link from "next/link";
import { X } from "lucide-react";
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
  page?: string;
}

const PER_PAGE = 24;

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
  const { q, cat, sub, page: pageParam } = await searchParams;
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

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(pageParam || "1", 10) || 1), totalPages);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // URL con un filtro removido (preserva los otros)
  const urlWithout = (drop: "q" | "cat" | "sub") => {
    const p = new URLSearchParams();
    if (q && drop !== "q") p.set("q", q);
    if (cat && drop !== "cat") p.set("cat", cat);
    if (sub && drop !== "sub") p.set("sub", sub);
    const qs = p.toString();
    return qs ? `/productos?${qs}` : "/productos";
  };

  // URL a una página (preserva filtros)
  const urlForPage = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (sub) p.set("sub", sub);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return qs ? `/productos?${qs}` : "/productos";
  };

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

        {/* CONTENIDO: chips de filtros activos + grilla */}
        <div>
          {hasFilter && (
            <div className="chips" style={{ marginBottom: "20px" }}>
              {q && (
                <Link className="chip on" href={urlWithout("q")}>
                  “{q}” <span className="chip-x"><X /></span>
                </Link>
              )}
              {cat && (
                <Link className="chip on" href={urlWithout("cat")}>
                  {cat} <span className="chip-x"><X /></span>
                </Link>
              )}
              {sub && (
                <Link className="chip on" href={urlWithout("sub")}>
                  {sub} <span className="chip-x"><X /></span>
                </Link>
              )}
              <Link className="chip" href="/productos">
                Limpiar todo
              </Link>
            </div>
          )}

          {filtered.length > 0 ? (
            <>
              <div className="grid grid-3">
                {paged.map((p) => (
                  <ProductCard key={p.id} product={p} wholesale={wholesale} />
                ))}
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    marginTop: "40px",
                  }}
                >
                  {page > 1 && (
                    <Link className="btn btn-ghost btn-sm" href={urlForPage(page - 1)}>
                      ← Anterior
                    </Link>
                  )}
                  <span className="mono" style={{ fontSize: "13px", color: "var(--muted)" }}>
                    Página {page} de {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link className="btn btn-ghost btn-sm" href={urlForPage(page + 1)}>
                      Siguiente →
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--muted)",
                border: "1px dashed var(--line-2)",
                borderRadius: "var(--r-lg)",
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
    </div>
  );
}
