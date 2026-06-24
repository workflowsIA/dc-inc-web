import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllComboSlugs,
  getComboBySlug,
} from "@/lib/sanity-data";
import { ars } from "@/lib/format";
import { waSimpleURL } from "@/lib/whatsapp";
import { AddComboToCart } from "@/components/blocks/AddComboToCart";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const slugs = await getAllComboSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let combo = null;
  try {
    combo = await getComboBySlug(slug);
  } catch {
    // ignore
  }
  if (!combo) return { title: "Combo no encontrado" };

  return {
    title: combo.name,
    description:
      combo.description ??
      `${combo.name} — combo armado de DC Inc. Stock real, factura A/B/E y envíos a todo el país.`,
    alternates: { canonical: `/combos/${slug}` },
  };
}

/**
 * El campo `badge` del combo es una etiqueta libre (string), no el enum de
 * badges de producto. Mapeamos cada label conocido a su clase de `ds.css`.
 */
function badgeClass(badge?: string): string {
  switch (badge) {
    case "Más vendido":
      return "badge-best";
    case "Promo del mes":
      return "badge-promo";
    case "Nuevo":
      return "badge-new";
    case "Decorado bonificado":
    default:
      return "badge-deco";
  }
}

export default async function ComboPage({ params }: Props) {
  const { slug } = await params;
  let combo = null;
  try {
    combo = await getComboBySlug(slug);
  } catch (e) {
    console.error("[combo page] Sanity fetch failed:", (e as Error).message);
  }
  if (!combo) notFound();

  const items = combo.items ?? [];

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <div className="product-layout">
        <div>
          {combo.image ? (
            <Image
              src={combo.image}
              alt={combo.name}
              width={600}
              height={600}
              unoptimized
              style={{
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--line)",
                background: "#fff",
                width: "100%",
                height: "auto",
              }}
            />
          ) : (
            <div
              className="ph"
              data-ph={combo.name}
              style={{ aspectRatio: "1/1", borderRadius: "var(--r-lg)" }}
            />
          )}
        </div>
        <div>
          <span className="eyebrow">Combo armado</span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            {combo.name}
          </h1>

          {combo.badge && (
            <div style={{ marginTop: "12px" }}>
              <span className={`badge ${badgeClass(combo.badge)}`}>{combo.badge}</span>
            </div>
          )}

          <div style={{ marginTop: "24px" }}>
            <div className="pcard-price" style={{ alignItems: "baseline" }}>
              {typeof combo.pricePublicOld === "number" && (
                <span className="price-old">{ars(combo.pricePublicOld)}</span>
              )}
              {typeof combo.pricePublicFrom === "number" && (
                <>
                  <span className="price-from">Desde</span>{" "}
                  <span className="price" style={{ fontSize: "28px" }}>
                    {ars(combo.pricePublicFrom)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
            {typeof combo.pricePublicFrom === "number" && (
              <AddComboToCart
                combo={{
                  slug: combo.slug,
                  name: combo.name,
                  price: combo.pricePublicFrom,
                }}
              />
            )}
            <a
              className="btn btn-wa btn-lg"
              href={waSimpleURL(`Hola DC Inc! Quiero cotizar el ${combo.name}.`)}
              target="_blank"
              rel="noopener"
            >
              Cotizar por WhatsApp
            </a>
          </div>

          {combo.description && (
            <div style={{ marginTop: "32px" }}>
              <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "10px" }}>
                Descripción
              </h3>
              <p
                style={{
                  whiteSpace: "pre-line",
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                {combo.description}
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "14px" }}>
                Incluye
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "12px" }}>
                {items.map((it) => {
                  const row = (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "10px",
                        border: "1px solid var(--line)",
                        borderRadius: "var(--r-lg)",
                        background: "#fff",
                      }}
                    >
                      {it.image ? (
                        <Image
                          src={it.image}
                          alt={it.name}
                          width={56}
                          height={56}
                          unoptimized
                          style={{
                            borderRadius: "var(--r-sm)",
                            background: "#fff",
                            objectFit: "contain",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          className="ph"
                          data-ph={it.name}
                          style={{ width: "56px", height: "56px", borderRadius: "var(--r-sm)", flexShrink: 0 }}
                        />
                      )}
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontWeight: 600, fontSize: "14px" }}>{it.name}</span>
                        {it.sku && !/^product[-_]/i.test(it.sku) && (
                          <span className="mono" style={{ color: "var(--muted)", fontSize: "12px" }}>
                            SKU: {it.sku}
                          </span>
                        )}
                      </span>
                    </span>
                  );
                  return (
                    <li key={it._id}>
                      {it.slug ? (
                        <Link href={`/productos/${it.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div style={{ marginTop: "32px" }}>
            <Link className="btn btn-ghost btn-lg" href="/productos">
              ← Volver al catálogo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
