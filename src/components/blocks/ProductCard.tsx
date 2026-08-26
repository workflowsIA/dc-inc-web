import { presentationOptions } from "@/lib/presentations";
import Image from "next/image";
import Link from "next/link";
import type { Product, Badge } from "@/data/products";
import CardFoot from "./CardFoot";

const BADGE_LABELS: Record<Badge, { cls: string; label: string }> = {
  best: { cls: "badge-best", label: "Más vendido" },
  new: { cls: "badge-new", label: "Nuevo" },
  promo: { cls: "badge-promo", label: "Promo del mes" },
  deco: { cls: "badge-deco", label: "Decorado bonificado" },
};

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const stockClass =
    product.stock === "ok"
      ? "stock-ok"
      : product.stock === "low"
        ? "stock-low"
        : "stock-no";
  const stockLabel =
    product.stock === "ok"
      ? "En stock"
      : product.stock === "low"
        ? "Stock limitado"
        : "Sin stock";

  return (
    <article className="pcard">
      {/* overlay: toda la card lleva a la ficha */}
      <Link
        className="pcard-link"
        href={`/productos/${product.id}`} prefetch={false}
        aria-label={product.name}
        tabIndex={-1}
        aria-hidden="true"
      />
      <Link className="pcard-media" href={`/productos/${product.id}`} prefetch={false}>
        {product.imageUrl ? (
          <Image
            className="pcard-img"
            src={product.imageUrl}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
            unoptimized
          />
        ) : product.img ? (
          <Image
            className="pcard-img"
            src={`/img/${product.img}.png`}
            alt={product.name}
            width={400}
            height={400}
            loading="lazy"
          />
        ) : (
          <div className="ph" data-ph={`${product.cat} · packshot`} />
        )}
        <div className="pcard-badges">
          {product.badges.map((b) => (
            <span key={b} className={`badge ${BADGE_LABELS[b].cls}`}>
              {BADGE_LABELS[b].label}
            </span>
          ))}
        </div>
      </Link>
      <div className="pcard-body">
        <span className="pcard-cat">
          {product.cat}
          {product.subs?.length ? ` · ${product.subs.join(", ")}` : product.sub ? ` · ${product.sub}` : ""}
        </span>
        <h3 className="pcard-title">
          <Link href={`/productos/${product.id}`} prefetch={false}>{product.name}</Link>
        </h3>
        <div className="pcard-specs">
          {/* Presentaciones reales (filas de la planilla), no el texto heredado de Wix. */}
          {presentationOptions(product.presentationPricing)
            .slice(0, 2)
            .map((o) => (
              <span key={o.key}>{o.label}</span>
            ))}
          <span>{product.deli}</span>
          <span className={`stock ${stockClass}`}>{stockLabel}</span>
        </div>
        <CardFoot product={product} />
      </div>
    </article>
  );
}
