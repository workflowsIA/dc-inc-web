/**
 * Studio embebido de Sanity bajo /studio.
 * El catch-all [[...tool]] permite las sub-rutas internas del Studio.
 * Acceso: https://dc-inc-web-v3.vercel.app/studio
 * Studio hosted equivalente: https://dc-inc.sanity.studio/
 */
import SanityStudio from "@/components/SanityStudio";

export const dynamic = "force-static";
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  return <SanityStudio />;
}
