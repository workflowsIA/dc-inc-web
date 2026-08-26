"use client";
import { presentationOptions } from "@/lib/presentations";
import { useState } from "react";
import type { Product } from "@/data/products";
import { ars } from "@/lib/format";
import { resolveDisplayPrice } from "@/lib/pricing";
import { SHIPPING_FROM } from "@/lib/shipping";
import { useWholesaleEntry, type WholesaleEntry } from "@/lib/wholesale-prices";
import { AddToCartIcon } from "./AddToCart";

/**
 * Pie de la card: precio + boton de carrito.
 *
 * Es lo unico de la card que depende del rol, asi que se resuelve en el cliente.
 * Gracias a eso ProductCard y las paginas que la usan se prerenderizan estaticas.
 *
 *  - CLIENTE FINAL / mayorista sin precios aun: "Desde" = precio unitario (IVA
 *    incluido para final, neto para el resto), y el "+" agrega 1 bulto.
 *  - MAYORISTA (con precios cargados): "Desde" = el precio por unidad MAS BAJO
 *    (el de la presentacion mas grande, normalmente pallet). Ademas muestra las
 *    presentaciones cliqueables (unidad / bulto / pallet) con su TOTAL, y el "+"
 *    hace compra rapida de la presentacion elegida (bulto/pallet/unidad).
 */
export default function CardFoot({ product }: { product: Product }) {
  const { ready, wholesale, entry } = useWholesaleEntry(product.id);
  const showWholesale = !!entry;
  const may = entry?.may ?? product.may;
  // El payload estatico trae may: 0. Hasta que lleguen los precios mayoristas no
  // se puede agregar al carrito, o quedaria guardado a precio cero.
  const pricesPending = wholesale && !ready;

  if (showWholesale && entry) {
    return <WholesaleFoot product={product} may={may} entry={entry} pricesPending={pricesPending} />;
  }

  // Cliente final (o mayorista con precios aun en camino): vista original.
  const dp = resolveDisplayPrice({ ...product, may }, false);
  return (
    <>
      <div className="pcard-foot">
        <div className="pcard-price">
          <span className="price-from">Desde</span>
          {dp.strike && <span className="price-old">{ars(dp.strike)}</span>}
          <span className="price">{ars(dp.display)}</span>
          <span className="price-unit">{dp.finalConsumer ? "IVA incl." : "+ IVA"}</span>
        </div>
        <AddToCartIcon
          disabled={pricesPending}
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            pub: product.pub,
            may,
            // Minorista/cliente final: el "+" de la card agrega 1 UNIDAD, no un
            // bulto. Si quiere una caja/pallet, lo elige en la ficha. bulto:1 →
            // el carrito lo trata por unidad (sin snapping a múltiplos de bulto).
            bulto: 1,
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

/** Opcion de compra de la card mayorista (unidad / bulto / pallet). */
interface PresOpt {
  units: number;
  label: string;
  perUnit: number;
  sku?: string;
}

function WholesaleFoot({
  product,
  may,
  entry,
  pricesPending,
}: {
  product: Product;
  may: number;
  entry: WholesaleEntry;
  pricesPending: boolean;
}) {
  // Armamos las presentaciones: unidad + cada caja/pallet real (con su SKU para
  // que /api/orders reprecie server-side por presentacion). El precio por unidad
  // de cada presentacion sale del mapa mayorista fresco (entry.pres, por unidades
  // por bulto); si falta, cae al precio unitario base (may).
  const pp = product.presentationPricing ?? [];
  // Presentaciones = filas Caja/Pallet/Paquete de la planilla (presentationPricing).
  // Si la planilla no tiene fila de caja, no se ofrece caja. El precio por
  // unidad sale del mapa mayorista fresco (entry.pres, por SKU de fila o por
  // unidades); si falta, cae al unitario base.
  const opts: PresOpt[] = [{ units: 1, label: "Unidad", perUnit: may }];
  for (const o of presentationOptions(pp)) {
    opts.push({
      units: o.units,
      label: o.label,
      perUnit: (o.sku ? entry.pres?.[o.sku] : undefined) ?? entry.pres?.[String(o.units)] ?? may,
      sku: o.sku,
    });
  }
  const minPerUnit = Math.min(...opts.map((o) => o.perUnit));
  // Default: el bulto mas chico (units > 1); si no hay, unidad.
  const firstBulto = opts.findIndex((o) => o.units > 1);
  const [idx, setIdx] = useState(firstBulto >= 0 ? firstBulto : 0);
  const sel = opts[idx] ?? opts[0];
  const total = sel.perUnit * sel.units;

  return (
    <>
      <div className="pcard-foot">
        <div className="pcard-price">
          <span className="price-from">Desde</span>
          <span className="price">{ars(minPerUnit)}</span>
          <span className="price-unit">+ IVA / u</span>
        </div>
        <AddToCartIcon
          disabled={pricesPending}
          product={{
            id: product.id,
            name: product.name,
            sku: product.sku,
            pub: product.pub,
            may: sel.perUnit,
            bulto: sel.units,
            pallet: product.pallet,
            imageUrl: product.imageUrl,
            presentationSku: sel.sku,
            presentationLabel: sel.units > 1 ? sel.label : undefined,
          }}
        />
      </div>
      {opts.length > 1 && (
        <div className="pcard-pres" style={{ position: "relative", zIndex: 2, marginTop: "8px" }}>
          <div className="chips">
            {opts.map((o, i) => (
              <button
                key={o.sku ?? o.units}
                type="button"
                className={`chip ${i === idx ? "on" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIdx(i);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted)" }}>
            {sel.label}: <strong style={{ color: "var(--ink)" }}>{ars(total)}</strong> + IVA
            {sel.units > 1 ? ` · ${sel.units} u` : ""}
          </p>
        </div>
      )}
    </>
  );
}
