import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllProductSlugs,
  getProductBySlug,
  getProducts,
  toLegacyProduct,
} from "@/lib/sanity-data";
import ProductCard from "@/components/blocks/ProductCard";
import { plainText } from "@/lib/format";
import { waSimpleURL } from "@/lib/whatsapp";
import ProductBuyBox from "@/components/blocks/ProductBuyBox";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const slugs = await getAllProductSlugs();
    return slugs.map((slug) => ({ id: slug }));
  } catch {
    return [];
  }
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  let product = null;
  try {
    const sanity = await getProductBySlug(id);
    if (sanity) product = toLegacyProduct(sanity);
  } catch {
    // ignore
  }
  if (!product) return { title: "Producto no encontrado" };

  const subLabel = product.subs?.length ? product.subs.join(", ") : product.sub;
  const cat = subLabel ? `${product.cat} · ${subLabel}` : product.cat;
  return {
    title: product.name,
    description: `${product.name} (${product.sku}) — ${cat}. Comprá al por mayor en DC Inc: stock real, factura A/B/E y envíos a todo el país.`,
    alternates: { canonical: `/productos/${id}` },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  // 1. Intentar Sanity por slug
  let product = null;
  try {
    const sanity = await getProductBySlug(id);
    if (sanity) product = toLegacyProduct(sanity);
  } catch (e) {
    console.error("[product page] Sanity fetch failed:", (e as Error).message);
  }
  if (!product) notFound();

  // Productos relacionados: misma categoría, excluyendo el actual (máx 4).
  // getProducts() es una sola query cacheada → sin costo extra en el build.
  let related: typeof product[] = [];
  try {
    const all = (await getProducts()).map((p) => toLegacyProduct(p));
    related = all
      .filter((p) => p.id !== product!.id && p.cat === product!.cat && p.cat !== "Otros")
      .slice(0, 4);
  } catch {
    // sin relacionados
  }

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <div className="product-layout">
        <div>
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={600}
              height={600}
              unoptimized
              style={{
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--line)",
                background: "#fff",
                width: "100%",
                height: "auto",
              }}
            />
          ) : product.img ? (
            <Image
              src={`/img/${product.img}.png`}
              alt={product.name}
              width={600}
              height={600}
              style={{
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--line)",
                background: "#fff",
              }}
            />
          ) : (
            <div
              className="ph"
              data-ph={product.name}
              style={{ aspectRatio: "1/1", borderRadius: "var(--r-lg)" }}
            />
          )}
        </div>
        <div>
          <span className="eyebrow">
            {product.cat}
            {product.subs?.length ? ` · ${product.subs.join(", ")}` : product.sub ? ` · ${product.sub}` : ""}
          </span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            {product.name}
          </h1>
          {product.sku && !/^product[-_]/i.test(product.sku) && (
            <p className="mono" style={{ color: "var(--muted)", marginTop: "8px" }}>
              SKU: {product.sku}
            </p>
          )}

          <div style={{ marginTop: "24px" }}>
            <ProductBuyBox
              deli={product.deli}
              presentationPricing={product.presentationPricing}
              pricing={{
                pub: product.pub,
                may: product.may,
                oldPub: product.oldPub,
                onSale: product.onSale,
                salePrice: product.salePrice,
                saleStart: product.saleStart,
                saleEnd: product.saleEnd,
              }}
              product={{
                id: product.id,
                name: product.name,
                sku: product.sku,
                pub: product.pub,
                may: product.may,
                bulto: product.bulto,
                pallet: product.pallet,
                imageUrl: product.imageUrl,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
            <a
              className="btn btn-wa btn-lg"
              href={waSimpleURL(`Hola DC Inc! Quiero cotizar ${product.name} (${product.sku}).`)}
              target="_blank"
              rel="noopener"
            >
              Cotizar por WhatsApp
            </a>
            <Link className="btn btn-ghost btn-lg" href="/productos">
              ← Volver al catálogo
            </Link>
          </div>

          {product.description && plainText(product.description) && (
            <div style={{ marginTop: "32px" }}>
              <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "10px" }}>
                Descripción
              </h3>
              <p
                style={{
                  whiteSpace: "pre-line",
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                {plainText(product.description)}
              </p>
            </div>
          )}

          {Object.keys(product.specs).length > 0 && (
            <>
              <h3 className="h-md" style={{ fontSize: "18px", marginTop: "32px" }}>
                Especificaciones técnicas
              </h3>
              <table style={{ width: "100%", marginTop: "12px", borderCollapse: "collapse" }}>
                <tbody>
                  {Object.entries(product.specs).map(([k, v]) => (
                    <tr key={k}>
                      <td
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid var(--line)",
                          color: "var(--muted)",
                          fontSize: "14px",
                          width: "40%",
                        }}
                      >
                        {k}
                      </td>
                      <td
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid var(--line)",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        {v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: "64px" }}>
          <h2 className="h-md" style={{ fontSize: "22px", marginBottom: "20px" }}>
            Productos relacionados
          </h2>
          <div className="grid grid-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
