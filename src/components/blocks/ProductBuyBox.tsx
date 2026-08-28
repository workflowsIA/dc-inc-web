"use client";
import { presentationOptions } from "@/lib/presentations";
import { useState } from "react";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import { resolveDisplayPrice, retailCanBuyPresentation, type PricingInput } from "@/lib/pricing";
import { SHIPPING_FROM } from "@/lib/shipping";
import type { PresentationPricing } from "@/lib/queries";
import { useWholesaleEntry } from "@/lib/wholesale-prices";
import WholesaleCta from "./WholesaleCta";
import { decoMinUnits, decoQuote, type DecoOption } from "@/lib/deco";

interface Props {
  product: ProductSnapshot;
  /** datos de precio crudos para resolver la vista (cliente final vs mayorista + oferta) */
  pricing: PricingInput;
  deli: string;
  /** filas Caja/Pallet de la planilla: definen QUÉ presentaciones se venden y a qué precio */
  presentationPricing?: PresentationPricing[];
  /** opciones de decorado con precio para este producto (1 cara / 2 caras); vacío = sin decorado en la ficha */
  decoOptions?: DecoOption[];
  /** se vende solo por presentación cerrada (productos por color, tapas corona): sin "Individual" */
  bulkOnly?: boolean;
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
  decoOptions = [],
  bulkOnly = false,
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
  // Productos por color (tapas corona): solo presentación cerrada, sin Individual.
  const presList: Pres[] = bulkOnly
    ? bultoPres
    : [{ label: "Individual", units: 1 }, ...bultoPres];
  const hasPres = presList.length > 0;
  // Mayorista abre en el primer bulto (compra típica); minorista, en Individual.
  const firstBultoIdx = presList.findIndex((p) => p.units > 1);
  const [idx, setIdx] = useState(
    (wholesale || bulkOnly) && firstBultoIdx >= 0 ? firstBultoIdx : 0,
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // COLOR / TERMINACIÓN: las tapas corona tienen paquetes x100 por color (filas
  // con `variant` y SKU propio). Para unidad y caja la planilla no tiene código
  // por color → el color se elige acá y viaja como TEXTO con el SKU genérico
  // (decisión Fede, 27-ago-2026). Las opciones salen de las variantes cargadas.
  const colorOptions = Array.from(
    new Set((presentationPricingProp ?? []).map((pp) => pp.variant?.trim()).filter(Boolean) as string[]),
  );
  const [color, setColor] = useState<string>(colorOptions[0] ?? "");
  // DECORADO (serigrafía) como extra: -1 = sin decorado; si no, índice en
  // decoOptions. Se cotiza por tramo según la cantidad total de piezas y se
  // agrega como línea aparte (SKU del tramo). Ver src/lib/deco.ts.
  const [decoIdx, setDecoIdx] = useState(-1);

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
  // La presentación elegida ya trae color propio (paquete por color) → no se pide.
  const needsColor = colorOptions.length > 0 && !presMatch?.variant;
  const selPricing: PricingInput =
    presMatch && presMatch.pricePublic != null
      ? { ...pricing, pub: presMatch.pricePublic, may: presMatch.priceWholesale ?? pricing.may }
      : pricing;
  // TOPE MINORISTA: el cliente final compra por unidad, o una presentación
  // cerrada solo si su total con IVA no pasa RETAIL_PRESENTATION_MAX. Por
  // encima, la presentación se ve con el precio mayorista (neto + IVA) pero no
  // se puede agregar: se lo invita a pedir el alta. Ver pricing.ts.
  const retailBlocked =
    !wholesale && unitsPerSel > 1 && !retailCanBuyPresentation(selPricing.pub, unitsPerSel);
  // Bloqueado → misma vista que el mayorista (neto, "+ IVA"), para que vea el
  // precio al que accedería con el alta.
  const dp = resolveDisplayPrice(
    retailBlocked ? { ...selPricing, may: selPricing.pub } : selPricing,
    wholesale || retailBlocked,
  );
  const unitPrice = dp.display;
  const bultoPrice = unitPrice * unitsPerSel;
  const total = unitPrice * unitsTotal;
  // Decorado elegido y su cotización para la cantidad actual (null = por
  // debajo del tramo mínimo). El precio se muestra en la misma base que el
  // producto (IVA incl. para cliente final, neto para mayorista).
  const decoSel =
    decoIdx >= 0 && decoOptions[decoIdx] && unitsTotal >= decoMinUnits(decoOptions[decoIdx])
      ? decoOptions[decoIdx]
      : undefined;
  const decoQ = decoSel ? decoQuote(decoSel, unitsTotal) : null;
  const decoFactor = finalConsumer && !retailBlocked ? 1 + 0.21 : 1;
  // Sufijo de IVA según el tipo de usuario.
  const ivaTag = finalConsumer && !retailBlocked ? "IVA incl." : "+ IVA";
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
        variant: needsColor && color ? color : undefined,
      },
      unitsTotal,
      !!decoQ,
    );
    // Decorado: una línea por el tramo (qty = piezas). /api/orders reprecia
    // por SKU contra la tarifa. Montaje y horneado ya va incluido en la tarifa
    // por pieza (no se agrega línea aparte; Marce, 28-ago).
    if (decoQ) {
      const tag = `${decoQ.option.label} — ${product.name}`;
      add(
        {
          id: `deco-${product.id}-${decoQ.option.sides}`,
          name: `Decorado ${tag}`,
          sku: decoQ.tier.sku,
          pub: decoQ.perUnit,
          may: decoQ.perUnit,
          bulto: 1,
          kind: "deco",
          decoFor: product.id,
        },
        unitsTotal,
      );
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  const mayoristaBadge = wholesale || retailBlocked ? (
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

      {/* COLOR / TERMINACIÓN (solo productos con variantes, unidad o caja) */}
      {needsColor && (
        <div style={{ marginBottom: "16px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Color / terminación</span>
          <div className="chips" style={{ marginTop: "8px" }}>
            {colorOptions.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${c === color ? "on" : ""}`}
                onClick={() => setColor(c)}
              >
                {c}
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
        {/* Decorado elegido: desglose acá arriba, junto al precio del producto */}
        {decoQ && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              + Decorado {decoQ.option.label}: {ars(decoQ.perUnit * decoFactor)} por pieza × {unitsTotal} u
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: "22px", fontWeight: 700, color: "var(--ink)", marginTop: "2px" }}>
              {ars(decoQ.total * decoFactor)}{" "}
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>{ivaTag} de decorado</span>
            </div>
            <div style={{ marginTop: "2px", fontSize: "12px", color: "var(--muted)" }}>
              Incluye gráfica, montaje y horneado.
            </div>
            <div style={{ marginTop: "6px", fontSize: "13px", color: "var(--ink)" }}>
              Con decorado: <strong>{ars((unitsPerSel > 1 ? bultoPrice * qty : unitPrice * qty) + decoQ.total * decoFactor)}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>{ivaTag}</span>
            </div>
          </div>
        )}
        {/* Envío: cliente final ve estimado; mayorista, a cotizar */}
        <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
          {finalConsumer && !retailBlocked
            ? `Envío desde ${ars(SHIPPING_FROM)} — según destino, lo calculás en el carrito`
            : "Envío a cotizar"}
        </div>
      </div>

      {retailBlocked && <WholesaleCta />}

      {/* DECORADO (opcional) — solo productos con tarifa de la planilla */}
      {decoOptions.length > 0 && !retailBlocked && (
        <div style={{ marginTop: "18px", padding: "16px", border: "1px solid var(--line)", borderRadius: "var(--r-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>Decorado con tu marca (opcional)</span>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Serigrafía 1 color · desde {Math.min(...decoOptions.map(decoMinUnits))} u · el arte se coordina por WhatsApp
            </span>
          </div>
          <div className="chips" style={{ marginTop: "8px" }}>
            <button type="button" className={`chip ${decoIdx < 0 ? "on" : ""}`} onClick={() => setDecoIdx(-1)}>
              Sin decorado
            </button>
            {decoOptions.map((o, i) => {
              // Deshabilitado hasta llegar al tramo mínimo de ESA opción.
              const min = decoMinUnits(o);
              const enabled = unitsTotal >= min;
              return (
                <button
                  key={`${o.family}-${o.sides}`}
                  type="button"
                  className={`chip ${i === decoIdx && enabled ? "on" : ""}`}
                  disabled={!enabled}
                  title={enabled ? undefined : `Disponible a partir de ${min} piezas`}
                  style={enabled ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
                  onClick={() => setDecoIdx(i)}
                >
                  {o.label}
                  {enabled ? "" : ` · desde ${min} u`}
                </button>
              );
            })}
          </div>

          {!decoQ && unitsTotal < Math.min(...decoOptions.map(decoMinUnits)) && (
            <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--muted)" }}>
              Se decora a partir de {Math.min(...decoOptions.map(decoMinUnits))} piezas (hoy: {unitsTotal} u).
              Subí la cantidad o elegí una caja para habilitarlo.
            </p>
          )}
        </div>
      )}

      {/* CANTIDAD + TOTAL */}
      <div
        style={{
          marginTop: "18px",
          display: retailBlocked ? "none" : "flex",
          gap: "12px",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
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
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Total · {unitsTotal} u{decoQ ? " + decorado" : ""}
          </div>
          <div style={{ fontFamily: "var(--display)", fontSize: "22px", fontWeight: 700 }}>
            {ars(total + (decoQ ? decoQ.total * decoFactor : 0))}{" "}
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>{ivaTag}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        style={{ marginTop: "16px" }}
        disabled={pricesPending || retailBlocked}
        onClick={handleAdd}
      >
        {retailBlocked
          ? "Solo para clientes mayoristas"
          : added
            ? "✓ Agregado al carrito"
            : "Agregar al carrito"}
      </button>

      {unitsPerSel > 1 && !retailBlocked && (
        <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
          {finalConsumer
            ? `Comprás un bulto cerrado de ${unitsPerSel} u. Para unidades sueltas elegí «Individual».`
            : "Venta mayorista por bulto cerrado."}
        </p>
      )}
    </div>
  );
}
