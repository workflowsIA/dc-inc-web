/**
 * Studio embebido de Sanity bajo /studio.
 * El catch-all [[...tool]] permite las sub-rutas internas del Studio.
 * Acceso: https://dc-inc-web-v3.vercel.app/studio
 * Studio hosted equivalente: https://dc-inc.sanity.studio/
 */
import SanityStudio from "@/components/SanityStudio";

// force-dynamic (no force-static): el layout raíz renderiza <Header/>, que llama
// auth() de Clerk. auth() requiere render dinámico con contexto de clerkMiddleware;
// en static prerender (build) explota con "Clerk can't detect usage of clerkMiddleware()".
export const dynamic = "force-dynamic";
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  return <SanityStudio />;
}
