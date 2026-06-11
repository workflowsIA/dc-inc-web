import Image from "next/image";
import Link from "next/link";
import type { Product, Badge } from "@/data/products";
import { ars } from "@/lib/format";
import { AddToCartIcon } from "./AddToCart";

const BADGE_LABELS: Record<Badge, { cls: string; label: string }> = {
  best: { cls: "badge-best", label: "Más vendido" },
  new: { cls: "badge-new", label: "Nuevo" },
  promo: { cls: "badge-promo", label: "Promo del mes" },
  deco: { cls: "badge-deco", label: "Decorado bonificado" },
};

interface Props {
  product: Product;
  /** si true, el precio mayorista pisa al público (usuario logueado como mayorista) */
  wholesale?: boolean;
}

export default function ProductCard({ product, wholesale = false }: Props) {
  const price = wholesale ? product.may : product.pub;
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
      <Link className="pcard-media" href={`/productos/${product.id}`}>
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
          {product.sub ? ` · ${product.sub}` : ""}
        </span>
        <h3 className="pcard-title">
          <Link href={`/productos/${product.id}`}>{product.name}</Link>
        </h3>
        <div className="pcard-specs">
          {product.bulto > 1 && <span>Bulto: {product.bulto} u</span>}
          {product.pallet > 0 && <span>Pallet: {product.pallet} u</span>}
          <span>{product.deli}</span>
          <span className={`stock ${stockClass}`}>{stockLabel}</span>
        </div>
        <div className="pcard-foot">
          <div className="pcard-price">
            <span className="price-from">Desde</span>
            {product.oldPub && !wholesale && (
              <span className="price-old">{ars(product.oldPub)}</span>
            )}
            <span className="price">{ars(price)}</span>
          </div>
          <AddToCartIcon
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              pub: product.pub,
              may: product.may,
              bulto: product.bulto,
              pallet: product.pallet,
              imageUrl: product.imageUrl,
            }}
          />
        </div>
      </div>
    </article>
  );
}
