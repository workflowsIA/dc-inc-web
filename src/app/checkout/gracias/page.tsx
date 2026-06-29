"use client";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart-store";

/**
 * /checkout/gracias — pantalla de retorno tras el pago (simulado por ahora; en
 * la integración real será el destino del callback_url de Nave). Muestra el
 * resultado según `status` y, si fue aprobado, vacía el carrito.
 */
function Gracias() {
  const params = useSearchParams();
  const status = params.get("status") ?? "approved";
  const order = params.get("order") ?? "";
  const clear = useCart((s) => s.clear);

  const approved = status === "approved";
  const pending = status === "pending" || status === "in_process";

  useEffect(() => {
    if (approved) clear();
  }, [approved, clear]);

  const title = approved
    ? "¡Gracias por tu compra!"
    : pending
      ? "Tu pago está en proceso"
      : "No se completó el pago";
  const msg = approved
    ? "Recibimos tu pago. Te vamos a contactar para coordinar el envío."
    : pending
      ? "Estamos confirmando el pago. Apenas se acredite, procesamos el pedido."
      : "El pago no se completó. Podés intentar de nuevo o coordinar por WhatsApp.";

  return (
    <div className="wrap" style={{ padding: "80px 24px", textAlign: "center", maxWidth: 560 }}>
      <h1 className="h-lg">{title}</h1>
      {order && (
        <p style={{ marginTop: 8, color: "var(--muted)" }}>
          Pedido <strong>{order}</strong>
        </p>
      )}
      <p style={{ marginTop: 16, color: "var(--muted)" }}>{msg}</p>
      <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link className="btn btn-primary btn-lg" href="/productos">
          Seguir comprando
        </Link>
        {!approved && (
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
