"use client";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";

/** Botón ícono para las cards del catálogo (.pcard-add). */
export function AddToCartIcon({
  product,
  disabled = false,
}: {
  product: ProductSnapshot;
  /** true mientras faltan los precios mayoristas (ver CardFoot) */
  disabled?: boolean;
}) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className="pcard-add"
      disabled={disabled}
      aria-label={`Agregar ${product.name} al carrito`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Venta por bulto cerrado: el "+" agrega 1 bulto (= product.bulto unidades).
        const step = product.bulto > 0 ? product.bulto : 1;
        add(product, step);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? <Check /> : <Plus />}
    </button>
  );
}

/** Selector de cantidad + botón para la ficha de producto.
 *  Venta por bulto cerrado: `qty` cuenta BULTOS; al agregar se manda
 *  qty × bulto unidades al carrito. */
export function AddToCartBox({
  product,
  disabled = false,
}: {
  product: ProductSnapshot;
  disabled?: boolean;
}) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const step = product.bulto > 0 ? product.bulto : 1;
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
          aria-label={step > 1 ? "Cantidad de bultos" : "Cantidad"}
        />
        <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Más">
          +
        </button>
      </span>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={disabled}
        onClick={() => {
          add(product, qty * step);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
      >
        {added ? "✓ Agregado al carrito" : "Agregar al carrito"}
      </button>
    </div>
  );
}
