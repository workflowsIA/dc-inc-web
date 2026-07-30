"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

export interface SearchItem {
  name: string;
  slug: string;
  cat: string;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export default function SearchBox({ className = "" }: { className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRequested = useRef(false);

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

  const qn = norm(q.trim());
  const matches =
    qn.length >= 2
      ? items.filter((i) => norm(`${i.name} ${i.cat}`).includes(qn)).slice(0, 6)
      : [];

  return (
    <div
      className={`search-wrap ${className}`}
      style={{ position: "relative" }}
      onFocus={() => {
        if (blurTimer.current) clearTimeout(blurTimer.current);
        loadIndex();
        setOpen(true);
      }}
      onBlur={() => {
        blurTimer.current = setTimeout(() => setOpen(false), 120);
      }}
    >
      <form className="search" action="/productos">
        <Search />
        <input
          name="q"
          value={q}
          placeholder="Buscar productos, categorías…"
          autoComplete="off"
          onChange={(e) => {
            loadIndex();
            setQ(e.target.value);
            setOpen(true);
          }}
        />
      </form>

      {open && qn.length >= 2 && (
        <div
          className="search-dd"
          style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, minWidth: "300px" }}
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
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span>{m.name}</span>
                  <b>{m.cat}</b>
                </Link>
              ))}
              <Link
                className="sdd-row"
                href={`/productos?q=${encodeURIComponent(q)}`}
                prefetch={false}
                onMouseDown={(e) => e.preventDefault()}
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
