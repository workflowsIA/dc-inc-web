/**
 * Bloque plegable del panel de filtros.
 *
 * Usa <details> nativo a propósito: arranca cerrado sin JavaScript, sin estado
 * de cliente y sin desajustes de hidratación, y el teclado y los lectores de
 * pantalla lo manejan solos. Marce pidió (14-sep-2026) que TODOS los filtros
 * arranquen plegados: con siete bloques abiertos el panel medía dos pantallas.
 *
 * Por eso la cabecera lleva el contador: con todo cerrado, es lo único que
 * cuenta qué hay adentro y qué está aplicado.
 */
export default function FilterSection({
  title,
  applied = 0,
  total,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** Cuántos filtros de este bloque están aplicados. */
  applied?: number;
  /** Cuántas opciones tiene el bloque (se muestra si no hay nada aplicado). */
  total?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="fsec" open={defaultOpen || applied > 0}>
      <summary className="fsec-sum">
        <span className="fsec-title">{title}</span>
        {applied > 0 ? (
          <span className="fsec-badge">{applied}</span>
        ) : total ? (
          <span className="fsec-total">{total}</span>
        ) : null}
        <svg className="fsec-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="fsec-body">{children}</div>
    </details>
  );
}
