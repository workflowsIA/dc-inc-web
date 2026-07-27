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
import ComboCard from "@/components/blocks/ComboCard";
import type { Product } from "@/data/products";
import { waSimpleURL } from "@/lib/whatsapp";
import { isWholesale } from "@/lib/user";
import { catSlug } from "@/lib/slug";
import {
  getFeaturedProducts,
  getProducts,
  getProductCount,
  getClients,
  getCombos,
  toLegacyProduct,
} from "@/lib/sanity-data";
import type { SanityClient, SanityCombo } from "@/lib/queries";
import s from "./page.module.css";

export const revalidate = 60;


/**
 * Packshot local por nombre de categoría real (de Sanity). Fallback: placeholder.
 * Íconos "cat-*" son los ilustrados reales de DC Inc (extraídos del sitio Wix
 * vigente, 22-jul-2026), re-encuadrados todos al mismo tamaño/margen para que
 * se vean parejos en la grilla. "Botellones" usaba el packshot viejo
 * (growler.png) sin el mismo encuadre — quedaba desproporcionado al lado de
 * los nuevos; re-encuadrado en cat-botellones.png.
 *
 * Categorías sin ícono propio (hoy: Válvulas — y cualquier
 * categoría nueva que se cree en Sanity sin entrada acá) caen en
 * "cat-generic.png" (isotipo DC sobre fondo crema) en vez del placeholder a
 * rayas — se ve prolijo/de marca en vez de "roto" mientras no tengamos un
 * ilustrado propio para esa categoría.
 *
 * "Tapas y precintos" usa la chapa corona con marca DC (cat-tapas-precintos.png,
 * ilustración pasada por Marce el 27-jul-2026), re-encuadrada al mismo tamaño/
 * ocupación (~80%) que las demás.
 */
const CAT_IMG: Record<string, string> = {
  Botellas: "cat-botellas",
  Latas: "cat-latas",
  "Copas y vasos": "cat-copas-vasos",
  "Cajas y estuches": "cat-cajas",
  "Tapas y precintos": "cat-tapas-precintos",
  Botellones: "cat-botellones",
};

