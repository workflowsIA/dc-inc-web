import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ProductCard from "@/components/blocks/ProductCard";
import type { Product } from "@/data/products";
import { getCategories, getProducts, toLegacyProduct } from "@/lib/sanity-data";
import { catSlug } from "@/lib/slug";

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * La dirección de la categoría sale del campo "slug" del documento, NO del
 * nombre. Antes se derivaba del nombre en vivo, así que renombrar una categoría
 * rompía su dirección: el 12-sep-2026 Marce renombró "Tapas y precintos" y
 * /categoria/tapas-y-precintos quedó en 404, con lo indexado en Google adentro.
 *
 * Ahora el slug es un dato editable y estable, y las direcciones anteriores
 * quedan guardadas en `previousSlugs`: si alguien llega por una vieja, se lo
 * redirige a la nueva en vez de mostrarle un error.
 */
async function resolver(slug: string): Promise<
  { tipo: "ok"; name: string; inCat: Product[] } | { tipo: "redirect"; a: string } | { tipo: "404" }
> {
  const [cats, prods] = await Promise.all([
    getCategories().catch(() => []),
    getProducts()
      .then((ps) => ps.map((p) => toLegacyProduct(p)))
      .catch(() => [] as Product[]),
  ]);

  const actual = cats.find((c) => (c.slug || catSlug(c.name)) === slug);
  if (!actual) {
    const vieja = cats.find((c) => (c.previousSlugs ?? []).includes(slug));
    if (vieja) return { tipo: "redirect", a: vieja.slug || catSlug(vieja.name) };
    // Sin documento de categoría (o sin Sanity), último intento: derivar del
    // nombre como se hacía antes, para no romper nada que ya funcionaba.
    const porNombre = prods.filter((p) => p.cat && p.cat !== "Otros" && catSlug(p.cat) === slug);
    if (porNombre.length) return { tipo: "ok", name: porNombre[0].cat, inCat: porNombre };
    return { tipo: "404" };
  }

  const inCat = prods.filter((p) => p.cat === actual.name);
  if (!inCat.length) return { tipo: "404" };
  return { tipo: "ok", name: actual.name, inCat };
}

/** Prerenderiza las categorías reales (las que tienen productos). */
export async function generateStaticParams() {
  try {
    const [cats, products] = await Promise.all([getCategories(), getProducts()]);
    const conProductos = new Set(products.map((p) => p.category).filter(Boolean));
    return cats
      .filter((c) => c.name !== "Otros" && conProductos.has(c.name))
      .map((c) => ({ slug: c.slug || catSlug(c.name) }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolver(slug);
  if (r.tipo !== "ok") return { title: "Categoría" };
  const desc = `${r.name} al por mayor en DC Inc (${r.inCat.length} productos). Stock real, factura A/B/E y envíos a todo el país con transporte para vidrio.`;
  return {
    title: r.name,
    description: desc,
    alternates: { canonical: `/categoria/${slug}` },
    openGraph: {
      title: `${r.name} · DC Inc`,
      description: desc,
      url: `/categoria/${slug}`,
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const r = await resolver(slug);
  if (r.tipo === "redirect") permanentRedirect(`/categoria/${r.a}`);
  if (r.tipo === "404") notFound();
  const { name, inCat } = r;

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
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link
            prefetch={false}
            className="btn btn-ghost"
            href={`/productos?cat=${encodeURIComponent(name)}`}
            style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}
          >
            Filtrar esta categoría
          </Link>
          <Link
            prefetch={false}
            className="btn btn-ghost"
            href="/productos"
            style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}
          >
            Ver todo el catálogo
          </Link>
        </div>
      </div>

      <div className="grid grid-4">
        {inCat.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
