"use client";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";

/** Botón ícono para las cards del catálogo (.pcard-add). */
export function AddToCartIcon({ product }: { product: ProductSnapshot }) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className="pcard-add"
      aria-label={`Agregar ${product.name} al carrito`}
      onClick={() => {
        add(product, 1);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? <Check /> : <Plus />}
    </button>
  );
}

/** Selector de cantidad + botón para la ficha de producto. */
export function AddToCartBox({ product }: { product: ProductSnapshot }) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
      <span className="qty">
        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">
          −
        </button>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1")))}
          aria-label="Cantidad"
        />
        <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Más">
          +
        </button>
      </span>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={() => {
          add(product, qty);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
      >
        {added ? "✓ Agregado al carrito" : "Agregar al carrito"}
      </button>
    </div>
  );
}
