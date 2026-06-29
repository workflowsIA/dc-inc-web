"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ars } from "@/lib/format";

/**
 * /checkout/pago — PANTALLA DE PAGO SIMULADA (solo testing).
 *
 * Hace de stand-in de la pasarela externa (el `checkout_url` que más adelante
 * devolverá Nave). Muestra el pedido y un botón "Pagar" que confirma el cobro
 * simulado (/api/checkout/simulate-pay) y redirige al retorno /checkout/gracias,
 * tal como hará el `callback_url` de Nave en la integración real.
 */
function Pago() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("order") ?? "";
  const orderNumber = params.get("n") ?? "";
  const total = Number(params.get("total") ?? "0");

  const [state, setState] = useState<"idle" | "processing" | "error">("idle");

  const pay = async () => {
    setState("processing");
    try {
      const res = await fetch("/api/checkout/simulate-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setState("error");
        return;
      }
      // Simulamos la latencia/redirect de la pasarela y volvemos al sitio.
      setTimeout(() => {
        router.push(`/checkout/gracias?status=approved&order=${encodeURIComponent(orderNumber)}`);
      }, 800);
    } catch {
      setState("error");
    }
  };

  const cancel = () => {
    router.push(`/checkout/gracias?status=failure&order=${encodeURIComponent(orderNumber)}`);
  };

  if (!orderId) {
    return (
      <div className="wrap" style={{ padding: "80px 24px", textAlign: "center" }}>
        <h1 className="h-lg">No hay un pago en curso</h1>
        <Link className="btn btn-primary btn-lg" style={{ marginTop: 20 }} href="/carrito">
          Volver al carrito
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px", maxWidth: 520 }}>
      <div
        style={{
          padding: "28px",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          background: "var(--bg-2)",
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: "var(--amber-deep)",
          }}
        >
          Pasarela de pago · entorno de prueba
        </p>
        <h1 className="h-lg" style={{ marginTop: 8 }}>
          Confirmá tu pago
        </h1>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Esta es una pantalla de pago <strong>simulada</strong> para testear el flujo.
          No se cobra nada real.
        </p>

        <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ color: "var(--muted)" }}>Pedido</span>
          <strong>{orderNumber || "—"}</strong>
        </div>
        {total > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, marginTop: 10 }}>
            <span style={{ color: "var(--muted)" }}>Total a pagar</span>
            <strong>{ars(total)}</strong>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          style={{ marginTop: 24 }}
          onClick={pay}
          disabled={state === "processing"}
        >
          {state === "processing" ? "Procesando pago…" : "Pagar ahora (simulado)"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ marginTop: 10 }}
          onClick={cancel}
          disabled={state === "processing"}
        >
          Cancelar pago
        </button>

        {state === "error" && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger, #c0392b)" }}>
            No se pudo confirmar el pago simulado. Revisá que el flag NEXT_PUBLIC_CHECKOUT_SIM esté activo.
          </p>
        )}
      </div>
    </div>
  );
}

export default function PagoPage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: "80px 24px" }} />}>
      <Pago />
    </Suspense>
  );
}
