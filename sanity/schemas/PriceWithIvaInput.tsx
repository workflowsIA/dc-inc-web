import { useFormValue } from "sanity";
import { Text } from "@sanity/ui";

/**
 * Campo informativo del Studio: muestra el precio unitario neto del producto
 * con el IVA aplicado (lo que ve el cliente final en la web). No guarda nada.
 */
const IVA_RATE = 0.21;

export function PriceWithIvaInput() {
  const net = useFormValue(["pricePublic"]) as number | undefined;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
  if (typeof net !== "number") {
    return <Text size={1} muted>— (sin precio todavía: se completa con la sincronización)</Text>;
  }
  return (
    <Text size={2}>
      <strong>{fmt(net * (1 + IVA_RATE))}</strong> IVA incluido&nbsp;&nbsp;
      <span style={{ opacity: 0.7 }}>({fmt(net)} neto + 21%)</span>
    </Text>
  );
}
