"use client";
import Link from "next/link";
import { OrderNotices } from "@/components/blocks/OrderNotices";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useCart, lineKey } from "@/lib/cart-store";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
import { ars } from "@/lib/format";
import { retailCartExceeded } from "@/lib/pricing";
import { totalsFor, unitPrice, waCheckoutURL, type CheckoutInfo } from "@/lib/whatsapp";
import {
  BATU_ZONE_OPTIONS,
  DEFAULT_SHIPPING_CONFIG,
  isValidCp,
  normalizeCp,
  type BatuZone,
  type ShippingConfig,
} from "@/lib/shipping";
import { useWholesaleCtx, useRepricedItems } from "@/lib/wholesale-prices";
import { RetailCapNotice } from "@/components/blocks/WholesaleCta";
import { TotalsRows } from "@/components/blocks/TotalsRows";

export default function CheckoutPage() {
  // Esperamos a que Clerk cargue al usuario antes de montar el formulario, así
  // el prefill (Nombre/Email) se calcula con los datos del user ya disponibles.
  const { user, isLoaded } = useUser();
  if (!isLoaded) {
    return <div className="wrap" style={{ padding: "80px 24px", textAlign: "center" }} />;
  }
  return <CheckoutForm user={user ?? null} />;
}

function CheckoutForm({ user }: { user: ClerkUser | null }) {
  const rawItems = useCart((s) => s.items);
  const role = user?.publicMetadata?.role as string | undefined;
  const wholesale = role === "wholesale" || role === "admin";
  // Reprecio mayorista fresco (mismo fix que el carrito): evita el total en $0
  // cuando el carrito se armo anonimo y luego se logueo como mayorista.
  const items = useRepricedItems(rawItems);
  const { ready: pricesReady } = useWholesaleCtx();
  const pricePending = wholesale && !pricesReady;
  const money = (n: number) => (pricePending ? "—" : ars(n));
  const md = (user?.unsafeMetadata ?? {}) as Record<string, string>;

  // Logueado → prefilleamos con los datos del perfil (editables). Nombre y email
  // salen de la cuenta Clerk; empresa y teléfono, de "Mi cuenta → Datos de
  // empresa" (unsafeMetadata). Con fallbacks por si falta el campo "primary".
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const [info, setInfo] = useState<CheckoutInfo>({
    nombre: fullName || md.contacto || "",
    empresa: md.empresa ?? "",
    email:
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      "",
    telefono: md.telefono ?? user?.primaryPhoneNumber?.phoneNumber ?? "",
    cuit: md.cuit ?? "",
    direccion: "",
    cp: "",
    // Default a Batu Zona 1 (CABA, la más barata) en vez de caer a Andreani AMBA
    // ($23k). El cliente del interior cambia a "Al interior / uso CP".
    batuZone: 1,
    notas: "",
  });

  // Config de envíos (Sanity, editable por Marce). Default hardcodeado +
  // refresh async, para que el total del checkout coincida con lo que cobra el
  // server (que lee la misma config).
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

  const t = totalsFor(items, wholesale, info.cp, info.batuZone, shipCfg);
  // Tope minorista por carrito: pasado el monto no se puede pagar. El aviso con
  // el motivo lo pone <RetailCapNotice/> arriba del resumen; el servidor lo
  // vuelve a chequear en /api/orders, nunca confía en esto.
  const capped = !wholesale && retailCartExceeded(t.net);
  // Cliente final "al interior / otro" (sin zona Batu) NECESITA un CP válido:
  // sin banda no hay tarifa que cobrar. El servidor lo vuelve a chequear en
  // /api/orders (error "invalid_cp"), nunca confía en esto.
  const cpMissing = !wholesale && !info.batuZone && !isValidCp(info.cp);
  const set = (k: keyof CheckoutInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInfo((s) => ({ ...s, [k]: e.target.value }));

  // Compra simulada (testing del funnel completo). Gated por flag público.
  // Solo se puede COMPRAR estando logueado (cada compra queda atada a un usuario).
  const router = useRouter();
  // Los MAYORISTAS no pagan online: su flujo cierra siempre por WhatsApp
  // (definición de Marce, call jul-2026). El admin conserva los botones para testear.
  const wholesaleOnlyWA = role === "wholesale";
  const simEnabled = process.env.NEXT_PUBLIC_CHECKOUT_SIM === "1" && !wholesaleOnlyWA;
  const naveEnabled = process.env.NEXT_PUBLIC_NAVE_ENABLED === "1" && !wholesaleOnlyWA;
  const onlinePayEnabled = simEnabled || naveEnabled;
  const isLoggedIn = !!user;
  const { redirectToSignIn } = useClerk();
  // Si no hay sesión, manda a loguearse y vuelve al checkout. Devuelve true si
  // redirigió (el caller debe cortar el flujo).
  const requireLogin = (): boolean => {
    if (isLoggedIn) return false;
    redirectToSignIn({ signInForceRedirectUrl: "/checkout" });
    return true;
  };
  const [payingNave, setPayingNave] = useState(false);
  const [naveError, setNaveError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Payload del pedido: SOLO qué se pidió. El server recalcula precios/totales.
  const buildPayload = () => ({
    customerName: info.nombre,
    customerEmail: info.email,
    customerCompany: info.empresa,
    customerPhone: info.telefono,
    customerTaxId: info.cuit,
    customerAddress: info.direccion,
    items: items.map((i) => ({
      sku: i.sku,
      slug: i.id,
      kind: i.kind,
      qty: i.qty,
      name: i.name,
      deco: i.deco,
      presentationSku: i.presentationSku,
      variant: i.variant,
    })),
    // Normalizado a 4 dígitos cuando es válido (ej. "5.515" → "5515"), para que
    // lo que se guarda en el pedido sea siempre el mismo formato que usó el
    // cálculo de envío. Si no es válido se manda tal cual: el server lo vuelve
    // a validar y, para cliente final sin zona Batu, rechaza el pedido.
    cp: normalizeCp(info.cp) ?? info.cp,
    batuZone: info.batuZone ?? undefined,
    notes: info.notas,
    origin: "web" as const,
  });

  // "Comprar ahora": crea el pedido (await) y redirige a la pantalla de pago
  // simulada, que hace de stand-in de la pasarela externa (futuro Nave).
  const buyNow = async () => {
    if (requireLogin()) return;
    const invalid = validateCheckout(info, wholesale);
    if (invalid) {
      setBuyError(invalid);
      return;
    }
    setBuyError(null);
    setBuying(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 400 && data?.error === "presentation_wholesale_only") {
        setBuyError(String(data.message ?? "Esa presentación es solo para clientes mayoristas."));
        setBuying(false);
        return;
      }
      if (res.status === 400 && data?.error === "invalid_cp") {
        setBuyError(
          String(
            data.message ??
              "Ingresá un código postal válido de 4 dígitos (ej. 5515) para calcular el envío.",
          ),
        );
        setBuying(false);
        return;
      }
      if (!res.ok || !data?.ok || !data.id) {
        setBuyError("No pudimos generar el pedido. Probá de nuevo o cerralo por WhatsApp.");
        setBuying(false);
        return;
      }
      const q = new URLSearchParams({
        order: data.id,
        n: data.orderNumber ?? "",
        total: String(Math.round(t.total)),
      });
      router.push(`/checkout/pago?${q.toString()}`);
    } catch {
      setBuyError("Hubo un problema de conexión. Probá de nuevo o cerralo por WhatsApp.");
      setBuying(false);
    }
  };

  // "Pagar con Nave": crea el pedido (await), abre el checkout de Nave en una
  // PESTAÑA NUEVA y lleva esta pestaña a /checkout/gracias?via=nave, que
  // concilia por polling (/api/nave/status). Así la confirmación NO depende de
  // que la página de Nave redirija (el flujo QR pagado desde el teléfono deja
  // la página de Nave clavada — visto en producción 22-jul).
  const payWithNave = async () => {
    if (requireLogin()) return;
    const invalid = validateCheckout(info, wholesale);
    if (invalid) {
      setNaveError(invalid);
      return;
    }
    setNaveError(null);
    setPayingNave(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 400 && data?.error === "presentation_wholesale_only") {
        setNaveError(String(data.message ?? "Esa presentación es solo para clientes mayoristas."));
        setPayingNave(false);
        return;
      }
      if (res.status === 400 && data?.error === "invalid_cp") {
        setNaveError(
          String(
            data.message ??
              "Ingresá un código postal válido de 4 dígitos (ej. 5515) para calcular el envío.",
          ),
        );
        setPayingNave(false);
        return;
      }
      if (res.status === 409 && data?.error === "out_of_stock") {
        const skus = Array.isArray(data.skus) ? data.skus.join(", ") : "";
        setNaveError(`Hay productos sin stock${skus ? `: ${skus}` : ""}. Quitalos del carrito para continuar.`);
        setPayingNave(false);
        return;
      }
      if (!res.ok || !data?.ok || !data.id) {
        setNaveError("No pudimos generar el pedido. Probá de nuevo o cerralo por WhatsApp.");
        setPayingNave(false);
        return;
      }
      const navRes = await fetch("/api/nave/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.id }),
      });
      const navData = await navRes.json().catch(() => null);
      if (!navRes.ok || !navData?.ok || !navData.checkoutUrl) {
        setNaveError("No pudimos iniciar el pago. Probá de nuevo o cerralo por WhatsApp.");
        setPayingNave(false);
        return;
      }
      const checkoutUrl = navData.checkoutUrl as string;
      // UN SOLO TAB: redirigimos ESTA pestaña a Nave. Al terminar, Nave vuelve
      // solo por su callback_url a /checkout/gracias?via=nave (lo setea
      // /api/nave/checkout), que concilia por polling; y el webhook confirma
      // server-side aunque el retorno falle (caso QR desde el celu). Redirigir
      // la misma pestaña no lo frena ningún bloqueador de popups.
      window.location.assign(checkoutUrl);
    } catch {
      setNaveError("Hubo un problema de conexión. Probá de nuevo o cerralo por WhatsApp.");
      setPayingNave(false);
    }
  };

  // Persistimos el pedido en Sanity vía /api/orders ANTES de abrir WhatsApp.
  // Importante: NO bloqueamos el handoff a WhatsApp — el <a> hace su navegación
  // nativa (target=_blank) igual; si la creación falla, solo logueamos.
  const persistOrder = () => {
    // SEGURIDAD: NO mandamos precios ni totales. El server los recalcula desde
    // Sanity y deriva el rol mayorista de la sesión. Solo enviamos qué se pidió.
    const orderItems = items.map((i) => ({
      sku: i.sku,
      slug: i.id, // el carrito usa el slug como id; sirve para combos
      kind: i.kind, // "combo" | undefined
      qty: i.qty,
      name: i.name, // fallback de display si el server no lo encuentra
      deco: i.deco,
      presentationSku: i.presentationSku, // reprecio server-side por presentación
      variant: i.variant,
    }));
    const payload = {
      customerName: info.nombre,
      customerEmail: info.email,
      customerCompany: info.empresa,
      customerPhone: info.telefono,
    customerTaxId: info.cuit,
    customerAddress: info.direccion,
      items: orderItems,
      cp: normalizeCp(info.cp) ?? info.cp,
      batuZone: info.batuZone ?? undefined,
      notes: info.notas,
      // Este pedido nace del botón "Prefiero coordinar por WhatsApp", NO del
      // checkout online. Marcarlo como "web" hacía que en el panel (y en la
      // columna Origen de Monday) fuera indistinguible de un pago abandonado:
      // Marce veía un montón de pedidos "no pagados" que en realidad se estaban
      // cerrando por WhatsApp. Ver el schema `order` → campo `origin`.
      origin: "whatsapp" as const,
    };
    // fire-and-forget: no await, no preventDefault. Errores solo a consola.
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // que sobreviva a la navegación a WhatsApp
    }).catch((err) => console.error("[checkout] no se pudo persistir el pedido:", err));
  };

  if (items.length === 0) {
    return (
      <div className="wrap" style={{ padding: "80px 24px", textAlign: "center" }}>
        <h1 className="h-lg">No tenés un pedido en curso</h1>
        <Link className="btn btn-primary btn-lg" style={{ marginTop: "20px" }} href="/productos">
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      {/* Wizard */}
      <div className="chips" style={{ marginBottom: "28px" }}>
        <Link className="chip" href="/carrito">1 · Carrito</Link>
        <span className="chip on">2 · Tus datos</span>
        <span className="chip">3 · {onlinePayEnabled ? "Pago" : "Confirmar por WhatsApp"}</span>
      </div>

      <RetailCapNotice netProducts={t.net} wholesale={wholesale} />

      <h1 className="h-lg">Revisá y confirmá tu pedido</h1>

      <div className="cart-layout">
        {/* DATOS */}
        <div className="card" style={{ padding: "24px", height: "fit-content" }}>
          <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "4px" }}>
            Tus datos
          </h3>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
            {naveEnabled
              ? "Pagá online con Nave o coordiná el cierre por WhatsApp. El envío se confirma al cerrar."
              : simEnabled
                ? "Comprá online (pago de prueba) o coordiná el cierre por WhatsApp. El envío se confirma al cerrar."
                : "Coordinamos el cierre, el pago y el envío por WhatsApp. No se cobra nada online."}
          </p>
          <div style={{ display: "grid", gap: "14px" }}>
            <In label="Nombre" value={info.nombre} onChange={set("nombre")} required />
                    <In label="Empresa / Razón social" value={info.empresa} onChange={set("empresa")} />
            <In label="CUIT o DNI (para la factura)" value={info.cuit} onChange={set("cuit")} required />
            <In label="Email" value={info.email} onChange={set("email")} required type="email" />
            <In label="Teléfono" value={info.telefono} onChange={set("telefono")} required type="tel" />
                    <In label="Dirección de entrega" value={info.direccion} onChange={set("direccion")} required />
            <div style={{ display: "grid", gap: "6px" }}>
              <In
                label={
                  info.batuZone
                    ? "Código postal (para estimar envío)"
                    : "Código postal (obligatorio para calcular el envío)"
                }
                value={info.cp}
                onChange={set("cp")}
              />
              {cpMissing && (
                <p style={{ margin: 0, fontSize: "12px", color: "var(--danger, #c0392b)" }}>
                  Ingresá un código postal válido de 4 dígitos (ej. 5515) para calcular el
                  envío.
                </p>
              )}
            </div>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
                Zona de envío (si es CABA/GBA — envío propio)
              </span>
              <select
                value={info.batuZone ?? ""}
                onChange={(e) =>
                  setInfo((s) => ({
                    ...s,
                    batuZone: e.target.value ? (Number(e.target.value) as BatuZone) : null,
                  }))
                }
                style={{
                  width: "100%",
                  minWidth: 0,
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
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
                Notas (opcional)
              </span>
              <textarea
                value={info.notas}
                onChange={set("notas")}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--r-sm)",
                  fontSize: "14px",
                  resize: "vertical",
                }}
              />
            </label>
          </div>
        </div>

        {/* RESUMEN — .summary colapsa a static en mobile (ds.css @860px) */}
        <aside
          className="summary"
          style={{
            padding: "24px",
            background: "var(--bg-2)",
            height: "fit-content",
          }}
        >
          <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "12px" }}>
            Tu pedido
          </h3>
          <div style={{ display: "grid", gap: "8px", fontSize: "14px" }}>
            {items.map((i) => (
              <div key={lineKey(i)} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "var(--muted)" }}>
                  {i.qty}× {i.name}
                </span>
                <strong>{money(unitPrice(i, wholesale) * i.qty * (wholesale ? 1 : 1.21))}</strong>
              </div>
            ))}
          </div>
          <div style={{ height: "1px", background: "var(--line)", margin: "14px 0" }} />
          <TotalsRows t={t} money={money} />
          <OrderNotices
            finalConsumer={t.finalConsumer}
            shippingQuote={t.shippingQuote}
            shippingReason={t.shippingReason}
          />

          {naveEnabled && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: "20px" }}
                onClick={payWithNave}
                disabled={payingNave || capped || cpMissing}
              >
                {capped
                  ? "Supera el máximo minorista"
                  : cpMissing
                    ? "Ingresá tu código postal"
                    : payingNave
                      ? "Redirigiendo al pago…"
                      : "Pagar con Nave"}
              </button>
              {naveError && (
                <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--danger, #c0392b)" }}>
                  {naveError}
                </p>
              )}
            </>
          )}
          {!naveEnabled && simEnabled && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: "20px" }}
                onClick={buyNow}
                disabled={buying || capped || cpMissing}
              >
                {capped
                  ? "Supera el máximo minorista"
                  : cpMissing
                    ? "Ingresá tu código postal"
                    : buying
                      ? "Generando pedido…"
                      : "Comprar ahora"}
              </button>
              {buyError && (
                <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--danger, #c0392b)" }}>
                  {buyError}
                </p>
              )}
            </>
          )}
          <a
            className={`btn btn-wa ${onlinePayEnabled ? "" : "btn-lg"} btn-block`}
            style={{
              marginTop: onlinePayEnabled ? "10px" : "20px",
              // Este link SÍ crea un pedido (persistOrder, con el envío ya
              // calculado): sin CP válido no hay tarifa que cobrarle, así que
              // se deshabilita igual que los botones de pago online.
              ...(cpMissing ? { opacity: 0.5, pointerEvents: "none", cursor: "not-allowed" } : {}),
            }}
            href={waCheckoutURL(items, wholesale, info, shipCfg)}
            target="_blank"
            rel="noopener"
            aria-disabled={cpMissing}
            tabIndex={cpMissing ? -1 : undefined}
            onClick={(e) => {
              if (cpMissing) {
                e.preventDefault();
                return;
              }
              persistOrder();
            }}
          >
            {cpMissing
              ? "Ingresá tu código postal"
              : onlinePayEnabled
                ? "Prefiero coordinar por WhatsApp"
                : "Confirmar pedido por WhatsApp"}
          </a>
          <Link
            className="btn btn-ghost btn-block"
            style={{ marginTop: "10px" }}
            href="/carrito"
          >
            ← Volver al carrito
          </Link>
        </aside>
      </div>
    </div>
  );
}

