"use client";
import { usePathname } from "next/navigation";

/**
 * Renderiza Header/Footer en todas las páginas excepto el Studio (/admin).
 * El Studio de Sanity ocupa pantalla completa y trae su propio chrome.
 * Las páginas web sueltas de /admin (pedidos/aprobaciones/clientes) SÍ llevan
 * chrome del sitio.
 */
export default function ChromeWrapper({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const webAdminPages = ["/admin/pedidos", "/admin/aprobaciones", "/admin/clientes"];
  const isWebAdmin = webAdminPages.some((p) => pathname.startsWith(p));
  const isStudio = pathname.startsWith("/admin") && !isWebAdmin;
  if (isStudio) return <>{children}</>;
  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  );
}
