"use client";
import { useRouter } from "next/navigation";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";

export interface RepeatItem {
  snapshot: ProductSnapshot;
  qty: number;
  deco?: boolean;
}

/**
 * Botón "Repetir pedido": carga los items de un pedido viejo al carrito actual
 * (con los datos/precios ACTUALES del producto, resueltos en el server) y lleva
 * al carrito. Items que ya no existen en el catálogo se omiten en el server.
 */
export default function RepeatOrderButton({
  items,
  label = "Repetir pedido",
}: {
  items: RepeatItem[];
  label?: string;
}) {
  const add = useCart((s) => s.add);
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => {
        for (const it of items) add(it.snapshot, it.qty, it.deco);
        router.push("/carrito");
      }}
    >
      {label}
    </button>
  );
}
