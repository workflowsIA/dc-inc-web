import Image from "next/image";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  Shield,
  Truck,
  Receipt,
  Brush,
  CheckCircle2,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { waSimpleURL, WA_NUMBER } from "@/lib/whatsapp";
import CartCount from "./CartCount";

const NAV = [
  { href: "/productos", label: "Productos" },
  { href: "/personaliza", label: "Personalización" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/logistica", label: "Logística" },
  { href: "/blog", label: "Blog" },
];

export default function Header() {
  return (
    <header className="hdr">
      <div className="wrap hdr-top">
        <button className="icon-btn hdr-burger" aria-label="Menú">
          <Menu />
        </button>
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
          <label className="search desktop-only">
            <Search />
            <input placeholder="Buscar productos, categorías…" />
          </label>
          <a
            className="btn btn-wa btn-sm desktop-only"
            href={waSimpleURL()}
            target="_blank"
            rel="noopener"
          >
            WhatsApp
          </a>
          <SignedOut>
            <Link className="icon-btn" href="/cuenta" aria-label="Ingresar">
              <User />
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <Link className="icon-btn" href="/carrito" aria-label="Carrito">
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
