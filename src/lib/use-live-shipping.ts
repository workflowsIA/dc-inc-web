"use client";
import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "./cart-store";
import {
  effectiveBatuZone,
  shippingEstimate,
  type BatuZone,
  type ShippingConfig,
  type ShippingQuote,
} from "./shipping";
import { bultosDetalle, totalBultos, unitPrice } from "./whatsapp";

/**
 * Cotización de Andreani EN VIVO para el carrito y el checkout.
 *
 * Devuelve null (→ se usa la tabla de siempre) salvo que:
 *  - el server tenga la API prendida (cfg.andreaniLive, de /api/shipping-config),
 *  - sea cliente final, al interior (sin zona Batu), modo "estimado",
 *  - y la tabla haya podido estimar (con "a cotizar" no hay nada que mejorar).
 *
 * Mientras llega la respuesta se sigue mostrando el estimado de tabla: el
 * carrito nunca queda en blanco esperando a Andreani. Si la API falla, el
 * server ya devuelve la tabla, así que el número no salta.
 */
export function useLiveShipping(
  items: CartItem[],
  wholesale: boolean,
  cp: string | undefined,
  batuZone: BatuZone | null | undefined,
  cfg: ShippingConfig,
): ShippingQuote | null {
  const request = useMemo(() => {
    if (!cfg.andreaniLive || wholesale) return null;
    if (effectiveBatuZone(cp, batuZone)) return null;
    if (cfg.andreaniMode === "cotizar") return null;
    const detalle = bultosDetalle(items);
    const bultos = totalBultos(items);
    const base = shippingEstimate({ cp, batuZone, bultos, wholesale, detalle }, cfg);
    if (base.toQuote || base.total <= 0) return null;
    // Valor de los productos con IVA = valor declarado para el seguro.
    // Misma cuenta que /api/orders (neto × 1,21, redondeado).
    const net = items.reduce((s, i) => s + unitPrice(i, false) * i.qty, 0);
    const valorProductos = Math.round(net * 1.21);
    return { cp, batuZone, detalle, bultos, valorProductos };
  }, [items, wholesale, cp, batuZone, cfg]);

  const key = request ? JSON.stringify(request) : null;
  const [live, setLive] = useState<{ key: string; quote: ShippingQuote } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    // Debounce: el CP se tipea de a un dígito y la cantidad se cambia con +/-.
    const t = setTimeout(() => {
      fetch("/api/shipping-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: key,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((q: ShippingQuote | null) => {
          if (alive && q && typeof q.total === "number") setLive({ key, quote: q });
        })
        .catch(() => {});
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key]);

  // Solo vale la respuesta del pedido ACTUAL (si cambió el carrito o el CP,
  // la vieja ya no sirve y se vuelve a la tabla hasta que llegue la nueva).
  return key && live?.key === key ? live.quote : null;
}
