"use client";
import { presentationOptions } from "@/lib/presentations";
import { useState } from "react";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import { resolveDisplayPrice, type PricingInput } from "@/lib/pricing";
import { SHIPPING_FROM } from "@/lib/shipping";
import type { PresentationPricing } from "@/lib/queries";
import { useWholesaleEntry } from "@/lib/wholesale-prices";

interface Props {
  product: ProductSnapshot;
  /** datos de precio crudos para resolver la vista (cliente final vs mayorista + oferta) */
  pricing: PricingInput;
  deli: string;
  /** filas Caja/Pallet de la planilla: definen QUÉ presentaciones se venden y a qué precio */
  presentationPricing?: PresentationPricing[];
}

interface Pres {
  label: string;
  units: number;
  sku?: string;
}

export default function ProductBuyBox({
  product,
  pricing: pricingProp,
  deli,
  presentationPricing: presentationPricingProp,
}: Props) {
  const add = useCart((s) => s.add);
  // El rol y los precios mayoristas se resuelven en el cliente (ver
  // src/lib/wholesale-prices.tsx). Asi la ficha se prerenderiza estatica.
  const { ready, wholesale: isWholesaleUser, entry } = useWholesaleEntry(product.id);
  const wholesale = !!entry;
  // Ver CardFoot: sin precios mayoristas el snapshot iria con may: 0.
  const pricesPending = isWholesaleUser && !ready;
  const pricing: PricingInput = entry ? { ...pricingProp, may: entry.may } : pricingProp;
  const presentationPricing: PresentationPricing[] | undefined = entry?.pres
    ? (presentationPricingProp ?? []).map((pp) => ({
        ...pp,
        priceWholesale:
          (pp.sku ? entry.pres?.[pp.sku] : undefined) ??
          (pp.unitsPerBulk && entry.pres?.[String(pp.unitsPerBulk)] != null
            ? entry.pres[String(pp.unitsPerBulk)]
            : pp.priceWholesale),
      }))
    : presentationPricingProp;
  // Precio de vista: cliente final ve IVA incluido + envío estimado; mayorista
  // ve neto + IVA y "envío a cotizar". La oferta (salePrice) aplica acá si vige.
  // `finalConsumer` sólo depende del rol (no del precio de presentación), así que
  // lo resolvemos con el pricing base para poder armar la lista de presentaciones.
  const finalConsumer = resolveDisplayPrice(pricing, wholesale).finalConsumer;
  // Bultos (caja/pallet) = filas de la planilla, de menor a mayor. Si la planilla
  // no tiene fila de caja para este producto, no se ofrece caja (ver
  // presentationOptions). Default = el bulto más chico.
  const bultoPres: Pres[] = presentationOptions(presentationPricing);
  // Minorista (cliente final) puede comprar de a UNA unidad: anteponemos la opción
  // Individual (units:1) y queda como default. Mayorista compra solo por bulto cerrado.
  // Unidad disponible para todos: DC habilitó comprar por unidad también al por
  // mayor. Antes el mayorista solo veía bultos cerrados (sin "Individual").
  const presList: Pres[] = [{ label: "Individual", units: 1 }, ...bultoPres];
  const hasPres = presList.length > 0;
  // Mayorista abre en el primer bulto (compra típica); minorista, en Individual.
  const firstBultoIdx = presList.findIndex((p) => p.units > 1);
  const [idx, setIdx] = useState(wholesale && firstBultoIdx > 0 ? firstBultoIdx : 0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const sel = hasPres ? presList[idx] : null;
  // Venta por bulto cerrado: si no hay presentaciones explícitas, caemos al
  // bulto real del producto (product.bulto) para no permitir unidades sueltas.
  const unitsPerSel = sel ? sel.units : product.bulto > 0 ? product.bulto : 1;
  const unitsTotal = unitsPerSel * qty;

  // DESCUENTO POR VOLUMEN: si la presentación elegida (caja/pallet) tiene un precio
  // propio en la planilla (presentationPricing), usamos SU precio por unidad; si no,
  // fallback al precio unitario del producto (cálculo lineal de siempre). Se linkea
  // por unidades por bulto (primario) o por label (fallback). Ese precio pasa por la
  // MISMA lógica resolveDisplayPrice → IVA/mayorista/oferta idénticos: la oferta
  // (salePrice) mantiene su prioridad porque resolveDisplayPrice la aplica si vige.
  const presMatch =
    sel && sel.units > 1 && presentationPricing?.length
      ? ((sel.sku ? presentationPricing.find((pp) => pp.sku === sel.sku) : undefined) ??
        presentationPricing.find((pp) => pp.unitsPerBulk === sel.units) ??
        null)
      : null;
  const selPricing: PricingInput =
    presMatch && presMatch.pricePublic != null
      ? { ...pricing, pub: presMatch.pricePublic, may: presMatch.priceWholesale ?? pricing.may }
      : pricing;
  const dp = resolveDisplayPrice(selPricing, wholesale);
  const unitPrice = dp.display;
  const bultoPrice = unitPrice * unitsPerSel;
  const total = unitPrice * unitsTotal;
  // Sufijo de IVA según el tipo de usuario.
  const ivaTag = finalConsumer ? "IVA incl." : "+ IVA";
  // Tachado por unidad (oferta o precio anterior), en la misma base que unitPrice.
  const strikeUnit = dp.strike;

  function handleAdd() {
    // Guardamos el precio NETO de la presentación elegida (selPricing.pub/may),
    // no el base, para que el carrito/checkout muestren el descuento por volumen.
    // presentationSku deja que /api/orders reprecie server-side con la misma
    // presentación (nunca confía en el precio del cliente).
    add(
      {
        ...product,
        pub: selPricing.pub,
        may: selPricing.may,
        bulto: unitsPerSel,
        presentationSku: presMatch?.sku,
        presentationLabel: presMatch ? sel?.label : undefined,
      },
      unitsTotal,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  const mayoristaBadge = wholesale ? (
    <span
      style={{
        marginLeft: "10px",
        fontSize: "12px",
        background: "var(--amber-soft)",
        color: "var(--amber-deep)",
        padding: "4px 10px",
        borderRadius: "var(--r-sm)",
      }}
    >
      Precio mayorista
    </span>
  ) : null;

  return (
    <div>
      {/* SELECTOR DE PRESENTACIÓN (bulto-primero) */}
      {hasPres && (
        <div style={{ marginBottom: "16px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
            Presentación{presList.length > 1 ? " — elegí cómo lo comprás" : ""}
          </span>
          <div className="chips" style={{ marginTop: "8px" }}>
            {presList.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={`chip ${i === idx ? "on" : ""}`}
                onClick={() => {
                  setIdx(i);
                  setQty(1);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PRECIO PROMINENTE */}
      <div style={{ padding: "20px", background: "var(--bg-2)", borderRadius: "var(--r-lg)" }}>
        {dp.onSale && (
          <span
            className="badge badge-promo"
            style={{ marginBottom: "8px", display: "inline-block" }}
          >
            Oferta
          </span>
        )}
        {unitsPerSel > 1 ? (
          <>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {sel ? `${sel.label} (${unitsPerSel} u)` : `Bulto cerrado (${unitsPerSel} u)`}
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: "32px", fontWeight: 700, color: "var(--ink)" }}>
              {strikeUnit ? (
                <span style={{ fontSize: "18px", color: "var(--muted)", textDecoration: "line-through", marginRight: "8px" }}>
                  {ars(strikeUnit * unitsPerSel)}
                </span>
              ) : null}
              {ars(bultoPrice)} <span style={{ fontSize: "14px", color: "var(--muted)" }}>{ivaTag}</span>
              {mayoristaBadge}
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--muted)" }}>
              {ars(unitPrice)} por unidad · despacho {deli}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>Precio por unidad</div>
            <div style={{ fontFamily: "var(--display)", fontSize: "32px", fontWeight: 700, color: "var(--ink)" }}>
              {strikeUnit ? (
                <span style={{ fontSize: "18px", color: "var(--muted)", textDecoration: "line-through", marginRight: "8px" }}>
                  {ars(strikeUnit)}
                </span>
              ) : null}
              {ars(unitPrice)} <span style={{ fontSize: "14px", color: "var(--muted)" }}>/ u {ivaTag}</span>
              {mayoristaBadge}
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--muted)" }}>Despacho {deli}</div>
          </>
        )}
        {/* Envío: cliente final ve estimado; mayorista, a cotizar */}
        <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
          {finalConsumer
            ? `Envío desde ${ars(SHIPPING_FROM)} — según destino, lo calculás en el carrito`
            : "Envío a cotizar"}
        </div>
      </div>

      {/* CANTIDAD + TOTAL */}
      <div style={{ marginTop: "18px", display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
            {unitsPerSel > 1 ? "Cantidad de bultos" : "Cantidad"}
          </span>
          <span className="qty">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1")))}
              aria-label="Cantidad"
            />
            <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Más">
              +
            </button>
          </span>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Total · {unitsTotal} u</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "22px", fontWeight: 700 }}>
            {ars(total)} <span style={{ fontSize: "12px", color: "var(--muted)" }}>{ivaTag}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        style={{ marginTop: "16px" }}
        disabled={pricesPending}
        onClick={handleAdd}
      >
        {added ? "✓ Agregado al carrito" : "Agregar al carrito"}
      </button>

      {unitsPerSel > 1 && (
        <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
          {finalConsumer
            ? `Comprás un bulto cerrado de ${unitsPerSel} u. Para unidades sueltas elegí «Individual».`
            : "Venta mayorista por bulto cerrado."}
        </p>
      )}
    </div>
  );
}
