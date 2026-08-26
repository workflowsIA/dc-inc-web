"use client";
import { useEffect, useState } from "react";
import { cartItemCount, useCart } from "@/lib/cart-store";

/** Client-only cart counter — avoids SSR hydration mismatch. */
export default function CartCount() {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  // Patrón de hidratación de Next: el conteo real recién se muestra tras montar
  // en cliente, para evitar mismatch con el HTML del servidor.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  // Artículos distintos, no unidades ni bultos (ver cartItemCount).
  const count = mounted ? cartItemCount(items) : 0;
  if (count <= 0) return null;
  return <span className="cart-count">{count}</span>;
}
