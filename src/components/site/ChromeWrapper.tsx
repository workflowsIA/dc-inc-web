"use client";
import { usePathname } from "next/navigation";

/**
 * Renderiza Header/Footer en todas las páginas excepto el Studio (/admin).
 * El Studio de Sanity ocupa pantalla completa y trae su propio chrome.
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
  const isStudio = pathname.startsWith("/admin");
  if (isStudio) return <>{children}</>;
  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  );
}
