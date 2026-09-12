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
 *
 * MARCO FIJO (Marce, 11-sep-2026: "que sin importar la imagen que tenga
 * cargada mantenga el formato igual"). Las fotos del catálogo vienen de
 * orígenes distintos —Wix, fotos nuevas de Marce, recortes— y con relaciones
 * de aspecto que no coinciden. Antes la imagen se dibujaba con `height: auto`,
 * así que el alto de la ficha lo decidía cada archivo: una foto apaisada se
 * veía chiquita, una vertical empujaba el precio abajo del pliegue, y al
 * cambiar de miniatura el bloque saltaba de tamaño.
 *
 * Ahora el marco es SIEMPRE un cuadrado (1:1) y la foto se acomoda adentro con
 * `object-fit: contain`: entra entera, centrada, sin recortarse ni deformarse,
 * y el resto del cuadrado queda en blanco. Todas las fichas miden lo mismo y
 * cambiar de foto no mueve nada. Si alguna vez se quiere otra proporción, se
 * cambia `ASPECTO` y acompaña toda la galería.
 */

/** Relación de aspecto del marco. Cuadrado = lo más neutro para un catálogo
 *  que mezcla botellas (verticales) con cajas y bandejas (apaisadas). */
const ASPECTO = "1 / 1";

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
      <div
        style={{
          aspectRatio: ASPECTO,
          width: "100%",
          maxWidth: "100%",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          padding: "12px",
          boxSizing: "border-box",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--line)",
          background: "#fff",
        }}
      >
        <Image
          key={src}
          src={src}
          alt={images.length > 1 ? `${alt} — foto ${activa + 1} de ${images.length}` : alt}
          width={600}
          height={600}
          unoptimized
          priority
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      </div>

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
                padding: "4px",
                boxSizing: "border-box",
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
