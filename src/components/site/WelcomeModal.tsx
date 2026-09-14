"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import type { WelcomeModalData } from "@/lib/sanity-data";

const COOKIE = "dc_welcome";

/** Rutas donde el cartel no aparece nunca: el que ya está comprando o
 *  gestionando su cuenta no necesita que le expliquen mayorista vs minorista. */
const RUTAS_EXCLUIDAS = ["/admin", "/checkout", "/carrito", "/cuenta", "/mi-cuenta"];

function yaLoVio(): boolean {
  try {
    return document.cookie.split("; ").some((c) => c.startsWith(COOKIE + "="));
  } catch {
    // Cookies bloqueadas (modo incógnito estricto, algún navegador con todo
    // apagado): preferimos no mostrarlo a mostrarlo en loop en cada página.
    return true;
  }
}

function marcarVisto(dias: number) {
  try {
    const maxAge = Math.max(1, Math.round(dias)) * 24 * 60 * 60;
    document.cookie = `${COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    /* si no se puede escribir, el cartel vuelve a aparecer. No rompe nada. */
  }
}

/**
 * Cartel de bienvenida mayorista / minorista.
 *
 * Es informativo: no bloquea el catálogo, no guarda qué eligió el visitante y
 * NO habilita precios mayoristas — el botón "Por mayor" solo lleva a crear la
 * cuenta y la aprobación sigue siendo manual. El precio lo decide el rol del
 * usuario logueado, nunca este cartel.
 *
 * Aparece una sola vez por visitante (cookie `dc_welcome`, con la duración que
 * Marce configura en el Studio) y nunca a alguien ya logueado.
 */
export default function WelcomeModal({ data }: { data: WelcomeModalData }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const { isLoaded, isSignedIn } = useAuth();
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const excluida = RUTAS_EXCLUIDAS.some((r) => pathname.startsWith(r));

  const cerrar = useCallback(() => {
    marcarVisto(data.frequencyDays);
    setOpen(false);
  }, [data.frequencyDays]);

  // Esperamos a que Clerk resuelva la sesión: si abrimos antes, el mayorista
  // logueado ve el cartel un segundo y después desaparece, que es peor que no
  // mostrarlo.
  useEffect(() => {
    if (!isLoaded || isSignedIn || excluida) return;
    if (yaLoVio()) return;
    const t = window.setTimeout(
      () => setOpen(true),
      Math.max(0, data.delaySeconds) * 1000,
    );
    return () => window.clearTimeout(t);
  }, [isLoaded, isSignedIn, excluida, data.delaySeconds]);

  // Escape para cerrar + bloqueo del scroll de fondo mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    cerrarRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
    };
  }, [open, cerrar]);

  if (!open) return null;

  return (
    <div
      className="wmodal-backdrop"
      onClick={cerrar}
      role="presentation"
    >
      <div
        className="wmodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wmodal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={cerrarRef}
          type="button"
          className="wmodal-x"
          onClick={cerrar}
          aria-label="Cerrar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <span className="eyebrow">Bienvenido a DC Inc</span>
        <h2 id="wmodal-title" className="h-md wmodal-title">
          {data.title}
        </h2>
        {data.subtitle ? <p className="wmodal-sub">{data.subtitle}</p> : null}

        <div className="wmodal-opts">
          {data.options.map((o) => (
            <Link
              key={o.href + o.label}
              href={o.href}
              onClick={cerrar}
              className={"wmodal-opt" + (o.highlight ? " wmodal-opt-hi" : "")}
            >
              <span className="wmodal-opt-label">
                {o.label}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {o.description ? (
                <span className="wmodal-opt-desc">{o.description}</span>
              ) : null}
            </Link>
          ))}
        </div>

        <button type="button" className="wmodal-dismiss" onClick={cerrar}>
          {data.dismissLabel}
        </button>
      </div>
    </div>
  );
}
