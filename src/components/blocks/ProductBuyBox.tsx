"use client";
import { useState } from "react";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import {
  resolveDisplayPrice,
  ENVIO_ESTIMADO_CLIENTE_FINAL,
  type PricingInput,
} from "@/lib/pricing";
import type { PresentationPricing } from "@/lib/queries";

interface Props {
  product: ProductSnapshot;
  /** datos de precio crudos para resolver la vista (cliente final vs mayorista + oferta) */
  pricing: PricingInput;
  wholesale: boolean;
  deli: string;
  presentations?: string[];
  /** precio real por presentación (caja/pallet) para reflejar el descuento por volumen */
  presentationPricing?: PresentationPricing[];
}

interface Pres {
  label: string;
  units: number;
}

/** "24 unidades en cajas" → {label, units:24}. */
function parsePres(s: string): Pres {
  const m = s.replace(/\./g, "").match(/(\d+)/);
  return { label: s, units: m ? parseInt(m[1], 10) : 1 };
}

export default function ProductBuyBox({ product, pricing, wholesale, deli, presentations, presentationPricing }: Props) {
  const add = useCart((s) => s.add);
  // Precio de vista: cliente final ve IVA incluido + envío estimado; mayorista
  // ve neto + IVA y "envío a cotizar". La oferta (salePrice) aplica acá si vige.
  // `finalConsumer` sólo depende del rol (no del precio de presentación), así que
  // lo resolvemos con el pricing base para poder armar la lista de presentaciones.
  const finalConsumer = resolveDisplayPrice(pricing, wholesale).finalConsumer;
  // Bultos (caja/pallet) ordenados de menor a mayor → default = el bulto más chico.
  const bultoPres = (presentations ?? []).map(parsePres).sort((a, b) => a.units - b.units);
  // Minorista (cliente final) puede comprar de a UNA unidad: anteponemos la opción
  // Individual (units:1) y queda como default. Mayorista compra solo por bulto cerrado.
  const presList: Pres[] = finalConsumer
    ? [{ label: "Individual", units: 1 }, ...bultoPres]
    : bultoPres;
  const hasPres = presList.length > 0;
  const [idx, setIdx] = useState(0);
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
      ? (presentationPricing.find((pp) => pp.unitsPerBulk === sel.units) ??
        presentationPricing.find(
          (pp) => !!pp.label && sel.label.toLowerCase().includes(pp.label.toLowerCase()),
        ) ??
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
    add({ ...product, bulto: unitsPerSel }, unitsTotal);
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
            ? `Envío estimado: ${ars(ENVIO_ESTIMADO_CLIENTE_FINAL)} (se confirma al cerrar)`
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

      <button type="button" className="btn btn-primary btn-lg btn-block" style={{ marginTop: "16px" }} onClick={handleAdd}>
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
