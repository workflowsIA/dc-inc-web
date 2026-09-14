"use client";
import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

/**
 * Envoltorio de los filtros del catálogo.
 *
 * En desktop es transparente: el botón no se muestra y el contenido queda
 * siempre visible (ver .filters-toggle / .filters-body en ds.css). En el celular
 * arranca cerrado, porque la lista de subtipos son ~25 checkboxes que empujaban
 * la grilla dos pantallas para abajo y hacían parecer que no había productos
 * (reporte de Marce, 14-sep-2026).
 *
 * El estado inicial es el mismo en servidor y en cliente (cerrado), así que no
 * hay desajuste de hidratación: quien decide si se ve o no es el CSS.
 */
export default function FiltersPanel({
  activeCount = 0,
  children,
}: {
  /** Filtros aplicados, para mostrarlos en el botón cuando está cerrado. */
  activeCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="filters-panel" data-open={open ? "1" : "0"}>
      <button
        type="button"
        className="filters-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal />
        <span>Filtros</span>
        {activeCount > 0 && <span className="filters-count">{activeCount}</span>}
        <ChevronDown className="filters-chev" />
      </button>
      <div className="filters-body">{children}</div>
    </div>
  );
}
