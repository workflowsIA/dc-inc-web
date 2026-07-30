import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCart,
  Shield,
  Truck,
  Receipt,
  Brush,
  CheckCircle2,
} from "lucide-react";
import { waSimpleURL, WA_NUMBER } from "@/lib/whatsapp";
import CartCount from "./CartCount";
import HeaderAuth from "./HeaderAuth";
import MobileMenu from "./MobileMenu";
import SearchBox from "./SearchBox";

const NAV = [
  { href: "/productos", label: "Productos" },
  { href: "/personaliza", label: "Personalización" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/logistica", label: "Logística" },
  { href: "/blog", label: "Blog" },
];

/**
 * Header 100% estático a propósito.
 *
 * NO llamar a `auth()` ni a ninguna API dinámica (cookies/headers) acá dentro:
 * el Header vive en el layout raíz, así que una sola llamada dinámica convierte
 * TODAS las rutas del sitio en dinámicas y anula los `export const revalidate`
 * de la home, el catálogo, las categorías y las fichas. El estado de sesión se
 * resuelve en el cliente con <SignedIn>/<SignedOut>.
 *
 * El índice del buscador tampoco se serializa acá: se pide on-demand a
 * /api/search-index la primera vez que el usuario toca el buscador. Antes se
 * mandaban los ~305 productos en el payload RSC de cada página.
 */
export default function Header() {
  return (
    <header className="hdr">
      <div className="wrap hdr-top">
        <MobileMenu />
        <Link href="/" aria-label="DC Inc — Inicio">
          <span className="logo">
            <Image
              className="logo-img"
              src="/img/logo-dark.png"
              alt="DC Inc"
              width={120}
              height={36}
              priority
            />
          </span>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hdr-actions">
          <SearchBox className="desktop-only" />
          <a
            className="btn btn-wa btn-sm desktop-only"
            href={waSimpleURL()}
            target="_blank"
            rel="noopener"
          >
            WhatsApp
          </a>
          <HeaderAuth />
          <Link
            className="icon-btn"
            href="/carrito"
            aria-label="Carrito"
            prefetch={false}
          >
            <ShoppingCart />
            <CartCount />
          </Link>
        </div>
      </div>
      <div className="benefits">
        <div className="wrap">
          <span className="benefit">
            <Shield /> Mínimo $150k + IVA
          </span>
          <span className="benefit-sep" />
          <span className="benefit">
            <Truck /> Envíos a todo el país
          </span>
          <span className="benefit-sep" />
          <span className="benefit">
            <Receipt /> Factura A / B / E
          </span>
          <span className="benefit-sep" />
          <span className="benefit">
            <Brush /> Decorado propio
          </span>
          <span className="benefit-sep" />
          <span className="benefit">
            <CheckCircle2 /> Stock real
          </span>
        </div>
      </div>
      {/* Phone hint hidden on the chrome but referenced for accessibility */}
      <span className="sr-only">Atención: {WA_NUMBER}</span>
    </header>
  );
}
