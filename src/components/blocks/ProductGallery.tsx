"use client";
import Image from "next/image";
import { useState } from "react";

/**
 * Galería de la ficha de producto.
 *
 * Hasta el 11-sep-2026 la ficha mostraba UNA sola foto: la query traía
 * `images[0]` y el resto del array quedaba cargado en Sanity sin que nadie lo
 * viera. Pedido de Marce: poder cargar varias fotos por producto.
 *
 * Con una sola imagen se comporta igual que antes (sin miniaturas), así que las
 * fichas que tienen una foto no cambian.
 */
export default function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [activa, setActiva] = useState(0);
  const src = images[activa] ?? images[0];

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <Image
        key={src}
        src={src}
        alt={images.length > 1 ? `${alt} — foto ${activa + 1} de ${images.length}` : alt}
        width={600}
        height={600}
        unoptimized
        priority
        style={{
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--line)",
          background: "#fff",
          width: "100%",
          height: "auto",
        }}
      />

      {images.length > 1 && (
        <div
          role="group"
          aria-label={`Fotos de ${alt}`}
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActiva(i)}
              aria-label={`Ver foto ${i + 1} de ${images.length}`}
              aria-current={i === activa}
              style={{
                width: "64px",
                height: "64px",
                padding: 0,
                flex: "none",
                cursor: "pointer",
                background: "#fff",
                borderRadius: "var(--r-sm)",
                border:
                  i === activa
                    ? "2px solid var(--amber-deep, var(--ink))"
                    : "1px solid var(--line)",
              }}
            >
              <Image
                src={img}
                alt=""
                width={64}
                height={64}
                unoptimized
                style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
