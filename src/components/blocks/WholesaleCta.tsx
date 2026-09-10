"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ars } from "@/lib/format";
import { RETAIL_CART_MAX, retailCartExceeded } from "@/lib/pricing";

/**
 * Invitación al alta mayorista que ve el cliente final (minorista logueado o
 * visitante) cuando elige una presentación que supera el tope de compra
 * minorista. Decisión de Fede (26-ago-2026): los precios de Caja/Pallet se
 * MUESTRAN igual que al mayorista (neto + IVA) para que el cliente vea el
 * ahorro, pero no se pueden agregar al carrito; el botón lo lleva a pedir el
 * alta (logueado → sus datos de empresa; anónimo → registro).
 */
/**
 * Aviso BLOQUEANTE en carrito y checkout (decisión Fede, 9-sep-2026): el tope
 * pasó a ser por CARRITO y, pasado el monto, el pedido no se puede confirmar —
 * antes solo se avisaba y se dejaba seguir. Los botones de continuar y de pagar
 * se deshabilitan aparte, en cada página; acá vive el mensaje.
 * `netProducts` = subtotal neto de productos (con el descuento por volumen ya
 * aplicado, sin envío).
 */
export function RetailCapNotice({ netProducts, wholesale }: { netProducts: number; wholesale: boolean }) {
  const { isSignedIn } = useUser();
  if (wholesale || !retailCartExceeded(netProducts)) return null;
  const href = isSignedIn ? "/mi-cuenta" : "/cuenta?tab=registro";
  return (
    <div
      role="note"
      style={{
        padding: "12px 16px",
        background: "var(--amber-soft)",
        borderRadius: "var(--r)",
        fontSize: "13px",
        color: "var(--ink)",
        marginBottom: "16px",
      }}
    >
      <strong>
        Tu pedido supera los {ars(RETAIL_CART_MAX)} (IVA incl.), que es el máximo de
        compra minorista.
      </strong>{" "}
      <span style={{ color: "var(--muted)" }}>
        Para llevar esta cantidad necesitás una cuenta mayorista: la aprobamos en 1 día
        hábil y accedés a mejores precios por caja y pallet. Mientras tanto podés sacar
        artículos del carrito, o pedirnos el pedido por WhatsApp.
      </span>{" "}
      <Link href={href} prefetch={false} style={{ fontWeight: 700, color: "var(--ink)" }}>
        {isSignedIn ? "Solicitar alta mayorista →" : "Registrarme como mayorista →"}
      </Link>
    </div>
  );
}

export default function WholesaleCta({
  compact = false,
  onClick,
}: {
  compact?: boolean;
  /** para frenar la navegación de la card (Link envolvente) */
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { isSignedIn } = useUser();
  const href = isSignedIn ? "/mi-cuenta" : "/cuenta?tab=registro";
  const label = isSignedIn ? "Solicitar alta mayorista" : "Registrarme como mayorista";

  if (compact) {
    return (
      <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted)" }}>
        Precio mayorista ·{" "}
        <Link href={href} prefetch={false} onClick={onClick} style={{ fontWeight: 700, color: "var(--ink)" }}>
          {label} →
        </Link>
      </p>
    );
  }

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "14px 16px",
        background: "var(--amber-soft)",
        borderRadius: "var(--r)",
        fontSize: "13px",
        color: "var(--ink)",
      }}
    >
      <strong>Esta presentación es para clientes mayoristas.</strong>
      <p style={{ marginTop: "4px", color: "var(--muted)" }}>
        Como cliente final podés comprar hasta {ars(RETAIL_CART_MAX)} IVA incluido por
        pedido. Si comprás por volumen, pedí tu
        alta mayorista: la aprobamos en 1 día hábil y accedés a estos precios.
      </p>
      <Link href={href} prefetch={false} className="btn btn-primary btn-sm" style={{ marginTop: "10px" }}>
        {label}
      </Link>
    </div>
  );
}
