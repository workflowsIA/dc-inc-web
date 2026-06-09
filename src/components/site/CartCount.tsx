"use client";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-store";

/** Client-only cart counter — avoids SSR hydration mismatch. */
export default function CartCount() {
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? items.reduce((s, i) => s + i.qty, 0) : 0;
  return <span className="cart-count">{count}</span>;
}
