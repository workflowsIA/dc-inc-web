"use client";
import type { Product } from "@/data/products";
import { ars } from "@/lib/format";
import { resolveDisplayPrice } from "@/lib/pricing";
import { SHIPPING_FROM } from "@/lib/shipping";
import { useWholesaleEntry } from "@/lib/wholesale-prices";
import { AddToCartIcon } from "./AddToCart";

/**
 * Pie de la card: precio + boton de carrito + nota de envio.
 *
 * Es lo unico de la card que depende del rol, asi que se resuelve en el cliente.
 * Gracias a eso ProductCard y las paginas que la usan (home, categoria, ficha)
 * se pueden prerenderizar estaticas y servirse desde el CDN.
 */
export default function CardFoot({ product }: { product: Product }) {
  const { ready, wholesale, entry } = useWholesaleEntry(product.id);
  // Si el usuario es mayorista pero su precio para ESTE producto no vino en el
  // mapa, mostramos el publico en vez de $0. Mejor un precio conservador que uno
  // roto.
  const showWholesale = !!entry;
  const may = entry?.may ?? product.may;
  // El payload estatico trae may: 0. Hasta que lleguen los precios mayoristas no
  // se puede agregar al carrito, o quedaria guardado a precio cero.
  const pricesPending = wholesale && !ready;

  const dp = resolveDisplayPrice({ ...product, may }, showWholesale);

  return (
    <>
      <div className="pcard-foot">
        <div className="pcard-price">
          <span className="price-from">Desde</span>
          {dp.strike && <span className="price-old">{ars(dp.strike)}</span>}
          <span className="price">{ars(dp.display)}</span>
          {/* Cliente final ve IVA incluido; mayorista ve neto + IVA */}
          <span className="price-unit">
            {dp.finalConsumer ? "IVA incl." : "+ IVA"}
          </span>
        </div>
        <AddToCartIcon
          disabled={pricesPending}
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            pub: product.pub,
            may,
            bulto: product.bulto,
            pallet: product.pallet,
            imageUrl: product.imageUrl,
          }}
        />
      </div>
      {dp.finalConsumer ? (
        <p style={{ marginTop: "6px", fontSize: "11px", color: "var(--muted)" }}>
          + Envío desde {ars(SHIPPING_FROM)}
        </p>
      ) : null}
    </>
  );
}
