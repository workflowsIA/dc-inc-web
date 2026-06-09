"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  qty: number;
  deco?: boolean;
}

interface CartState {
  items: CartItem[];
  add: (id: string, qty?: number, deco?: boolean) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (id, qty = 1, deco = false) =>
        set((s) => {
          const ex = s.items.find((i) => i.id === id);
          if (ex) {
            return {
              items: s.items.map((i) =>
                i.id === id ? { ...i, qty: i.qty + qty, deco: deco || i.deco } : i,
              ),
            };
          }
          return { items: [...s.items, { id, qty, deco }] };
        }),
      setQty: (id, qty) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "dc_cart_v1" },
  ),
);
