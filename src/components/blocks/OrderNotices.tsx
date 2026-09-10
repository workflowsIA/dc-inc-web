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
 */
export function OrderNotices({ finalConsumer }: { finalConsumer: boolean }) {
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
      {finalConsumer && (
        <p style={{ margin: 0 }}>
          <strong>El envío es un estimado.</strong> Antes de despachar te confirmamos el
          costo exacto: al interior depende del transporte, del volumen y del embalaje.{" "}
          <Link href="/logistica" style={{ textDecoration: "underline" }}>
            Cómo trabajamos los envíos
          </Link>
          .
        </p>
      )}
      <p style={{ margin: 0 }}>
        <strong>Sujeto a disponibilidad de stock.</strong> Si algo no está disponible te
        avisamos antes de despachar y lo resolvemos con vos.
      </p>
    </div>
  );
}
