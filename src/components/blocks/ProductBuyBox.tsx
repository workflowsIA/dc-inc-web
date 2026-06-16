"use client";
import { useState } from "react";
import { useCart, type ProductSnapshot } from "@/lib/cart-store";
import { ars } from "@/lib/format";

interface Props {
  product: ProductSnapshot;
  unitPrice: number;
  wholesale: boolean;
  deli: string;
  presentations?: string[];
}

interface Pres {
  label: string;
  units: number;
}

/** "24 unidades en cajas" → {label, units:24}. */
function parsePres(s: string): Pres {
  const m = s.replace(/\./g, "").match(/(\d+)/);
  return { label: s, units: m ? parseInt(m[1], 10) : 1 };
}

export default function ProductBuyBox({ product, unitPrice, wholesale, deli, presentations }: Props) {
  const add = useCart((s) => s.add);
  // Ordenadas de menor a mayor (caja antes que pallet) → default = el bulto más chico.
  const presList = (presentations ?? []).map(parsePres).sort((a, b) => a.units - b.units);
  const hasPres = presList.length > 0;
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const sel = hasPres ? presList[idx] : null;
  // Venta por bulto cerrado: si no hay presentaciones explícitas, caemos al
  // bulto real del producto (product.bulto) para no permitir unidades sueltas.
  const unitsPerSel = sel ? sel.units : product.bulto > 0 ? product.bulto : 1;
  const unitsTotal = unitsPerSel * qty;
  const bultoPrice = unitPrice * unitsPerSel;
  const total = unitPrice * unitsTotal;

  function handleAdd() {
    add({ ...product, bulto: unitsPerSel }, unitsTotal);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  const mayoristaBadge = wholesale ? (
    <span
      style={{
        marginLeft: "10px",
        fontSize: "12px",
        background: "var(--amber-soft)",
        color: "var(--amber-deep)",
        padding: "4px 10px",
        borderRadius: "var(--r-sm)",
      }}
    >
      Precio mayorista
    </span>
  ) : null;

  return (
    <div>
      {/* SELECTOR DE PRESENTACIÓN (bulto-primero) */}
      {hasPres && (
        <div style={{ marginBottom: "16px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
            Presentación{presList.length > 1 ? " — elegí cómo lo comprás" : ""}
          </span>
          <div className="chips" style={{ marginTop: "8px" }}>
            {presList.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={`chip ${i === idx ? "on" : ""}`}
                onClick={() => {
                  setIdx(i);
                  setQty(1);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PRECIO PROMINENTE */}
      <div style={{ padding: "20px", background: "var(--bg-2)", borderRadius: "var(--r-lg)" }}>
        {unitsPerSel > 1 ? (
          <>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {sel ? `${sel.label} (${unitsPerSel} u)` : `Bulto cerrado (${unitsPerSel} u)`}
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: "32px", fontWeight: 700, color: "var(--ink)" }}>
              {ars(bultoPrice)} <span style={{ fontSize: "14px", color: "var(--muted)" }}>+ IVA</span>
              {mayoristaBadge}
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--muted)" }}>
              {ars(unitPrice)} por unidad · despacho {deli}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>Precio por unidad</div>
            <div style={{ fontFamily: "var(--display)", fontSize: "32px", fontWeight: 700, color: "var(--ink)" }}>
              {ars(unitPrice)} <span style={{ fontSize: "14px", color: "var(--muted)" }}>/ u + IVA</span>
              {mayoristaBadge}
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--muted)" }}>Despacho {deli}</div>
          </>
        )}
      </div>

      {/* CANTIDAD + TOTAL */}
      <div style={{ marginTop: "18px", display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
            {unitsPerSel > 1 ? "Cantidad de bultos" : "Cantidad"}
          </span>
          <span className="qty">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1")))}
              aria-label="Cantidad"
            />
            <button type="button" onClick={() => setQty((q) => q + 1)} aria-label="Más">
              +
            </button>
          </span>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Total · {unitsTotal} u</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "22px", fontWeight: 700 }}>
            {ars(total)} <span style={{ fontSize: "12px", color: "var(--muted)" }}>+ IVA</span>
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-lg btn-block" style={{ marginTop: "16px" }} onClick={handleAdd}>
        {added ? "✓ Agregado al carrito" : "Agregar al carrito"}
      </button>

      {unitsPerSel > 1 && (
        <p style={{ marginTop: "10px", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
          Venta mayorista por bulto cerrado.
        </p>
      )}
    </div>
  );
}
