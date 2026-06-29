/**
 * Studio embebido de Sanity bajo /admin.
 * El catch-all [[...tool]] permite las sub-rutas internas del Studio.
 * Acceso: https://dc-inc-web-v3.vercel.app/admin
 * Studio hosted equivalente: https://dc-inc.sanity.studio/
 *
 * Las páginas web sueltas (/admin/pedidos, /admin/aprobaciones, /admin/clientes)
 * son rutas estáticas y tienen precedencia sobre este catch-all, así conviven.
 */
import SanityStudio from "@/components/SanityStudio";

// force-dynamic (no force-static): el layout raíz puede llamar auth() de Clerk,
// que requiere render dinámico. En static prerender explota.
export const dynamic = "force-dynamic";
export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  return <SanityStudio />;
}
