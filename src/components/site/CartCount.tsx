"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-store";

/** Client-only cart counter — avoids SSR hydration mismatch. */
export default function CartCount() {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  // Patrón de hidratación de Next: el conteo real recién se muestra tras montar
  // en cliente, para evitar mismatch con el HTML del servidor.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const count = mounted ? items.reduce((s, i) => s + i.qty, 0) : 0;
  return <span className="cart-count">{count}</span>;
}
