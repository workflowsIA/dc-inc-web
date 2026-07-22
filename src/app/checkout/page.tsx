"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useCart } from "@/lib/cart-store";

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
import { ars } from "@/lib/format";
import { totalsFor, unitPrice, waCheckoutURL, type CheckoutInfo } from "@/lib/whatsapp";
import { BATU_ZONE_OPTIONS, type BatuZone } from "@/lib/shipping";

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
  const items = useCart((s) => s.items);
  const role = user?.publicMetadata?.role as string | undefined;
  const wholesale = role === "wholesale" || role === "admin";
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
    cp: "",
    batuZone: null,
    notas: "",
  });

  const t = totalsFor(items, wholesale, info.cp, info.batuZone);
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
    items: items.map((i) => ({
      sku: i.sku,
      slug: i.id,
      kind: i.kind,
      qty: i.qty,
      name: i.name,
      deco: i.deco,
      presentationSku: i.presentationSku,
    })),
    cp: info.cp,
    batuZone: info.batuZone ?? undefined,
    notes: info.notas,
    origin: "web" as const,
  });

  // "Comprar ahora": crea el pedido (await) y redirige a la pantalla de pago
  // simulada, que hace de stand-in de la pasarela externa (futuro Nave).
  const buyNow = async () => {
    if (requireLogin()) return;
    setBuyError(null);
    setBuying(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => null);
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
    setNaveError(null);
    setPayingNave(true);
    // Abrimos la pestaña YA (gesto del usuario) para que el popup blocker no
    // la mate; le seteamos la URL cuando el server nos la da.
    const naveTab = typeof window !== "undefined" ? window.open("", "_blank") : null;
    const closeTab = () => {
      try {
        naveTab?.close();
      } catch {
        /* noop */
      }
    };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.error === "out_of_stock") {
        const skus = Array.isArray(data.skus) ? data.skus.join(", ") : "";
        setNaveError(`Hay productos sin stock${skus ? `: ${skus}` : ""}. Quitalos del carrito para continuar.`);
        setPayingNave(false);
        closeTab();
        return;
      }
      if (!res.ok || !data?.ok || !data.id) {
        setNaveError("No pudimos generar el pedido. Probá de nuevo o cerralo por WhatsApp.");
        setPayingNave(false);
        closeTab();
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
        closeTab();
        return;
      }
      const checkoutUrl = navData.checkoutUrl as string;
      const orderNumber = (data.orderNumber as string | undefined) ?? "";
      if (naveTab && !naveTab.closed) {
        // Pestaña nueva → Nave; esta pestaña → "Confirmando tu pago…" (polling).
        naveTab.location.href = checkoutUrl;
        // Guardamos la referencia para que /checkout/gracias pueda CERRAR la
        // pestaña de Nave cuando el pago confirme (navegación SPA: el contexto
        // JS sobrevive al router.push).
        (window as Window & { __naveTab?: Window | null }).__naveTab = naveTab;
        router.push(`/checkout/gracias?order=${encodeURIComponent(orderNumber)}&via=nave`);
      } else {
        // Popup bloqueado: caemos al flujo viejo en la misma pestaña.
        window.location.href = checkoutUrl;
      }
    } catch {
      setNaveError("Hubo un problema de conexión. Probá de nuevo o cerralo por WhatsApp.");
      setPayingNave(false);
      closeTab();
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
    }));
    const payload = {
      customerName: info.nombre,
      customerEmail: info.email,
      customerCompany: info.empresa,
      customerPhone: info.telefono,
      items: orderItems,
      cp: info.cp,
      batuZone: info.batuZone ?? undefined,
      notes: info.notas,
      origin: "web" as const,
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
            <In label="Nombre" value={info.nombre} onChange={set("nombre")} />
            <In label="Empresa" value={info.empresa} onChange={set("empresa")} />
            <In label="Email" value={info.email} onChange={set("email")} />
            <In label="Teléfono" value={info.telefono} onChange={set("telefono")} />
            <In label="Código postal (para estimar envío)" value={info.cp} onChange={set("cp")} />
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
              <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ color: "var(--muted)" }}>
                  {i.qty}× {i.name}
                </span>
                <strong>{ars(unitPrice(i, wholesale) * i.qty * (wholesale ? 1 : 1.21))}</strong>
              </div>
            ))}
          </div>
          <div style={{ height: "1px", background: "var(--line)", margin: "14px 0" }} />
          <Row label="Subtotal (neto)" value={ars(t.sub)} />
          {t.rate > 0 && <Row label={`Descuento (${t.rate * 100}%)`} value={`-${ars(t.disc)}`} muted />}
          <Row label="IVA 21%" value={ars(t.iva)} muted />
          {t.finalConsumer ? (
            <Row label="Envío estimado" value={ars(t.shipping)} muted />
          ) : (
            <Row label="Envío" value="a cotizar" muted />
          )}
          <Row label="Total estimado" value={ars(t.total)} strong />

          {naveEnabled && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                style={{ marginTop: "20px" }}
                onClick={payWithNave}
                disabled={payingNave}
              >
                {payingNave ? "Redirigiendo al pago…" : "Pagar con Nave"}
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
                disabled={buying}
              >
                {buying ? "Generando pedido…" : "Comprar ahora"}
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
            style={{ marginTop: onlinePayEnabled ? "10px" : "20px" }}
            href={waCheckoutURL(items, wholesale, info)}
            target="_blank"
            rel="noopener"
            onClick={persistOrder}
          >
            {onlinePayEnabled ? "Prefiero coordinar por WhatsApp" : "Confirmar pedido por WhatsApp"}
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

function In({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--muted)" }}>{label}</span>
      <input
        value={value}
        onChange={onChange}
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

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginTop: "4px" }}>
      <span style={{ color: muted ? "var(--muted)" : undefined }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  );
}
