import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/blocks/ProductCard";
import type { Product } from "@/data/products";
import { getProducts, toLegacyProduct } from "@/lib/sanity-data";
import { isWholesale } from "@/lib/user";
import { catSlug } from "@/lib/slug";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

async function load(
  slug: string,
  wholesale = false,
): Promise<{ inCat: Product[]; name: string | null }> {
  let products: Product[] = [];
  try {
    products = (await getProducts()).map((p) => toLegacyProduct(p, wholesale));
  } catch {
    // sin Sanity
  }
  const inCat = products.filter((p) => p.cat && p.cat !== "Otros" && catSlug(p.cat) === slug);
  return { inCat, name: inCat[0]?.cat ?? null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { name, inCat } = await load(slug);
  if (!name) return { title: "Categoría" };
  const desc = `${name} al por mayor en DC Inc (${inCat.length} productos). Stock real, factura A/B/E y envíos a todo el país con transporte para vidrio.`;
  return {
    title: name,
    description: desc,
    alternates: { canonical: `/categoria/${slug}` },
    openGraph: {
      title: `${name} · DC Inc`,
      description: desc,
      url: `/categoria/${slug}`,
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const wholesale = await isWholesale();
  const { inCat, name } = await load(slug, wholesale);
  if (!name) notFound();

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      {/* HERO de categoría */}
      <div
        style={{
          background: "var(--charcoal, #2A2A2C)",
          color: "#fff",
          borderRadius: "var(--r-lg)",
          padding: "40px 32px",
          marginBottom: "32px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <span className="eyebrow" style={{ color: "var(--amber)" }}>
            Categoría
          </span>
          <h1 className="h-lg" style={{ marginTop: "10px", color: "#fff" }}>
            {name}
          </h1>
          <p style={{ marginTop: "8px", color: "#cfcfca", fontSize: "15px" }}>
            {inCat.length} {inCat.length === 1 ? "producto" : "productos"} · mayorista, bulto cerrado
          </p>
        </div>
        <Link prefetch={false} className="btn btn-ghost" href="/productos" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>
          Ver todo el catálogo
        </Link>
      </div>

      <div className="grid grid-4">
        {inCat.map((p) => (
          <ProductCard key={p.id} product={p} wholesale={wholesale} />
        ))}
      </div>
    </div>
  );
}
