"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart-store";

/**
 * /checkout/gracias — pantalla de retorno tras el pago.
 *
 * Con `via=nave` (callback del checkout de Nave) NO confía en el query param:
 * concilia server-side contra Nave vía POST /api/nave/status (polling cada 4s,
 * hasta ~2 min). Cuando el server confirma el pago, muestra aprobado y vacía
 * el carrito. Esto nos independiza del webhook (pendiente de alta por Nave) y
 * cubre el flujo QR, donde el cliente paga desde el teléfono.
 *
 * Sin `via=nave` mantiene el comportamiento anterior (flujo simulado/WhatsApp).
 */

const POLL_MS = 4000;
const MAX_POLLS = 75; // ~5 minutos (pagar por QR desde el banco puede tardar)

type NaveState = "checking" | "paid" | "timeout" | "error";

function Gracias() {
  const params = useSearchParams();
  const status = params.get("status") ?? "approved";
  const order = params.get("order") ?? "";
  const viaNave = params.get("via") === "nave";
  const clear = useCart((s) => s.clear);

  const [naveState, setNaveState] = useState<NaveState>("checking");
  const polls = useRef(0);

  // --- Conciliación contra Nave (solo via=nave) ---
  useEffect(() => {
    if (!viaNave || !order) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      try {
        const res = await fetch("/api/nave/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber: order }),
        });
        const data = (await res.json().catch(() => null)) as { paid?: boolean } | null;
        if (cancelled) return;
        if (data?.paid) {
          setNaveState("paid");
          clear();
          return;
        }
      } catch {
        // transitorio: seguimos intentando
      }
      if (cancelled) return;
      polls.current += 1;
      if (polls.current >= MAX_POLLS) {
        setNaveState("timeout");
        return;
      }
      timer = setTimeout(check, POLL_MS);
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [viaNave, order, clear]);

  // --- Flujo previo (simulado / WhatsApp) ---
  const approved = status === "approved";
  const pending = status === "pending" || status === "in_process";

  useEffect(() => {
    if (!viaNave && approved) clear();
  }, [viaNave, approved, clear]);

  let title: string;
  let msg: string;
  let showSpinner = false;
  let backToCart = false;

  if (viaNave) {
    if (naveState === "paid") {
      title = "¡Gracias por tu compra!";
      msg = "Confirmamos tu pago con Nave. Te vamos a contactar para coordinar el envío.";
    } else if (naveState === "checking") {
      title = "Confirmando tu pago…";
      msg = "Estamos verificando el pago con Nave. Esto puede tardar unos segundos, no cierres esta página.";
      showSpinner = true;
    } else {
      // timeout / error: no asustar — el pago puede estar acreditado igual.
      title = "Tu pago está en proceso";
      msg =
        "Todavía no nos figura confirmado. Si ya pagaste, quedate tranquilo: se acredita solo y procesamos tu pedido. Ante cualquier duda escribinos por WhatsApp.";
      backToCart = true;
    }
  } else {
    title = approved
      ? "¡Gracias por tu compra!"
      : pending
        ? "Tu pago está en proceso"
        : "No se completó el pago";
    msg = approved
      ? "Recibimos tu pago. Te vamos a contactar para coordinar el envío."
      : pending
        ? "Estamos confirmando el pago. Apenas se acredite, procesamos el pedido."
        : "El pago no se completó. Podés intentar de nuevo o coordinar por WhatsApp.";
    backToCart = !approved;
  }

  return (
    <div className="wrap" style={{ padding: "80px 24px", textAlign: "center", maxWidth: 560 }}>
      <h1 className="h-lg">{title}</h1>
      {order && (
        <p style={{ marginTop: 8, color: "var(--muted)" }}>
          Pedido <strong>{order}</strong>
        </p>
      )}
      <p style={{ marginTop: 16, color: "var(--muted)" }}>{msg}</p>
      {showSpinner && (
        <div aria-hidden style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: "3px solid var(--line)",
              borderTopColor: "var(--amber-deep)",
              borderRadius: "50%",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {viaNave && naveState === "timeout" && (
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => window.location.reload()}
          >
            Ya pagué — verificar de nuevo
          </button>
        )}
        <Link className="btn btn-primary btn-lg" href="/productos">
          Seguir comprando
        </Link>
        {backToCart && (
          <Link className="btn btn-ghost btn-lg" href="/carrito">
            Volver al carrito
          </Link>
        )}
      </div>
    </div>
  );
}

export default function GraciasPage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: "80px 24px" }} />}>
      <Gracias />
    </Suspense>
  );
}
