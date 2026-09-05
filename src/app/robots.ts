import type { MetadataRoute } from "next";

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dcinc.com.ar";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/mi-cuenta", "/cuenta", "/carrito"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
