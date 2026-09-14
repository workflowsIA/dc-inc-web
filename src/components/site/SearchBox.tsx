"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { matchesSearch, searchScore, searchTokens } from "@/lib/search";

export interface SearchItem {
  name: string;
  slug: string;
  cat: string;
  /** SKU (opcional en índices viejos cacheados). */
  sku?: string;
}

export default function SearchBox({
  className = "",
  compact = false,
}: {
  className?: string;
  /** Versión angosta para el header mobile: placeholder corto y dropdown a
   *  ancho de pantalla (anclado al header sticky) en vez de al ancho del pill. */
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const indexRequested = useRef(false);
  const pathname = usePathname();

  /**
   * El índice se pide una sola vez, recién cuando el usuario toca el buscador.
   * Antes viajaba como prop desde el Header, o sea que los ~305 productos se
   * serializaban en el payload RSC de TODAS las páginas (y de cada prefetch).
   */
  const loadIndex = () => {
    if (indexRequested.current) return;
    indexRequested.current = true;
    fetch("/api/search-index")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SearchItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {
        // sin índice, el form igual hace submit a /productos?q=
      });
  };

  /**
   * CIERRE DEL PANEL (fix mobile, 14-sep-2026 — reporte de Marce)
   *
   * Antes el panel se cerraba con un timer de 120 ms colgado del `blur` del
   * input, y cada resultado hacía `onMouseDown → preventDefault()` para ganarle
   * a ese blur. En una pantalla táctil eso fallaba de las dos puntas:
   *  - iOS cancela el click sintético cuando se hace preventDefault sobre el
   *    mousedown emulado, así que tocar un resultado no navegaba a ningún lado
   *    (había que apretar Enter);
   *  - y como el tap no navegaba, el panel quedaba abierto tapando la pantalla.
   *
   * Ahora no hay timers ni preventDefault: el tap llega limpio al <Link> y el
   * panel se cierra por eventos explícitos — elegir un resultado, tocar fuera,
   * Escape, mandar el formulario o cambiar de página.
   */
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // El header es persistente entre navegaciones del lado del cliente: sin esto,
  // después de entrar a un producto el panel seguía desplegado sobre la página
  // nueva. Se ajusta durante el render (patrón de React para "resetear estado
  // cuando cambia una prop") en vez de en un efecto, así no hay un frame con el
  // panel todavía abierto.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setQ("");
  }

  const close = () => setOpen(false);

  // Búsqueda por palabras (todas tienen que aparecer, en cualquier orden):
  // "botella 500" encuentra "Botella R - 500 ml". Ver src/lib/search.ts.
  const tokens = searchTokens(q);
  const qn = tokens.join(" ");
  const matches =
    qn.length >= 2
      ? items
          .filter((i) => matchesSearch(`${i.name} ${i.sku ?? ""} ${i.cat}`, tokens))
          .sort((a, b) => searchScore(b.name, tokens) - searchScore(a.name, tokens))
          .slice(0, 6)
      : [];

  return (
    <div
      ref={wrapRef}
      className={`search-wrap ${compact ? "search-compact" : ""} ${className}`}
      style={{ position: "relative" }}
      onFocus={() => {
        loadIndex();
        setOpen(true);
      }}
    >
      <form className="search" action="/productos" onSubmit={close}>
        <Search />
        <input
          name="q"
          value={q}
          placeholder={compact ? "Buscar" : "Buscar productos, categorías…"}
          aria-label="Buscar productos"
          autoComplete="off"
          onChange={(e) => {
            loadIndex();
            setQ(e.target.value);
            setOpen(true);
          }}
        />
        {q && (
          // Salida clara del buscador en mobile, donde el panel ocupa media
          // pantalla y "tocar fuera" no siempre es obvio.
          <button
            type="button"
            className="search-clear"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
          >
            <X />
          </button>
        )}
      </form>

      {open && qn.length >= 2 && (
        <div
          className="search-dd"
          style={
            compact
              ? { position: "fixed", top: "calc(var(--header-h) + 4px)", left: 12, right: 12 }
              : { position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, minWidth: "300px" }
          }
        >
          {matches.length > 0 ? (
            <>
              <div className="sdd-sec">Productos</div>
              {matches.map((m) => (
                <Link
                  key={m.slug}
                  className="sdd-row"
                  href={`/productos/${m.slug}`}
                  prefetch={false}
                  onClick={close}
                >
                  <span>{m.name}</span>
                  <b>{m.cat}</b>
                </Link>
              ))}
              <Link
                className="sdd-row"
                href={`/productos?q=${encodeURIComponent(q)}`}
                prefetch={false}
                onClick={close}
              >
                <Search />
                <span>Ver todos los resultados de “{q}”</span>
              </Link>
            </>
          ) : (
            <div className="sdd-empty">Sin resultados para “{q}”.</div>
          )}
        </div>
      )}
    </div>
  );
}
