import Link from "next/link";

/**
 * Avisos al pie del resumen del pedido — se muestran igual en el carrito y en
 * el checkout, por eso viven en un solo lugar (antes el carrito tenía su propia
 * línea de "envío estimado" y el checkout no tenía ninguna).
 *
 * Pedido de Marce (9-sep-2026):
 *  - que el cliente final sepa que el envío que ve es un ESTIMADO y que el
 *    costo exacto se confirma hablando con DC, sobre todo al interior, con
 *    link a la sección de Logística;
 *  - que el pedido está sujeto a disponibilidad de stock.
 *
 * El aviso de envío no aplica al mayorista: su envío ya figura "a cotizar".
 * Cuando el pedido no se puede estimar (un producto sin peso cargado, o un
 * bulto de más de 50 kg facturables, donde corresponde pallet y no paquetería)
 * el mensaje cambia: no hay estimado, se cotiza. Si en cambio lo que falta es
 * un código postal válido, el mensaje es otro: no es que convenga cotizarlo,
 * es que no se puede calcular sin ese dato. Ver andreaniQuote() en shipping.ts.
 */
export function OrderNotices({
  finalConsumer,
  shippingQuote = false,
  shippingReason,
}: {
  finalConsumer: boolean;
  /** no se pudo estimar el envío (sin peso, bulto fuera de paquetería, o CP inválido) */
  shippingQuote?: boolean;
  /** "cp" = lo que falta es un código postal válido, no un motivo de peso/volumen */
  shippingReason?: "sin-peso" | "bulto-grande" | "pedido-grande" | "mayorista" | "cp";
}) {
  return (
    <div
      style={{
        marginTop: "12px",
        display: "grid",
        gap: "8px",
        fontSize: "12px",
        lineHeight: 1.5,
        color: "var(--muted)",
      }}
    >
      {finalConsumer &&
        (shippingQuote ? (
          shippingReason === "cp" ? (
            <p style={{ margin: 0 }}>
              <strong>Nos falta tu código postal para calcular el envío.</strong> Completalo
              arriba (4 dígitos, sin letras) para ver el costo antes de confirmar.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              <strong>Este pedido lleva envío a cotizar.</strong> Por el volumen conviene
              despacharlo por transporte o pallet, que sale bastante menos que la
              paquetería, así que lo calculamos con vos antes de despachar en lugar de
              mostrarte un número que va a quedar mal.{" "}
              <Link href="/logistica" style={{ textDecoration: "underline" }}>
                Cómo trabajamos los envíos
              </Link>
              .
            </p>
          )
        ) : (
          <p style={{ margin: 0 }}>
            <strong>El envío es un estimado.</strong> Antes de despachar te confirmamos el
            costo exacto: al interior depende del transporte, del volumen y del embalaje.{" "}
            <Link href="/logistica" style={{ textDecoration: "underline" }}>
              Cómo trabajamos los envíos
            </Link>
            .
          </p>
        ))}
      <p style={{ margin: 0 }}>
        <strong>Sujeto a disponibilidad de stock.</strong> Si algo no está disponible te
        avisamos antes de despachar y lo resolvemos con vos.
      </p>
    </div>
  );
}
