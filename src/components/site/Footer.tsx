import Image from "next/image";
import Link from "next/link";
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
                  src="/img/logo-light.png"
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
              +54 9 11 6107 2310
            </a>
          </div>
          <div>
            <h5>Productos</h5>
            <ul>
              <li>
                <Link href="/productos?cat=Botellas">Botellas</Link>
              </li>
              <li>
                <Link href="/productos?cat=Latas">Latas</Link>
              </li>
              <li>
                <Link href="/productos?cat=Copas">Cristalería</Link>
              </li>
              <li>
                <Link href="/productos?cat=Cajas">Cajas y estuches</Link>
              </li>
              <li>
                <Link href="/productos?cat=Tapas">Tapas y accesorios</Link>
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
            © 2026 DC Inc SRL · CUIT XX-XXXXXXXX-X · Todos los derechos
            reservados {/* PLACEHOLDER: CUIT real pendiente de Marce */}
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
