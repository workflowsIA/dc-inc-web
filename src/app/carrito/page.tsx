"use client";
import Link from "next/link";
import QtyInput from "@/components/blocks/QtyInput";
import { OrderNotices } from "@/components/blocks/OrderNotices";
import { useEffect, useState } from "react";
import { useCart, lineKey } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import { RETAIL_CART_MAX, retailCartExceeded } from "@/lib/pricing";
import { totalsFor, unitPrice, waOrderURL } from "@/lib/whatsapp";
import {
  bandForCp,
  isValidCp,
  SHIPPING_BAND_LABEL,
  BATU_ZONE_OPTIONS,
  DEFAULT_SHIPPING_CONFIG,
  type BatuZone,
  type ShippingConfig,
} from "@/lib/shipping";
import { useWholesaleCtx, useRepricedItems } from "@/lib/wholesale-prices";
import { RetailCapNotice } from "@/components/blocks/WholesaleCta";
import { TotalsRows } from "@/components/blocks/TotalsRows";

export default function CarritoPage() {
  const rawItems = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const { ready, wholesale } = useWholesaleCtx();
  // Reprecio mayorista fresco: evita mostrar $0 cuando el carrito se armo anonimo
  // (snapshot con may:0) y luego se logueo como mayorista. Ver useRepricedItems.
  const items = useRepricedItems(rawItems);
  const pricePending = wholesale && !ready;
  const money = (n: number) => (pricePending ? "—" : ars(n));
  const [cp, setCp] = useState("");
  // Default a Batu Zona 1 (CABA, la más barata) en vez de caer a Andreani AMBA
  // ($23k). El cliente del interior cambia a "Al interior / uso CP".
  const [batuZone, setBatuZone] = useState<BatuZone | null>(1);
  const [shipMsg, setShipMsg] = useState(false);
  // Config de envíos (Sanity, editable por Marce). Arranca en el default
  // hardcodeado y se refresca con /api/shipping-config, así el monto que ve el
  // cliente coincide con lo que cobra el server.
  const [shipCfg, setShipCfg] = useState<ShippingConfig>(DEFAULT_SHIPPING_CONFIG);
  useEffect(() => {
    let ok = true;
    fetch("/api/shipping-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (ok && d) setShipCfg(d as ShippingConfig);
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, []);

  const t = totalsFor(items, wholesale, cp, batuZone, shipCfg);
  // Tope minorista por carrito: pasado el monto no se puede seguir al checkout.
  // El aviso con el motivo lo pone <RetailCapNotice/> arriba del resumen.
  const capped = !wholesale && retailCartExceeded(t.net);
  // Cliente final "al interior / otro" (sin zona Batu) NECESITA un CP válido:
  // sin banda no hay tarifa que cobrar (ver andreaniQuote en shipping.ts), así
  // que no se puede avanzar al checkout hasta que lo cargue bien.
  const cpMissing = !wholesale && !batuZone && !isValidCp(cp);

  if (items.length === 0) {
    return (
      <div className="wrap" style={{ padding: "80px 24px", textAlign: "center" }}>
        <h1 className="h-lg">Tu carrito está vacío</h1>
        <p className="lead" style={{ marginTop: "12px" }}>
          Armá tu pedido desde el catálogo y cotizá por WhatsApp.
        </p>
        <Link className="btn btn-primary btn-lg" style={{ marginTop: "24px" }} href="/productos">
          Ver catálogo
        </Link>
      </div>
    );
  }

  const nItems = items.length;

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <div className="cart-head">
        <div>
          <h1 className="h-lg">Tu pedido</h1>
          <p style={{ marginTop: "6px", fontSize: "13px", color: "var(--muted)" }}>
            {nItems} {nItems === 1 ? "artículo" : "artículos"}
          </p>
        </div>
        {/* Seguir comprando / vaciar (pedido de Marce, ago-2026) */}
        <div className="cart-head-actions">
          <Link className="btn btn-ghost btn-sm" href="/productos" prefetch={false}>
            + Agregar productos
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.confirm("¿Vaciar el carrito? Se sacan todos los productos.")) clear();
            }}
          >
            Vaciar carrito
          </button>
        </div>
      </div>

      <RetailCapNotice netProducts={t.net} wholesale={wholesale} />

      <div className="cart-layout">
        <div style={{ display: "grid", gap: "12px" }}>
          {items.map((i) => (
            <div
              key={lineKey(i)}
              className="cart-line"
              style={{
                padding: "16px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r)",
                background: "#fff",
              }}
            >
              <div className="cart-line-main" style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={i.imageUrl}
                    alt={i.name}
                    width={56}
                    height={56}
                    style={{
                      width: "56px",
                      height: "56px",
                      objectFit: "contain",
                      background: "#fff",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-sm)",
                      flex: "none",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      background: "var(--bg-2)",
                      borderRadius: "var(--r-sm)",
                      flex: "none",
                    }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{i.name}</div>
                  <div className="mono" style={{ fontSize: "12px", color: "var(--muted)", overflowWrap: "anywhere" }}>
                    {i.kind === "combo" ? "Combo armado" : i.kind === "deco" ? `Decorado · ${i.sku}` : (i.presentationSku ?? i.sku)}
                    {i.kind !== "combo" && i.bulto > 1
                      ? ` · ${i.presentationLabel ?? `bulto ${i.bulto} u`}`
                      : ""}
                    {i.variant ? ` · ${i.variant}` : ""}
                    {i.deco ? " · con decorado" : ""}
                  </div>
                </div>
              </div>
              {/* Venta por bulto cerrado: los ± y el input se mueven de a 1 bulto
                  (= i.bulto unidades). La cantidad mostrada son BULTOS. */}
              {(() => {
                const step = i.bulto > 0 ? i.bulto : 1;
                const bultos = Math.max(1, Math.round(i.qty / step));
                // Líneas de decorado: la cantidad la fija el producto decorado
                // (se cotizó por tramo). Para cambiarla, quitar y volver a agregar.
                if (i.kind === "deco") {
                  return (
                    <div className="cart-line-qty" style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {i.decoFor ? "Cotizado según la cantidad del producto" : ""}
                    </div>
                  );
                }
                return (
                  <div className="cart-line-qty" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setQty(lineKey(i), i.qty - step)}>
                      −
                    </button>
                    <QtyInput
                      value={bultos}
                      onChange={(n) => setQty(lineKey(i), n * step)}
                      ariaLabel={step > 1 ? "Cantidad de bultos" : "Cantidad"}
                      style={{
                        width: "64px",
                        textAlign: "center",
                        padding: "8px",
                        border: "1px solid var(--line-2)",
                        borderRadius: "var(--r-sm)",
                        fontSize: "16px",
                      }}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => setQty(lineKey(i), i.qty + step)}>
                      +
                    </button>
                  </div>
                );
              })()}
              <div className="cart-line-price" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ textAlign: "right" }}>
                  {/* Cliente final ve el precio con IVA incluido; mayorista, neto */}
                  <strong>
                    {money(unitPrice(i, wholesale) * i.qty * (wholesale ? 1 : 1.21))}
                  </strong>
                  {(() => {
                    const step = i.bulto > 0 ? i.bulto : 1;
                    const bultos = Math.max(1, Math.round(i.qty / step));
                    return (
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {i.kind === "combo"
                          ? `${i.qty} ${i.qty === 1 ? "combo" : "combos"}`
                          : i.kind === "deco"
                            ? `${i.qty} ${i.qty === 1 ? "pieza" : "piezas"}`
                            : step > 1
                            ? `${bultos} ${bultos === 1 ? "bulto" : "bultos"} · ${i.qty} u`
                            : `${i.qty} u`}
                      </div>
                    );
                  })()}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(lineKey(i))} aria-label="Quitar del carrito">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* RESUMEN */}
        <aside
          style={{
            padding: "24px",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-lg)",
            background: "var(--bg-2)",
            position: "sticky",
            top: "100px",
            height: "fit-content",
          }}
        >
          <h3 className="h-md" style={{ fontSize: "18px" }}>
            Resumen
          </h3>
          <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--amber-deep)", fontWeight: 700 }}>
            {pricePending
              ? "Actualizando precios mayoristas…"
              : wholesale
                ? "Precios mayoristas aplicados (neto + IVA)"
                : "Precios con IVA incluido"}
          </p>
          <div style={{ marginTop: "16px", display: "grid", gap: "8px", fontSize: "14px" }}>
            <TotalsRows t={t} money={money} />
          </div>
          <OrderNotices
            finalConsumer={t.finalConsumer}
            shippingQuote={t.shippingQuote}
            shippingReason={t.shippingReason}
          />
          {t.hasDeco && (
            <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--muted)" }}>
              Incluye decorado — coordinamos arte por WhatsApp.
            </p>
          )}

          {/* Envío — Batu (CABA/GBA, envío propio) o CP (interior, estimado Andreani) */}
          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--line)" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
              Calcular envío
            </label>
            <select
              value={batuZone ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setBatuZone(v ? (Number(v) as BatuZone) : null);
                setShipMsg(true);
              }}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "10px 12px",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--r-sm)",
                fontSize: "14px",
              }}
            >
              <option value="">Al interior / otro (uso el código postal)</option>
              {BATU_ZONE_OPTIONS.map((z) => (
                <option key={z.zone} value={z.zone}>
                  {z.label}
                </option>
              ))}
            </select>
            {!batuZone && (
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <input
                  inputMode="numeric"
                  placeholder={
                    wholesale
                      ? "…o tu código postal (interior)"
                      : "Código postal (obligatorio para calcular el envío)"
                  }
                  value={cp}
                  onChange={(e) => {
                    setCp(e.target.value);
                    setShipMsg(false);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "10px 12px",
                    border: "1px solid var(--line-2)",
                    borderRadius: "var(--r-sm)",
                    fontSize: "14px",
                  }}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShipMsg(cp.trim().length > 0)}
                >
                  Calcular
                </button>
              </div>
            )}
            {batuZone ? (
              <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                Envío propio a <strong>Zona {batuZone}</strong> (CABA/GBA):{" "}
                <strong>{ars(t.shipping)}</strong> (estimado, se confirma al cerrar).
              </p>
            ) : cpMissing ? (
              // Cliente final sin zona Batu: el CP es obligatorio. Este mensaje se
              // ve SIEMPRE (no espera al click en "Calcular") porque bloquea avanzar.
              <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--danger, #c0392b)" }}>
                Ingresá un código postal válido de 4 dígitos (ej. 5515) para calcular el
                envío.
              </p>
            ) : (
              shipMsg &&
              (bandForCp(cp) ? (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                  Envío a domicilio a <strong>{SHIPPING_BAND_LABEL[bandForCp(cp)!]}</strong>:{" "}
                  <strong>{ars(t.shipping)}</strong> (estimado, se confirma al cerrar).
                </p>
              ) : (
                <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                  No reconocimos ese código postal. Verificá los 4 dígitos o coordinamos
                  el envío por WhatsApp al confirmar.
                </p>
              ))
            )}
          </div>

          {capped && !cpMissing ? (
            // Sobre el tope no se paga online, pero el pedido se puede cerrar por
            // WhatsApp DESDE EL CHECKOUT: ahí se cargan los datos del cliente y el
            // pedido queda guardado en el panel (origin "whatsapp").
            <Link
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: "20px" }}
              href="/checkout"
              title={`El máximo de compra online minorista es ${ars(RETAIL_CART_MAX)} IVA incluido`}
            >
              Continuar para cerrar por WhatsApp →
            </Link>
          ) : cpMissing ? (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: "20px" }}
              disabled
              title="Ingresá un código postal válido de 4 dígitos para calcular el envío"
            >
              Ingresá tu código postal
            </button>
          ) : (
            <Link
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: "20px" }}
              href="/checkout"
            >
              Continuar →
            </Link>
          )}
          <a
            className="btn btn-wa btn-block"
            style={{ marginTop: "10px" }}
            href={waOrderURL(items, wholesale, cp, batuZone, shipCfg)}
            target="_blank"
            rel="noopener"
          >
            O cotizá directo por WhatsApp
          </a>
        </aside>
      </div>
    </div>
  );
}

