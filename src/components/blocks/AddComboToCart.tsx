"use client";
import { useState } from "react";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";

/**
 * Snapshot mínimo de un combo para el carrito.
 *
 * DECISIÓN (no trivial): el carrito está modelado sobre productos (CartItem),
 * que asume venta por bulto cerrado (`bulto`, `pallet`, precio público/mayorista).
 * Un combo no tiene esa estructura: se vende como UNA unidad armada a un precio
 * único (`pricePublicFrom`). Para no tocar el store de productos lo mapeamos al
 * mismo shape de la forma más simple posible:
 *   - id prefijado con "combo:" para no colisionar con slugs de producto.
 *   - bulto = 1  → cada "+" suma 1 combo (no múltiplos de bulto).
 *   - pub = may = price → mismo precio para cliente final y mayorista (el combo
 *     ya viene con su precio cerrado; no hay lista mayorista separada).
 *   - pallet 0, sin deco.
 */
export interface ComboSnapshot {
  slug: string;
  name: string;
  price: number;
}

function toCartSnapshot(combo: ComboSnapshot): ProductSnapshot {
  return {
    id: `combo:${combo.slug}`,
    name: combo.name,
    sku: `combo:${combo.slug}`,
    pub: combo.price,
    may: combo.price,
    bulto: 1,
    pallet: 0,
  };
}

/** Botón "Agregar al carrito" para la ficha de combo. */
export function AddComboToCart({ combo }: { combo: ComboSnapshot }) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary btn-lg"
      onClick={() => {
        add(toCartSnapshot(combo), 1);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      {added ? "✓ Agregado al carrito" : "Agregar al carrito"}
    </button>
  );
}
