"use client";
import { ars } from "@/lib/format";

/**
 * Resumen de totales — el MISMO en el carrito y en el checkout.
 *
 * Por qué existe: el 10-sep-2026 un cliente (Fernando Valor, vía Marce) avisó
 * que el carrito no le cerraba. Sumaba las líneas y le daba $24.636, pero el
 * resumen decía $20.361. Los dos números estaban bien y eran el mismo pedido:
 * las líneas se muestran con IVA incluido (que es como el cliente final ve los
 * precios en toda la web) y el resumen arrancaba con el subtotal NETO, sin
 * decirlo. La diferencia era exactamente el 21%.
 *
 * La solución no es elegir una base y esconder la otra: es mostrar las dos.
 * Cada concepto —productos y envío— se abre en neto + IVA + total, y la fila
 * de abajo suma cada columna. Así la cuenta se puede seguir a mano desde
 * cualquier lado: las líneas del carrito dan la columna "Total" de productos,
 * y el total del pedido es la suma de la columna.
 *
 * El envío se trata igual que los productos a propósito: la tarifa cargada ya
 * viene con IVA (ver SHIPPING_RATES_INCLUDE_IVA en shipping.ts), así que se
 * muestra su neto y su IVA por separado en vez de dejarlo como un bloque
 * opaco que no se sabe si tributa o no.
 *
 * OJO AL TOCAR EL LAYOUT (Marce, 11-sep-2026: "está corrido el título de cada
 * columna"): las cuatro columnas se alinean SOLO si todas las filas comparten
 * UNA grilla. Antes cada fila era su propia grilla con columnas `auto`, así
 * que cada una se anchaba según su propio contenido y los encabezados
 * quedaban desplazados respecto de los números. Por eso ahora la grilla vive
 * en el contenedor y cada fila aporta cuatro celdas sueltas (fragmentos), sin
 * ningún div intermedio: cualquier wrapper que se agregue en el medio rompe
 * de nuevo la alineación.
 */
export interface TotalsForSummary {
  net: number;
  ivaProductos: number;
  productosConIva: number;
  rate: number;
  disc: number;
  discConIva: number;
  shippingNeto: number;
  ivaEnvio: number;
  shipping: number;
  iva: number;
  total: number;
  finalConsumer: boolean;
  shippingQuote: boolean;
  /** por qué el envío va "a cotizar" — "cp" = falta o es inválido el código
   *  postal, y ahí el resumen NO dice "a cotizar" sino que pide el dato. */
  shippingReason?: "sin-peso" | "bulto-grande" | "pedido-grande" | "mayorista" | "cp";
}

export function TotalsRows({
  t,
  money,
}: {
  t: TotalsForSummary;
  /** formateador de la página (muestra "—" mientras se repricia el mayorista) */
  money: (n: number) => string;
}) {
  return (
    <div style={grid}>
      <Head />

      {t.rate > 0 && (
        <Line
          label={`Descuento volumen (${t.rate * 100}%)`}
          neto={`-${money(t.disc)}`}
          iva=""
          total={`-${money(t.discConIva)}`}
          muted
        />
      )}

      <Line
        label="Productos"
        neto={money(t.net)}
        iva={money(t.ivaProductos)}
        total={money(t.productosConIva)}
      />

      {t.shippingQuote ? (
        <Line
          label="Envío"
          neto="—"
          iva="—"
          // Nunca un monto inventado: si lo que falta es el CP, se lo pedimos
          // en vez de mostrar "a cotizar" (que suena a que ya se coordina) o,
          // peor, $0 como si el envío saliera gratis.
          total={t.shippingReason === "cp" ? "Ingresá tu código postal" : "a cotizar"}
          muted
        />
      ) : (
        <Line
          label="Envío estimado"
          neto={ars(t.shippingNeto)}
          iva={ars(t.ivaEnvio)}
          total={ars(t.shipping)}
          muted
        />
      )}

      <div
        style={{
          gridColumn: "1 / -1",
          height: "1px",
          background: "var(--line-2)",
          margin: "4px 0",
        }}
      />

      <Line
        label={t.finalConsumer ? "Total estimado" : "Total"}
        neto={money(t.net + (t.shippingQuote ? 0 : t.shippingNeto))}
        iva={money(t.iva)}
        total={money(t.total)}
        strong
      />
    </div>
  );
}

/** UNA sola grilla para todas las filas: es lo que mantiene los encabezados
 *  alineados con sus números. Las tres columnas de números se anchan con la
 *  más ancha de toda la tabla (max-content), no fila por fila. */
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) repeat(3, minmax(0, max-content))",
  columnGap: "10px",
  rowGap: "6px",
  alignItems: "baseline",
  fontSize: "13px",
};

/** Encabezado de las tres columnas de números. */
function Head() {
  const th: React.CSSProperties = {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: ".04em",
    color: "var(--muted)",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  return (
    <>
      <span />
      <span style={th}>Neto</span>
      <span style={th}>IVA 21%</span>
      <span style={th}>Total</span>
    </>
  );
}

function Line({
  label,
  neto,
  iva,
  total,
  muted,
  strong,
}: {
  label: string;
  neto: string;
  iva: string;
  total: string;
  muted?: boolean;
  strong?: boolean;
}) {
  const num: React.CSSProperties = {
    textAlign: "right",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  };
  return (
    <>
      <span style={{ color: muted && !strong ? "var(--muted)" : undefined, minWidth: 0 }}>
        {label}
      </span>
      <span style={{ ...num, color: "var(--muted)" }}>{neto}</span>
      <span style={{ ...num, color: "var(--muted)" }}>{iva}</span>
      <span style={{ ...num, fontWeight: strong ? 700 : 600 }}>{total}</span>
    </>
  );
}
