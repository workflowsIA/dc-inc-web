import Image from "next/image";
import Link from "next/link";
import {
  Layers,
  Shield,
  Receipt,
  Truck,
  CheckCircle2,
  Brush,
  Headphones,
  ArrowRight,
} from "lucide-react";
import ProductCard from "@/components/blocks/ProductCard";
import { COMBOS, BRANDS, getProduct } from "@/data/products";
import { ars } from "@/lib/format";
import { waSimpleURL } from "@/lib/whatsapp";
import s from "./page.module.css";

const featuredIds = ["lata-473", "copa-pinta", "bot-am-355", "copa-gin"];

const categoryData: { name: string; count: string; img?: string }[] = [
  { name: "Botellas", count: "142", img: "bottle-beer" },
  { name: "Latas", count: "38", img: "can" },
  { name: "Copas", count: "64", img: "pint" },
  { name: "Cajas", count: "26", img: "box" },
  { name: "Tapas", count: "22" },
  { name: "Botellones", count: "8", img: "growler" },
];

const steps = [
  ["1", "Elegí el producto", "Filtrá por categoría, tipo de cristalería o envase. Toda la info técnica visible sin abrir la ficha."],
  ["2", "Configurá y sumá", "Presentación, cantidad y adicionales (tapa, decorado, estuche). El total se calcula en vivo."],
  ["3", "Cotizá por WhatsApp", "Revisás el pedido con IVA y descuento por volumen, y lo cerrás con tu vendedor en un toque."],
];

const diffs = [
  { Icon: Shield, title: "Mínimo $150k + IVA", body: "Pedido mayorista por bulto cerrado. Sabés el mínimo antes de armar el carrito." },
  { Icon: Receipt, title: "Factura A, B o E", body: "Comprás con la factura que tu empresa necesita, sin trámites raros." },
  { Icon: Truck, title: "Envíos con convenio", body: "Transportes que sí se hacen cargo del vidrio. Cobertura en todo el país." },
  { Icon: CheckCircle2, title: "Stock real", body: "Lo que ves disponible está en depósito. Sincronizado con nuestro sistema." },
  { Icon: Brush, title: "Decorado propio", body: "Serigrafía, calcos y grabado en casa. Tu logo en botella, lata o copa." },
  { Icon: Headphones, title: "Vendedor asignado", body: "Una persona que conoce tu cuenta y te responde por WhatsApp." },
];

