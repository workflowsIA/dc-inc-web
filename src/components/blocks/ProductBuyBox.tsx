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

/** "24un en Cajas" → {label, units:24}; "Personalizar 40000un" → custom. */
function parsePres(s: string): Pres {
  const m = s.replace(/\./g, "").match(/(\d+)/);
  return { label: s, units: m ? parseInt(m[1], 10) : 1 };
}

export default function ProductBuyBox({ product, unitPrice, wholesale, deli, presentations }: Props) {
  const add = useCart((s) => s.add);
  const presList = (presentations ?? []).map(parsePres);
  const hasPres = presList.length > 0;
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const sel = hasPres ? presList[idx] : null;
  const unitsPerSel = sel ? sel.units : 1;
  const unitsTotal = unitsPerSel * qty;
  const total = unitPrice * unitsTotal;

  function handleAdd() {
    add({ ...product, bulto: unitsPerSel }, unitsTotal);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div>
      {/* PRECIO POR UNIDAD */}
      <div style={{ padding: "20px", background: "var(--bg-2)", borderRadius: "var(--r-lg)" }}>
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>Precio por unidad</div>
        <div style={{ fontFamily: "var(--display)", fontSize: "32px", fontWeight: 700, color: "var(--ink)" }}>
          {ars(unitPrice)} <span style={{ fontSize: "14px", color: "var(--muted)" }}>/ u + IVA</span>
          {wholesale && (
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
          )}
        </div>
        <div style={{ marginTop: "8px", fontSize: "14px", color: "var(--muted)" }}>Despacho {deli}</div>
      </div>

      {/* SELECTOR DE PRESENTACIÓN */}
      {hasPres && (
        <div style={{ marginTop: "20px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>
            Presentación{presList.length > 1 ? " — elegí una" : ""}
          </span>
          <div className="chips" style={{ marginTop: "8px" }}>
            {presList.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={`chip ${i === idx ? "on" : ""}`}
                onClick={() => setIdx(i)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "10px", fontSize: "14px", color: "var(--ink)" }}>
            {sel!.units > 1 ? (
              <>
                Bulto de <strong>{sel!.units} u</strong> ·{" "}
                <strong>{ars(unitPrice * sel!.units)}</strong> + IVA
              </>
            ) : (
              <>Por unidad</>
            )}
          </div>
        </div>
      )}

      {/* CANTIDAD + TOTAL */}
      <div style={{ marginTop: "20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
            {hasPres && unitsPerSel > 1 ? "Cantidad de bultos" : "Cantidad"}
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
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Total estimado · {unitsTotal} u</div>
          <div style={{ fontFamily: "var(--display)", fontSize: "22px", fontWeight: 700 }}>
            {ars(total)} <span style={{ fontSize: "12px", color: "var(--muted)" }}>+ IVA</span>
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-lg btn-block" style={{ marginTop: "16px" }} onClick={handleAdd}>
        {added ? "✓ Agregado al carrito" : "Agregar al carrito"}
      </button>
    </div>
  );
}
