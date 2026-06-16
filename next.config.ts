import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
    ],
  },
  // 301 redirects desde las URLs viejas de Wix → sitio nuevo (Next).
  // permanent: true ⇒ HTTP 301, así no se pierde el SEO al apagar Wix.
  // Destinos de categoría verificados contra Sanity: las rutas /categoria/[slug]
  // matchean por catSlug(category->name), no por el slug de Sanity. Categorías
  // reales: Botellas→/categoria/botellas, Latas→/categoria/latas,
  // "Copas y vasos"→/categoria/copas-y-vasos, "Tapas y precintos"→/categoria/tapas-y-precintos,
  // Botellones→/categoria/botellones, Válvulas→/categoria/valvulas.
  // NO existe categoría "Cajas y estuches" en el catálogo nuevo ⇒ esos orígenes
  // (cajas de cartón) van a /productos para no caer en un 404.
  async redirects() {
    return [
      // --- Colecciones de producto (categorías) ---
      { source: "/botellas-vidrio-bebidas", destination: "/categoria/botellas", permanent: true },
      { source: "/latas-aluminio-bebidas", destination: "/categoria/latas", permanent: true },
      { source: "/vasos-y-copas-seleccionadas", destination: "/categoria/copas-y-vasos", permanent: true },
      { source: "/copas-copones-bebidas", destination: "/categoria/copas-y-vasos", permanent: true },
      { source: "/vasos-y-pintas-bebidas", destination: "/categoria/copas-y-vasos", permanent: true },
      { source: "/growler-botellon-frascos-bebidas", destination: "/categoria/botellones", permanent: true },
      { source: "/tapas-y-accesorios-envases", destination: "/categoria/tapas-y-precintos", permanent: true },
      // No hay categoría "Cajas y estuches" en el sitio nuevo → /productos (evita 404).
      { source: "/cajas-de-carton-latas-botellas", destination: "/productos", permanent: true },

      // --- Servicios / decorado → /personaliza ---
      { source: "/cajaspersonalizadas", destination: "/personaliza", permanent: true },
      { source: "/impresiones-decorados", destination: "/personaliza", permanent: true },
      { source: "/envasado", destination: "/personaliza", permanent: true },
      { source: "/servicios", destination: "/personaliza", permanent: true },
      { source: "/copia-de-servicios", destination: "/personaliza", permanent: true },

      // --- Legales ---
      { source: "/terminos-y-condiciones-del-sitio", destination: "/legales/terminos", permanent: true },
      { source: "/politicadeprivacidad", destination: "/legales/privacidad", permanent: true },
      { source: "/declaracion-de-accesibilidad", destination: "/legales/terminos", permanent: true },

      // --- Cuenta / miembros ---
      { source: "/members", destination: "/cuenta", permanent: true },
      { source: "/tusdatos", destination: "/cuenta", permanent: true },

      // --- Páginas Wix sin equivalente → home ---
      { source: "/book-online", destination: "/", permanent: true },
      { source: "/fullscreen-page-1", destination: "/", permanent: true },

      // --- Fichas de producto viejas de Wix ---
      // Los slugs viejos NO coinciden con los nuevos y no tenemos el mapeo
      // nombre↔slug, así que mandamos todo el catch-all a /productos.
      // TODO: si más adelante conseguimos el mapeo viejo→nuevo, refinar a
      // redirects por-producto (/product-page/<viejo> → /productos/<nuevo>).
      { source: "/product-page/:slug*", destination: "/productos", permanent: true },
    ];
  },
};

export default nextConfig;
