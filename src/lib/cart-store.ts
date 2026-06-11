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
  qty: number;
  deco?: boolean;
}

export type ProductSnapshot = Omit<CartItem, "qty" | "deco">;

interface CartState {
  items: CartItem[];
  add: (snapshot: ProductSnapshot, qty?: number, deco?: boolean) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (snapshot, qty = 1, deco = false) =>
        set((s) => {
          const ex = s.items.find((i) => i.id === snapshot.id);
          if (ex) {
            return {
              items: s.items.map((i) =>
                i.id === snapshot.id
                  ? { ...i, ...snapshot, qty: i.qty + qty, deco: deco || i.deco }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...snapshot, qty, deco }] };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "dc_cart_v2" },
  ),
);
