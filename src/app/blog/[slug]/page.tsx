import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import {
  getAllBlogPostSlugs,
  getBlogPostBySlug,
} from "@/lib/sanity-data";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const slugs = await getAllBlogPostSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let post = null;
  try {
    post = await getBlogPostBySlug(slug);
  } catch {
    // ignore
  }
  if (!post) return { title: "Artículo no encontrado" };
  const desc =
    post.excerpt ??
    `${post.title} — guía de packaging y cristalería de DC Inc.`;
  return {
    title: post.title,
    description: desc,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: `${post.title} · DC Inc`,
      description: desc,
      url: `/blog/${slug}`,
      type: "article",
      images: post.cover ? [{ url: post.cover }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  let post = null;
  try {
    post = await getBlogPostBySlug(slug);
  } catch (e) {
    console.error("[blog post] Sanity fetch failed:", (e as Error).message);
  }
  if (!post) notFound();

  const fecha = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px", maxWidth: "760px" }}>
      <Link href="/blog" style={{ fontSize: "14px", color: "var(--muted)" }}>
        ← Volver al blog
      </Link>

      {post.category && (
        <span className="eyebrow" style={{ marginTop: "20px", display: "block" }}>
          {post.category}
        </span>
      )}
      <h1 className="h-lg" style={{ marginTop: "12px" }}>
        {post.title}
      </h1>
      {fecha && (
        <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--muted)" }}>
          {fecha}
        </p>
      )}

      {post.cover && (
        <Image
          src={post.cover}
          alt={post.title}
          width={760}
          height={420}
          unoptimized
          style={{
            marginTop: "24px",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--line)",
            width: "100%",
            height: "auto",
          }}
        />
      )}

      <article
        style={{
          marginTop: "32px",
          fontSize: "16px",
          lineHeight: 1.75,
          color: "var(--ink)",
        }}
      >
        {post.body && post.body.length > 0 ? (
          <PortableText value={post.body} />
        ) : (
          <p style={{ color: "var(--muted)" }}>
            {post.excerpt ?? "Este artículo todavía no tiene contenido."}
          </p>
        )}
      </article>

      <div style={{ marginTop: "48px", borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
        <Link href="/productos" style={{ color: "var(--muted)", fontSize: "14px" }}>
          Explorá el catálogo de DC Inc →
        </Link>
      </div>
    </div>
  );
}