/** Valida los datos obligatorios del checkout antes de crear un pedido/pago. */
function validateCheckout(info: CheckoutInfo, wholesale: boolean): string | null {
  if (!info.nombre?.trim()) return "Completá tu nombre para continuar.";
  const email = (info.email ?? "").trim();
  if (!email) return "Completá tu email para continuar.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Revisá el email: no parece válido.";
  if (!info.telefono?.trim()) return "Completá tu teléfono para continuar.";
  // Pedido de Marce (10-sep-2026): los pedidos llegaban sin datos para facturar
  // ni dirección para despachar, y había que perseguir al cliente por WhatsApp.
  if (!info.cuit?.trim()) return "Completá tu CUIT o DNI: lo necesitamos para facturar.";
  if (!info.direccion?.trim()) return "Completá la dirección de entrega para continuar.";
  // Cliente final "al interior / otro" (sin zona Batu): sin CP válido no hay
  // banda de tarifa que cobrar (caso Maipú, Mendoza: CP "5.515" mal tipeado se
  // cobró en silencio como AMBA). Mayorista y quienes eligieron zona Batu no
  // necesitan CP acá.
  if (!wholesale && !info.batuZone && !isValidCp(info.cp)) {
    return "Ingresá un código postal válido de 4 dígitos (ej. 5515) para calcular el envío.";
  }
  return null;
}

function In({
  label,
  value,
  onChange,
  required,
  type,
}: {
  label: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>
        {label}
        {required ? <span style={{ color: "var(--amber-deep)" }}> *</span> : null}
      </span>
      <input
        value={value}
        onChange={onChange}
        type={type ?? "text"}
        required={required}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--r-sm)",
          fontSize: "14px",
        }}
      />
    </label>
  );
}

