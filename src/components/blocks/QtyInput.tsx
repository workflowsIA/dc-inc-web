"use client";
import { useState } from "react";

/**
 * Campo de cantidad pensado para el celular.
 *
 * EL PROBLEMA QUE RESUELVE (reporte de Marce, 14-sep-2026: "faltan 72 items y
 * está en 1, no puedo borrar el 1"): los inputs de cantidad eran controlados
 * con `parseInt(e.target.value || "1")`, o sea que al borrar el contenido el
 * campo volvía a 1 al instante. Nunca se podía dejar vacío para tipear otro
 * número: quedabas peleando con un "1" pegado adelante (17, 71…) y en una
 * pantalla táctil, sin flechitas ni doble clic para seleccionar, era imposible.
 *
 * Acá el campo puede estar vacío mientras se escribe (`draft`), y el valor real
 * solo se actualiza cuando hay un número válido. Además:
 * - selecciona todo al enfocar, así tocar el campo y tipear REEMPLAZA lo que
 *   había en vez de agregar;
 * - `inputMode="numeric"` abre el teclado numérico sin los spinners de
 *   `type="number"` (que en mobile no sirven y ensucian el campo);
 * - al salir del campo, si quedó vacío o inválido, vuelve al mínimo.
 */
export default function QtyInput({
  value,
  onChange,
  min = 1,
  ariaLabel = "Cantidad",
  style,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  // null = mostrar el valor real; string = lo que está tipeando el usuario.
  const [draft, setDraft] = useState<string | null>(null);

  // Si el valor cambia (los botones − / +, o lo que acabamos de tipear), se
  // descarta el borrador. Se ajusta durante el render, no en un efecto.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(null);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      className={className}
      style={style}
      value={draft ?? String(value)}
      aria-label={ariaLabel}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        setDraft(raw);
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= min) onChange(n);
      }}
      onBlur={() => {
        const n = parseInt(draft ?? "", 10);
        if (draft !== null && (!Number.isFinite(n) || n < min)) onChange(min);
        setDraft(null);
      }}
    />
  );
}
