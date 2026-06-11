"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { ars } from "@/lib/format";

/** Barra de carrito sticky en mobile (bottom). El CSS (.mcart / body.has-mcart)
 *  ya existe en ds.css y solo se muestra en viewport ≤860px. */
export default function MobileCartBar() {
  const items = useCart((s) => s.items);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.pub * i.qty, 0);
  const hide = pathname === "/carrito";

  useEffect(() => {
    document.body.classList.toggle("has-mcart", mounted && count > 0 && !hide);
    return () => document.body.classList.remove("has-mcart");
  }, [mounted, count, hide]);

  if (!mounted || count === 0 || hide) return null;

  return (
    <div className="mcart">
      <div className="mc-total">
        <span className="mono">
          {count} {count === 1 ? "ítem" : "ítems"} · estimado
        </span>
        <span className="v">{ars(subtotal)}</span>
      </div>
      <Link className="btn btn-primary btn-sm" href="/carrito">
        <ShoppingCart style={{ width: 16, height: 16 }} /> Ver pedido
      </Link>
    </div>
  );
}
