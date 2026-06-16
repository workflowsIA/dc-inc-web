import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import ProductCard from "@/components/blocks/ProductCard";
import { PRODUCTS } from "@/data/products";
import type { Product } from "@/data/products";
import { isWholesale } from "@/lib/user";
import { getProducts, toLegacyProduct } from "@/lib/sanity-data";
import { resolveDisplayPrice } from "@/lib/pricing";
import { ars } from "@/lib/format";

export const revalidate = 60;

const CATALOG_DESC =
  "Catálogo mayorista de DC Inc: botellas, latas, cajas, copas, vasos, tapas y botellones para bebidas. Stock real, factura A/B/E y envíos a todo el país.";

export const metadata: Metadata = {
  title: "Catálogo de packaging y cristalería",
  description: CATALOG_DESC,
  alternates: { canonical: "/productos" },
  openGraph: {
    title: "Catálogo de packaging y cristalería · DC Inc",
    description: CATALOG_DESC,
    url: "/productos",
    type: "website",
  },
};

interface SearchParams {
  q?: string;
  cat?: string;
  sub?: string;
  min?: string;
  max?: string;
  page?: string;
}

/** Precio sobre el que filtra el rango: el que el usuario realmente ve
 *  (cliente final = público con IVA incl. / oferta; mayorista = neto). */
function filterPrice(p: Product, wholesale: boolean): number {
  return resolveDisplayPrice(p, wholesale).display;
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
  const { q, cat, sub, min: minParam, max: maxParam, page: pageParam } = await searchParams;
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

  // Rango de precio: bounds reales del catálogo (sobre el precio que ve el usuario)
  const allPrices = products.map((p) => filterPrice(p, wholesale)).filter((n) => n > 0);
  const priceFloor = allPrices.length ? Math.floor(Math.min(...allPrices)) : 0;
  const priceCeil = allPrices.length ? Math.ceil(Math.max(...allPrices)) : 0;
  const minNum = minParam != null && minParam !== "" ? Number(minParam) : null;
  const maxNum = maxParam != null && maxParam !== "" ? Number(maxParam) : null;
  const hasMin = minNum != null && !Number.isNaN(minNum);
  const hasMax = maxNum != null && !Number.isNaN(maxNum);

  // Filtrado
  const qn = q ? norm(q) : "";
  const filtered = products.filter((p) => {
    if (cat && p.cat !== cat) return false;
    if (sub && p.sub !== sub) return false;
    if (qn) {
      const hay = norm(`${p.name} ${p.sku} ${p.cat} ${p.sub}`);
      if (!hay.includes(qn)) return false;
    }
    if (hasMin || hasMax) {
      const pr = filterPrice(p, wholesale);
      if (hasMin && pr < minNum!) return false;
      if (hasMax && pr > maxNum!) return false;
    }
    return true;
  });

  const hasFilter = !!(q || cat || sub || hasMin || hasMax);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(pageParam || "1", 10) || 1), totalPages);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // URL con un filtro removido (preserva los otros)
  const urlWithout = (drop: "q" | "cat" | "sub" | "price") => {
    const p = new URLSearchParams();
    if (q && drop !== "q") p.set("q", q);
    if (cat && drop !== "cat") p.set("cat", cat);
    if (sub && drop !== "sub") p.set("sub", sub);
    if (hasMin && drop !== "price") p.set("min", String(minNum));
    if (hasMax && drop !== "price") p.set("max", String(maxNum));
    const qs = p.toString();
    return qs ? `/productos?${qs}` : "/productos";
  };

  // URL a una página (preserva filtros)
  const urlForPage = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (cat) p.set("cat", cat);
    if (sub) p.set("sub", sub);
    if (hasMin) p.set("min", String(minNum));
    if (hasMax) p.set("max", String(maxNum));
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

            {/* FILTRO POR RANGO DE PRECIO — GET form, preserva q/cat/sub */}
            {priceCeil > 0 && (
              <>
                <h4 className="h-md" style={{ fontSize: "16px", margin: "24px 0 12px" }}>
                  Precio {wholesale ? "(neto)" : "(IVA incl.)"}
                </h4>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
                  Entre {ars(priceFloor)} y {ars(priceCeil)}
                </p>
                <form method="get" action="/productos" style={{ display: "grid", gap: "10px" }}>
                  {/* Mantener los otros filtros activos al enviar */}
                  {q && <input type="hidden" name="q" value={q} />}
                  {cat && <input type="hidden" name="cat" value={cat} />}
                  {sub && <input type="hidden" name="sub" value={sub} />}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="number"
                      name="min"
                      inputMode="numeric"
                      placeholder={String(priceFloor)}
                      defaultValue={hasMin ? String(minNum) : ""}
                      min={0}
                      aria-label="Precio mínimo"
                      style={{
                        width: "100%",
                        minWidth: 0,
                        padding: "8px 10px",
                        border: "1px solid var(--line-2)",
                        borderRadius: "var(--r-sm)",
                        fontSize: "14px",
                      }}
                    />
                    <input
                      type="number"
                      name="max"
                      inputMode="numeric"
                      placeholder={String(priceCeil)}
                      defaultValue={hasMax ? String(maxNum) : ""}
                      min={0}
                      aria-label="Precio máximo"
                      style={{
                        width: "100%",
                        minWidth: 0,
                        padding: "8px 10px",
                        border: "1px solid var(--line-2)",
                        borderRadius: "var(--r-sm)",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <button type="submit" className="btn btn-ghost btn-sm" style={{ width: "100%" }}>
                    Aplicar precio
                  </button>
                </form>
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
              {(hasMin || hasMax) && (
                <Link className="chip on" href={urlWithout("price")}>
                  {hasMin ? ars(minNum!) : ars(priceFloor)} – {hasMax ? ars(maxNum!) : ars(priceCeil)}{" "}
                  <span className="chip-x"><X /></span>
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
