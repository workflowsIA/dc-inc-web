"use client";
import { usePathname } from "next/navigation";

/**
 * Renderiza Header/Footer en todas las páginas excepto el Studio (/admin).
 * El Studio de Sanity ocupa pantalla completa y trae su propio chrome.
 *
 * `modal` es el cartel de bienvenida: viaja como prop (no como children) para
 * que quede afuera de <main> y para que el Studio no lo monte nunca.
 */
export default function ChromeWrapper({
  header,
  footer,
  modal,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  modal?: React.ReactNode;
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
      {modal}
    </>
  );
}
