"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";

export interface WholesaleEntry {
  may: number;
  pres?: Record<string, number>;
}

interface WholesaleCtx {
  /** true una vez que sabemos si el usuario es mayorista y (si lo es) ya llegaron los precios */
  ready: boolean;
  wholesale: boolean;
  prices: Record<string, WholesaleEntry>;
}

const EMPTY: Record<string, WholesaleEntry> = {};

const Ctx = createContext<WholesaleCtx>({
  ready: false,
  wholesale: false,
  prices: {},
});

/**
 * Trae los precios mayoristas UNA sola vez por sesión, y solo si el usuario
 * tiene el rol. Para un visitante anónimo no dispara ningún request.
 *
 * El `value` va memoizado a propósito: un objeto nuevo en cada render acá
 * arriba (el provider vive en el layout raíz) invalida el árbol del router y
 * hace que Next.js re-prefetchee todo con un token `_rsc` nuevo. Ese fue
 * exactamente uno de los bugs de costo que veníamos arrastrando.
 */
export function WholesalePricesProvider({ children }: { children: ReactNode }) {
  const { isLoaded, user } = useUser();
  const [prices, setPrices] = useState<Record<string, WholesaleEntry>>({});
  const [fetched, setFetched] = useState(false);

  const role = user?.publicMetadata?.role as string | undefined;
  const wholesale = role === "wholesale" || role === "admin";

  useEffect(() => {
    // Visitante anonimo o cliente final: no se dispara ningun request.
    if (!isLoaded || !wholesale) return;
    let cancelled = false;
    fetch("/api/precios")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, WholesaleEntry>) => {
        if (!cancelled) setPrices(data && typeof data === "object" ? data : {});
      })
      .catch(() => {
        // Sin precios mayoristas se sigue mostrando el precio publico.
      })
      .finally(() => {
        if (!cancelled) setFetched(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, wholesale]);

  // `ready` se DERIVA en vez de setearse dentro del effect: setState sincronico
  // en el cuerpo de un effect encadena renders (react-hooks/set-state-in-effect).
  const ready = isLoaded && (!wholesale || fetched);

  const value = useMemo<WholesaleCtx>(
    () => ({ ready, wholesale, prices: wholesale ? prices : EMPTY }),
    [ready, wholesale, prices],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWholesaleCtx(): WholesaleCtx {
  return useContext(Ctx);
}

/** Precio mayorista de un producto puntual (undefined si no aplica o no llego aun). */
export function useWholesaleEntry(slug: string) {
  const { ready, wholesale, prices } = useWholesaleCtx();
  return {
    ready,
    wholesale,
    entry: wholesale ? prices[slug] : undefined,
  };
}