// Fallback si Sanity no responde.
const categoryDataFallback: { name: string; count: string; img?: string }[] = [
  { name: "Botellas", count: "~140", img: "cat-botellas" },
  { name: "Latas", count: "~38", img: "cat-latas" },
  { name: "Copas y vasos", count: "~170", img: "cat-copas-vasos" },
  { name: "Cajas y estuches", count: "~26", img: "cat-cajas" },
  { name: "Tapas y precintos", count: "~36", img: "cat-tapas-precintos" },
  { name: "Botellones", count: "~7", img: "cat-botellones" },
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

export default async function Home() {
  const wholesale = await isWholesale();
  const totalSkus = await getProductCount();

  // Una sola lectura del catálogo, reusada para featured + conteos de categoría.
  let allLegacy: Product[] = [];
  try {
    const all = await getProducts();
    allLegacy = all.map((p) => toLegacyProduct(p, wholesale));
  } catch (e) {
    console.error("[home] Sanity fetch failed:", (e as Error).message);
  }

  // Featured: badge "best" si hay, sino primeros 4, sino mock.
  let featured: Product[] = [];
  try {
    const best = await getFeaturedProducts();
    if (best.length > 0) featured = best.map((p) => toLegacyProduct(p, wholesale));
  } catch (e) {
    console.error("[home] featured fetch failed:", (e as Error).message);
  }
  if (featured.length === 0) featured = allLegacy.slice(0, 4);

  // Tiles de categoría: los 5 rubros sólidos del catálogo (top 5 por cantidad).
  // Mostramos 5 a propósito: son las categorías reales con volumen (Copas, Botellas,
  // Tapas, Latas, Botellones). Así evitamos que un rubro de cola (ej. Válvulas con 1
  // producto, o Accesorios) se cuele como 6º tile. Excluimos "Otros" y "Accesorios".
  const HIDE_FROM_HOME = new Set(["Otros", "Accesorios"]);
  const catCounts: Record<string, number> = {};
  for (const p of allLegacy) if (p.cat) catCounts[p.cat] = (catCounts[p.cat] ?? 0) + 1;
  let cats: { name: string; count: string; img?: string }[] = Object.entries(catCounts)
    .filter(([name]) => name && !HIDE_FROM_HOME.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count: String(count), img: CAT_IMG[name] }));
  if (cats.length === 0) cats = categoryDataFallback;

  // Clientes de la vidriera "confían en nosotros" (schema `client` en Sanity).
  // Si no hay clientes cargados, la sección se oculta (sin placeholders).
  let clients: SanityClient[] = [];
  try {
    clients = await getClients();
  } catch (e) {
    console.error("[home] clients fetch failed:", (e as Error).message);
  }

  // Combos activos desde Sanity. Si no hay (o falla), la sección se oculta.
  let combos: SanityCombo[] = [];
  try {
    combos = await getCombos();
  } catch (e) {
    console.error("[home] combos fetch failed:", (e as Error).message);
  }

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
                <div className="n">{totalSkus > 0 ? `${totalSkus}` : "~300"}</div>
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
              {[
                { fallbackSrc: "/img/bottle-amber.png", fallbackAlt: "Botella ámbar — packshot", big: true, size: 600 },
                { fallbackSrc: "/img/can.png", fallbackAlt: "Lata 473 — packshot", big: false, size: 300 },
                { fallbackSrc: "/img/pint.png", fallbackAlt: "Pinta cervecera", big: false, size: 300 },
              ].map((slot, i) => {
                const p = featured[i];
                const real = p?.imageUrl;
                const img = (
                  <Image
                    className={`ph${slot.big ? " big" : ""}`}
                    src={real ? p.imageUrl! : slot.fallbackSrc}
                    alt={real ? p.name : slot.fallbackAlt}
                    width={slot.size}
                    height={slot.size}
                    unoptimized={!!real}
                  />
                );
                return real ? (
                  <Link
                    key={p.id}
                    href={`/productos/${p.id}`}
                    style={{ position: "relative", display: "block", gridRow: slot.big ? "span 2" : undefined }}
                  >
                    {img}
                    <span className={s.collageTag}>{p.name}</span>
                  </Link>
                ) : (
                  <div key={i} style={{ position: "relative", gridRow: slot.big ? "span 2" : undefined }}>
                    {img}
                  </div>
                );
              })}
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
            {cats.map((c) => (
              <Link
                key={c.name}
                className={s.catTile}
                href={`/categoria/${catSlug(c.name)}`}
              >
                <Image
                  className="ph"
                  src={`/img/${c.img || "cat-generic"}.png`}
                  alt={c.name}
                  width={300}
                  height={300}
                />
                <div className={s.lab}>
                  <b>{c.name}</b>
                  <span>{c.count} productos</span>
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
              <ProductCard key={p!.id} product={p!} wholesale={wholesale} />
            ))}
          </div>
        </div>
      </section>

      {/* COMBOS — combos activos desde Sanity (schema `combo`). */}
      {combos.length > 0 && (
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
            </div>
            <div className="grid grid-3">
              {combos.map((c) => (
                <ComboCard key={c._id} combo={c} />
              ))}
            </div>
          </div>
        </section>
      )}

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
                <div className={s.ico}>
                  <Icon />
                </div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLIENTES QUE CONFÍAN — lee el schema `client` (getClients). Si no hay
          clientes cargados, la sección se oculta (sin placeholders). */}
      {clients.length > 0 && (
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
              {clients.slice(0, 8).map((c) => (
                <div key={c._id} className={s.brandLogo} title={c.name}>
                  {c.logo ? (
                    <Image
                      src={c.logo}
                      alt={c.name}
                      width={150}
                      height={60}
                      unoptimized
                      style={{ objectFit: "contain", maxHeight: "54px", width: "auto" }}
                    />
                  ) : (
                    c.name
                  )}
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
      )}

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