export default function Home() {
  const featured = featuredIds.map((id) => getProduct(id)).filter(Boolean);

  return (
    <>
      {/* HERO */}
      <section className={s.heroA}>
        <div className="wrap">
          <div>
            <span className="eyebrow">Distribuidor mayorista · desde 2018</span>
            <h1>
              Todo el packaging de tu bebida,{" "}
              <span className="amber">en un solo proveedor.</span>
            </h1>
            <p className="lead">
              Botellas, latas, cristalería, cajas, tapas y decorado propio.
              Stock real, envíos a todo el país y atención por WhatsApp con tu
              vendedor asignado.
            </p>
            <div className={s.heroCta}>
              <Link className="btn btn-primary btn-lg" href="/productos">
                Ver catálogo
              </Link>
              <Link className="btn btn-ghost btn-lg" href="/personaliza">
                Quiero decorado
              </Link>
            </div>
            <div className={s.heroTrust}>
              <div>
                <div className="n">+1.613</div>
                <div className="l">clientes activos</div>
              </div>
              <div>
                <div className="n">~300</div>
                <div className="l">SKUs en stock</div>
              </div>
              <div>
                <div className="n">24-48h</div>
                <div className="l">despacho envases</div>
              </div>
            </div>
          </div>
          <div>
            <div className={s.collage}>
              <Image
                className="ph big"
                src="/img/bottle-amber.png"
                alt="Botella ámbar — packshot"
                width={600}
                height={600}
              />
              <Image
                className="ph"
                src="/img/can.png"
                alt="Lata 473 — packshot"
                width={300}
                height={300}
              />
              <Image
                className="ph"
                src="/img/pint.png"
                alt="Pinta cervecera"
                width={300}
                height={300}
              />
              <div className={s.collageFloat}>
                <span className="ico">
                  <Layers />
                </span>
                <div>
                  <div className="t">Armá tu pedido</div>
                  <div className="s">3 pasos · cotizás al instante</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Catálogo</span>
              <h2 className="h-lg" style={{ marginTop: "12px" }}>
                Elegí por categoría
              </h2>
            </div>
            <Link className="btn btn-ghost" href="/productos">
              Ver todo el catálogo <ArrowRight />
            </Link>
          </div>
          <div className={s.cats}>
            {categoryData.map((c) => (
              <Link
                key={c.name}
                className={s.catTile}
                href={`/productos?cat=${encodeURIComponent(c.name)}`}
              >
                {c.img ? (
                  <Image
                    className="ph"
                    src={`/img/${c.img}.png`}
                    alt={c.name}
                    width={300}
                    height={300}
                  />
                ) : (
                  <div className="ph" data-ph={c.name} />
                )}
                <div className="lab">
                  <b>{c.name}</b>
                  <span>{c.count} SKU</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* STEPS BAND */}
      <section className="section-sm">
        <div className="wrap">
          <div className={s.stepband}>
            <div className="section-head" style={{ marginBottom: "26px" }}>
              <div>
                <span className="eyebrow" style={{ color: "var(--amber)" }}>
                  Pedido en 3 pasos
                </span>
                <h2
                  className="h-md"
                  style={{ color: "#fff", marginTop: "10px" }}
                >
                  Sin vueltas, sin cargar mil datos
                </h2>
              </div>
            </div>
            <div className={s.sbGrid}>
              {steps.map(([n, title, body]) => (
                <div key={n} className={s.sbItem}>
                  <div className={s.sbNum}>{n}</div>
                  <div>
                    <h4>{title}</h4>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="section" style={{ paddingTop: "24px" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Lo más pedido</span>
              <h2 className="h-lg" style={{ marginTop: "12px" }}>
                Productos destacados
              </h2>
            </div>
            <Link className="btn btn-ghost" href="/productos">
              Ver más <ArrowRight />
            </Link>
          </div>
          <div className="grid grid-4">
            {featured.map((p) => (
              <ProductCard key={p!.id} product={p!} />
            ))}
          </div>
        </div>
      </section>

      {/* COMBOS — PLACEHOLDER: combos genéricos hasta que Marce defina los reales */}
      <section
        className="section surface"
        style={{
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Combos armados</span>
              <h2 className="h-lg" style={{ marginTop: "12px" }}>
                Listos para sumar al pedido
              </h2>
            </div>
            <Link className="btn btn-ghost" href="/productos">
              Ver combos <ArrowRight />
            </Link>
          </div>
          <div className="grid grid-3">
            {COMBOS.map((c) => (
              <article key={c.id} className={s.combo}>
                <div style={{ position: "relative" }}>
                  <div className="ph" data-ph={c.name} />
                  <div
                    className="pcard-badges"
                    style={{ position: "absolute", top: "12px", left: "12px" }}
                  >
                    <span className="badge badge-deco">{c.badge}</span>
                  </div>
                </div>
                <div className={s.cbody}>
                  <h3>{c.name}</h3>
                  <p>{c.desc}</p>
                  <div className={s.cfoot}>
                    <div>
                      <span className="price-from">Desde</span>{" "}
                      <span className="price">{ars(c.from)}</span>{" "}
                      <span className="price-unit">/u</span>
                    </div>
                    <Link className="btn btn-dark btn-sm" href="/productos">
                      Sumar combo
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PROMO BANNER */}
      <section className="section">
        <div className="wrap">
          <div className={s.promo}>
            <div className={s.pleft}>
              <span className="badge badge-new" style={{ marginBottom: "14px" }}>
                Promo del mes
              </span>
              <h3>Decorado bonificado en tu primer pedido de cristalería</h3>
              <p>
                Serigrafía 1 color sin cargo en compras desde $500.000 + IVA.
                Llevá tu logo a la pinta, el chopp o la copa de tu marca.
              </p>
              <Link className="btn btn-primary btn-lg" href="/personaliza">
                Cotizar decorado
              </Link>
            </div>
            <div className={s.pright}>
              <div
                className="ph ph-dark"
                data-ph="Lifestyle · cristalería decorada en bar"
              />
            </div>
          </div>
        </div>
      </section>

      {/* DIFERENCIALES */}
      <section
        className="section surface"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Cómo trabajamos</span>
              <h2 className="h-lg" style={{ marginTop: "12px" }}>
                Por qué nos eligen
              </h2>
            </div>
          </div>
          <div className={s.diffs}>
            {diffs.map(({ Icon, title, body }) => (
              <div key={title} className={s.diff}>
                <div className="ico">
                  <Icon />
                </div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRANDS — PLACEHOLDER: cards con nombre, logos reales pendientes de Marce */}
      <section className="section">
        <div className="wrap center">
          <span className="eyebrow" style={{ justifyContent: "center" }}>
            Marcas que confían
          </span>
          <h2 className="h-lg" style={{ margin: "12px 0 8px" }}>
            Producimos para las mejores
          </h2>
          <p
            className="lead"
            style={{ margin: "0 auto 34px", maxWidth: "54ch" }}
          >
            Cervecerías artesanales, destilerías, bodegas y bares de todo el país
            eligen DC Inc para su packaging y su cristalería.
          </p>
          <div className={s.brandRow}>
            {BRANDS.slice(0, 8).map((b) => (
              <div key={b} className={s.brandLogo}>
                {b}
              </div>
            ))}
          </div>
          <Link
            className="btn btn-ghost"
            style={{ marginTop: "30px" }}
            href="/nosotros"
          >
            Ver casos destacados <ArrowRight />
          </Link>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className={s.ctaband}>
            <div>
              <h3>¿Listo para tu próximo pedido?</h3>
              <p>Mínimo $150.000 + IVA · Factura A / B / E · Despacho 24-48 hs</p>
            </div>
            <div className="tag-row">
              <Link className="btn btn-dark btn-lg" href="/productos">
                Ver catálogo
              </Link>
              <a
                className="btn btn-dark btn-lg"
                style={{ background: "var(--wa)" }}
                href={waSimpleURL()}
                target="_blank"
                rel="noopener"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
