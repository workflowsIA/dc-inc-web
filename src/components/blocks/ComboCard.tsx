import Image from "next/image";
import Link from "next/link";
import type { SanityCombo } from "@/lib/queries";
import { ars } from "@/lib/format";
import s from "./ComboCard.module.css";

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

export default function ComboCard({ combo }: { combo: SanityCombo }) {
  const href = `/combos/${combo.slug}`;
  return (
    <article className={s.combo}>
      {/* overlay: toda la card lleva a la ficha del combo */}
      <Link className={s.link} href={href} aria-label={combo.name} />
      <div className={s.media}>
        {combo.image ? (
          <Image
            className={s.img}
            src={combo.image}
            alt={combo.name}
            width={480}
            height={300}
            loading="lazy"
            unoptimized
          />
        ) : (
          <div className="ph" data-ph={combo.name} />
        )}
        {combo.badge && (
          <div className={`pcard-badges ${s.badges}`}>
            <span className={`badge ${badgeClass(combo.badge)}`}>{combo.badge}</span>
          </div>
        )}
      </div>
      <div className={s.body}>
        <h3>{combo.name}</h3>
        {combo.description && <p>{combo.description}</p>}
        <div className={s.foot}>
          <div>
            {typeof combo.pricePublicOld === "number" && (
              <span className="price-old">{ars(combo.pricePublicOld)}</span>
            )}{" "}
            {typeof combo.pricePublicFrom === "number" && (
              <>
                <span className="price-from">Desde</span>{" "}
                <span className="price">{ars(combo.pricePublicFrom)}</span>
              </>
            )}
          </div>
          <span className="btn btn-dark btn-sm" style={{ position: "relative", zIndex: 2 }}>
            Ver combo
          </span>
        </div>
      </div>
    </article>
  );
}
