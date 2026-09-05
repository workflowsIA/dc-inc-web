import type { MetadataRoute } from "next";
import { getAllProductSlugs } from "@/lib/sanity-data";

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
    "/cuenta",
  ];

  let productRoutes: string[] = [];
  try {
    const slugs = await getAllProductSlugs();
    productRoutes = slugs.map((s) => `/productos/${s}`);
  } catch {
    // sin Sanity, solo rutas estáticas
  }

  const now = new Date();
  return [...staticRoutes, ...productRoutes].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path.startsWith("/productos/") ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/productos" ? 0.9 : 0.6,
  }));
}
