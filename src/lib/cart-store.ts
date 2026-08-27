"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Snapshot del producto que guardamos en el carrito. Guardamos los datos
 *  necesarios para renderizar y armar el mensaje de WhatsApp, así el carrito
 *  (client component) no depende de volver a buscar el producto en Sanity. */
export interface CartItem {
  id: string; // slug del producto
  name: string;
  sku: string;
  pub: number; // precio público unitario
  may: number; // precio mayorista unitario
  bulto: number;
  pallet?: number;
  imageUrl?: string;
  qty: number;
  deco?: boolean;
  /** "combo" = ítem armado a precio cerrado (no se vende por bulto).
   *  "deco" = línea de decorado (serigrafía) de otro producto del carrito:
   *  qty = piezas decoradas, pub/may = neto por pieza del tramo; o la línea de
   *  montaje y horneado (qty 1). Ver src/lib/deco.ts. */
  kind?: "combo" | "deco";
  /** deco: id (slug) del producto que decora */
  decoFor?: string;
  /** SKU de la presentación elegida (caja/pallet) para reprecio server-side.
   *  Si está, `pub`/`may` ya son el precio NETO por unidad de esa presentación. */
  presentationSku?: string;
  /** Etiqueta legible de la presentación (ej. "Caja x24"), solo display. */
  presentationLabel?: string;
  /** Color / terminación elegida como TEXTO cuando la presentación no tiene
   *  SKU propio por color (unidad o caja de una tapa corona): viaja al pedido
   *  con el SKU genérico (decisión Fede, 27-ago-2026). */
  variant?: string;
}

/**
 * Cantidad que se muestra al usuario (badge del header, barra mobile).
 *
 * Cuenta ARTÍCULOS (líneas del carrito), no unidades ni bultos: 1 caja de 36
 * botellas + 1 bolsa de tapas = "2". Pedido de Marce (ago-2026): el número
 * tiene que reflejar cuántos productos distintos eligió, no cuántas piezas.
 * El detalle de bultos/unidades se ve dentro de /carrito.
 *
 * Distinto de `totalBultos()` de whatsapp.ts, que sirve para calcular el envío.
 */
export function cartItemCount(items: CartItem[]): number {
  return items.length;
}

export type ProductSnapshot = Omit<CartItem, "qty" | "deco">;

/**
 * Identidad de una LÍNEA del carrito: producto + presentación. El mismo
 * producto por unidad y por caja (o en dos colores de paquete) son dos líneas
 * distintas — antes se mezclaban en una sola y la última presentación pisaba a
 * la anterior. `setQty` y `remove` reciben esta clave.
 */
export function lineKey(i: { id: string; presentationSku?: string; variant?: string }): string {
  const k = i.presentationSku ? `${i.id}#${i.presentationSku}` : i.id;
  return i.variant ? `${k}@${i.variant}` : k;
}

interface CartState {
  items: CartItem[];
  add: (snapshot: ProductSnapshot, qty?: number, deco?: boolean) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (snapshot, qty = 1, deco = false) =>
        set((s) => {
          const key = lineKey(snapshot);
          const ex = s.items.find((i) => lineKey(i) === key);
          if (ex) {
            return {
              items: s.items.map((i) =>
                lineKey(i) === key
                  ? { ...i, ...snapshot, qty: i.qty + qty, deco: deco || i.deco }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...snapshot, qty, deco }] };
        }),
      // Venta por bulto cerrado: la cantidad siempre es múltiplo del bulto.
      // Snappeamos al múltiplo más cercano (mínimo 1 bulto) para que nunca
      // queden unidades sueltas, sin importar de dónde venga el setQty.
      setQty: (key, qty) =>
        set((s) => ({
          items: s.items.map((i) => {
            if (lineKey(i) !== key) return i;
            const step = i.bulto > 0 ? i.bulto : 1;
            const bultos = Math.max(1, Math.round(qty / step));
            return { ...i, qty: bultos * step };
          }),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => lineKey(i) !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: "dc_cart_v2" },
  ),
);
