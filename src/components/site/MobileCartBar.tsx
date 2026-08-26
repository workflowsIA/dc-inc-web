"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { cartItemCount, useCart } from "@/lib/cart-store";
import { ars } from "@/lib/format";
import { unitPrice } from "@/lib/whatsapp";

/** Barra de carrito sticky en mobile (bottom). El CSS (.mcart / body.has-mcart)
 *  ya existe en ds.css y solo se muestra en viewport ≤860px. */
export default function MobileCartBar() {
  const items = useCart((s) => s.items);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Mismo criterio de rol que /carrito y /checkout: si no, un mayorista veia
  // el estimado a precio publico en la barra y el neto al entrar al carrito.
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const wholesale = role === "wholesale" || role === "admin";

  const count = cartItemCount(items);
  const subtotal = items.reduce((s, i) => s + unitPrice(i, wholesale) * i.qty, 0);
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
          {count} {count === 1 ? "artículo" : "artículos"} · estimado
        </span>
        <span className="v">{ars(subtotal)}</span>
      </div>
      <Link className="btn btn-primary btn-sm" href="/carrito">
        <ShoppingCart style={{ width: 16, height: 16 }} /> Ver pedido
      </Link>
    </div>
  );
}
