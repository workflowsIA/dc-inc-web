import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct as getMockProduct } from "@/data/products";
import {
  getAllProductSlugs,
  getProductBySlug,
  toLegacyProduct,
} from "@/lib/sanity-data";
import { ars } from "@/lib/format";
import { waSimpleURL } from "@/lib/whatsapp";
import { isWholesale } from "@/lib/user";
import { AddToCartBox } from "@/components/blocks/AddToCart";

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
  // 2. Fallback al mock (para los 16 SKUs del wireframe original)
  if (!product) product = getMockProduct(id) ?? null;
  if (!product) notFound();

  const wholesale = await isWholesale();
  const price = wholesale ? product.may : product.pub;

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
            {product.cat} · {product.sub}
          </span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            {product.name}
          </h1>
          <p className="mono" style={{ color: "var(--muted)", marginTop: "8px" }}>
            SKU: {product.sku}
          </p>

          <div
            style={{
              marginTop: "24px",
              padding: "20px",
              background: "var(--bg-2)",
              borderRadius: "var(--r-lg)",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>Desde</div>
            <div
              style={{
                fontFamily: "var(--display)",
                fontSize: "32px",
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {ars(price)}{" "}
              <span style={{ fontSize: "14px", color: "var(--muted)" }}>+ IVA</span>
              {wholesale && (
                <span
                  style={{
                    marginLeft: "10px",
                    fontSize: "12px",
                    background: "var(--amber-soft)",
                    color: "var(--amber-deep)",
                    padding: "4px 10px",
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  Precio mayorista
                </span>
              )}
            </div>
            <div style={{ marginTop: "8px", fontSize: "14px", color: "var(--muted)" }}>
              Bulto cerrado: {product.bulto} u · Pallet: {product.pallet} u · Despacho{" "}
              {product.deli}
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <AddToCartBox
              product={{
                id: product.id,
                name: product.name,
                sku: product.sku,
                pub: product.pub,
                may: product.may,
                bulto: product.bulto,
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
    </div>
  );
}
