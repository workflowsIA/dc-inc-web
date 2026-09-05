import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories } from "@/lib/sanity-data";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dcinc.com.ar";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/productos",
    "/personaliza",
    "/nosotros",
    "/logistica",
    "/faq",
    "/blog",
    "/legales/terminos",
    "/legales/privacidad",
    "/legales/defensa",
  ];

  let productRoutes: string[] = [];
  try {
    const slugs = await getAllProductSlugs();
    productRoutes = slugs.map((s) => `/productos/${s}`);
  } catch {
    // sin Sanity, solo rutas estáticas
  }

  let categoryRoutes: string[] = [];
  try {
    const cats = await getCategories();
    categoryRoutes = cats
      .map((c) => (typeof c.slug === "string" ? c.slug : null))
      .filter((s): s is string => !!s)
      .map((s) => `/categoria/${s}`);
  } catch {
    // sin Sanity, sin categorías
  }

  const now = new Date();
  return [...staticRoutes, ...categoryRoutes, ...productRoutes].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency:
      path.startsWith("/productos/") || path.startsWith("/categoria/")
        ? "weekly"
        : "monthly",
    priority:
      path === ""
        ? 1
        : path === "/productos"
          ? 0.9
          : path.startsWith("/categoria/")
            ? 0.8
            : 0.6,
  }));
}
