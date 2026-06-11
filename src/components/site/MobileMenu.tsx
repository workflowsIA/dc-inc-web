"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronRight } from "lucide-react";
import { waSimpleURL } from "@/lib/whatsapp";

const NAV = [
  { href: "/productos", label: "Productos" },
  { href: "/personaliza", label: "Personalización" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/logistica", label: "Logística" },
  { href: "/blog", label: "Blog" },
  { href: "/cuenta", label: "Mi cuenta" },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  // bloquea el scroll del body mientras el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        className="icon-btn hdr-burger"
        aria-label="Abrir menú"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu />
      </button>

      <div
        className={`menu-drawer ${open ? "on" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      >
        <div className="menu-panel" onClick={(e) => e.stopPropagation()}>
          <div className="menu-head">
            <strong style={{ fontFamily: "var(--display)", fontSize: "18px" }}>Menú</strong>
            <button className="icon-btn" aria-label="Cerrar menú" onClick={() => setOpen(false)}>
              <X />
            </button>
          </div>
          <nav className="menu-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>
                {n.label}
                <ChevronRight />
              </Link>
            ))}
          </nav>
          <a
            className="btn btn-wa btn-block"
            href={waSimpleURL()}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
          >
            Escribinos por WhatsApp
          </a>
        </div>
      </div>
    </>
  );
}
