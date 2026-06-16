import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { waSimpleURL } from "@/lib/whatsapp";

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div>
            <Link href="/">
              <span className="logo">
                <Image
                  className="logo-img"
                  src="/img/logo-dark.png"
                  alt="DC Inc"
                  width={120}
                  height={36}
                />
              </span>
            </Link>
            <p
              style={{
                maxWidth: "34ch",
                color: "#a9a9a5",
                fontSize: "14.5px",
                marginTop: "4px",
              }}
            >
              Distribuidor mayorista de packaging y cristalería para bebidas.
              Botellas, latas, cajas, copas, tapas y decorado propio.
            </p>
            <a
              className="btn btn-wa btn-sm"
              style={{ marginTop: "18px" }}
              href={waSimpleURL()}
              target="_blank"
              rel="noopener"
            >
              <MessageCircle style={{ width: 16, height: 16 }} />
              WhatsApp · 11 6107 2310
            </a>
          </div>
          <div>
            <h5>Productos</h5>
            <ul>
              <li>
                <Link href="/categoria/botellas">Botellas</Link>
              </li>
              <li>
                <Link href="/categoria/latas">Latas</Link>
              </li>
              <li>
                <Link href="/categoria/copas-y-vasos">Cristalería</Link>
              </li>
              {/* "Cajas y estuches" no existe como categoría en el catálogo
                  → linkeamos al catálogo completo en vez de a un slug roto. */}
              <li>
                <Link href="/productos">Cajas y estuches</Link>
              </li>
              <li>
                <Link href="/categoria/tapas-y-precintos">Tapas y accesorios</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5>Empresa</h5>
            <ul>
              <li>
                <Link href="/nosotros">Nosotros</Link>
              </li>
              <li>
                <Link href="/logistica">Logística</Link>
              </li>
              <li>
                <Link href="/personaliza">Decorado</Link>
              </li>
              <li>
                <Link href="/blog">Blog</Link>
              </li>
              <li>
                <Link href="/faq">Preguntas frecuentes</Link>
              </li>
            </ul>
          </div>
          <div className="ftr-contact">
            <h5>Contacto</h5>
            <div>
              <strong>Horario</strong>Lunes a viernes · 9 a 18 h
            </div>
            <div>
              <strong>Depósito</strong>Rivadavia 1831, Villa Maipú, San Martín
            </div>
            <div>
              <strong>Oficina</strong>Av. Álvarez Thomas 1171, Colegiales, CABA
            </div>
            <div>
              <strong>Email</strong>info@dcinc.com.ar
            </div>
          </div>
        </div>
        <div className="ftr-bottom">
          <span>
            © 2026 DC INC S.R.L. · CUIT 33-71690327-9 · Todos los derechos
            reservados
          </span>
          <span className="tag-row">
            <Link href="/legales/terminos">Términos</Link> ·{" "}
            <Link href="/legales/privacidad">Privacidad</Link> ·{" "}
            <Link href="/legales/defensa">Defensa al consumidor</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
