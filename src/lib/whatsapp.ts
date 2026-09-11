import type { CartItem } from "./cart-store";
import { ars } from "./format";
import {
  shippingEstimate,
  shippingNet,
  type Bulto,
  DEFAULT_SHIPPING_CONFIG,
  type BatuZone,
  type ShippingConfig,
} from "./shipping";

/** Numero de WhatsApp Business de DC Inc — del Wix actual. */
export const WA_NUMBER = "5491161072310";

interface Totals {
  sub: number;
  rate: number;
  disc: number;
  net: number;
  iva: number;
  /** envío estimado FINAL, con IVA (sólo cliente final; 0 para mayorista) */
  shipping: number;
  /** envío en NETO (la tarifa cargada viene con IVA, ver shippingNet) */
  shippingNeto: number;
  /** IVA de la línea de envío */
  ivaEnvio: number;
  /** IVA de la línea de productos (sobre `net`, o sea ya con descuento) */
  ivaProductos: number;
  /** productos con IVA incluido — es la suma de las líneas del carrito */
  productosConIva: number;
  /** subtotal de productos con IVA incluido, ANTES del descuento */
  subConIva: number;
  /** descuento por volumen en la misma base que `subConIva` */
  discConIva: number;
  total: number;
  hasDeco: boolean;
  /** true = cliente final (precio final con IVA incluido + envío estimado) */
  finalConsumer: boolean;
  /** true = el pedido pasó el techo de bultos y el envío va "a cotizar" */
  shippingQuote: boolean;
}

/** Precio unitario según el rol del usuario. */
export function unitPrice(item: CartItem, wholesale: boolean): number {
  return wholesale ? item.may : item.pub;
}

/** Descuento por volumen — DESACTIVADO (13-jul). El descuento por volumen real
 *  ahora vive en el precio por presentación (caja/pallet) de la planilla, que se
 *  reprecia server-side. Dejar este placeholder activo stackearía → doble
 *  descuento. Tiers previos (por si se reactiva): -5% $300k, -10% $500k, -15% $1M. */
export function volumeRate(_subtotal: number): number {
  return 0;
}

/** Cantidad de bultos del carrito (para el envío Batu por bultos). Cada línea
 *  de caja cuenta sus cajas (qty / unidades por bulto); combos e individuales
 *  cuentan como 1 bulto por línea. Mínimo 1. */
export function totalBultos(items: CartItem[]): number {
  return bultosDetalle(items).reduce((a, b) => a + b.cantidad, 0) || 1;
}

/** Desglose de bultos con su peso FACTURABLE, para la tarifa de Andreani (que
 *  se cobra por paquete, no por pedido). Una entrada por línea del carrito.
 *  kg = null → ese producto no tiene peso cargado en la planilla y el envío
 *  entero pasa a "a cotizar". Ver andreaniQuote() en shipping.ts. */
export function bultosDetalle(items: CartItem[]): Bulto[] {
  const out: Bulto[] = [];
  for (const i of items) {
    if (i.kind === "deco") continue; // servicio: no ocupa bulto
    // `aforadoKg` es el peso facturable de UN bulto de esta línea (ya
    // prorrateado en la ficha si la presentación es por unidad), así que la
    // cantidad es siempre qty / unidades por bulto. Antes las líneas por
    // unidad contaban 1 solo bulto acá y qty bultos en el server: el carrito
    // mostraba un envío y el pedido guardaba otro.
    const step = i.bulto > 0 ? i.bulto : 1;
    const cantidad = i.kind === "combo" ? i.qty : Math.max(1, Math.round(i.qty / step));
    out.push({ kg: typeof i.aforadoKg === "number" && i.aforadoKg > 0 ? i.aforadoKg : null, cantidad });
  }
  return out;
}

function totalBultosLegacy(items: CartItem[]): number {
  const n = items.reduce((acc, i) => {
    if (i.kind === "deco") return acc; // servicio: no ocupa bulto
    if (i.kind === "combo") return acc + i.qty;
    const step = i.bulto > 0 ? i.bulto : 1;
    return acc + (step > 1 ? Math.max(1, Math.round(i.qty / step)) : 1);
  }, 0);
  return Math.max(1, n);
}

export function totalsFor(
  items: CartItem[],
  wholesale = false,
  cp?: string,
  batuZone?: BatuZone | null,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): Totals {
  const sub = items.reduce((s, i) => s + unitPrice(i, wholesale) * i.qty, 0);
  const rate = volumeRate(sub);
  const disc = sub * rate;
  const net = sub - disc;
  // Cliente final: envío estimado. Batu (zona × bultos) si eligió zona CABA/GBA;
  // si no, banda de CP (interior). Mayorista: "a cotizar", no se suma.
  const finalConsumer = !wholesale;
  const bultos = totalBultosLegacy(items);
  const quote = shippingEstimate(
    { cp, batuZone, bultos, wholesale, detalle: bultosDetalle(items) },
    cfg,
  );
  const shipping = quote.total;
  const shippingQuote = quote.toQuote;
  // IVA 21% sobre productos + envío (el flete también tributa IVA). El envío se
  // pasa a neto primero: la tarifa cargada ya viene con IVA, ver shippingNet().
  // Redondeo a centavos: espeja a round2() de /api/orders para que lo que ve el
  // cliente en el carrito sea exactamente lo que se guarda y se le cobra.
  const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
  // Se calcula concepto por concepto (productos y envío) porque así se MUESTRA
  // en el resumen. Si el IVA se calculara sobre la suma y las filas se
  // dedujeran después, las filas podrían no cerrar por un centavo de redondeo.
  const shipNet = r2(shippingNet(shipping));
  const ivaProductos = r2(net * 0.21);
  const ivaEnvio = r2(shipNet * 0.21);
  const iva = r2(ivaProductos + ivaEnvio);
  const total = r2(net + ivaProductos + shipNet + ivaEnvio);
  return {
    sub: r2(sub),
    rate,
    disc: r2(disc),
    net: r2(net),
    iva,
    shipping: r2(shipping),
    shippingNeto: shipNet,
    ivaEnvio,
    ivaProductos,
    productosConIva: r2(net + ivaProductos),
    subConIva: r2(sub * 1.21),
    discConIva: r2(disc * 1.21),
    total,
    hasDeco: items.some((i) => i.deco),
    finalConsumer,
    shippingQuote,
  };
}

export function waSimpleURL(message?: string): string {
  const txt = message ?? "Hola DC Inc! Quiero hacer una consulta.";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(txt)}`;
}

function orderBody(
  items: CartItem[],
  wholesale: boolean,
  cp?: string,
  batuZone?: BatuZone | null,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): string {
  const t = totalsFor(items, wholesale, cp, batuZone, cfg);
  let msg = "";
  for (const i of items) {
    // Mismo criterio que el carrito: el cliente final ve cada línea con IVA
    // incluido, así la suma de las líneas da el subtotal del resumen.
    const sub = unitPrice(i, wholesale) * i.qty * (wholesale ? 1 : 1.21);
    // Venta por bulto cerrado: expresamos bultos (y unidades totales) en vez
    // de unidades sueltas, coherente con lo que muestra el carrito.
    const step = i.bulto > 0 ? i.bulto : 1;
    const bultos = Math.max(1, Math.round(i.qty / step));
    const qtyLabel =
      i.kind === "combo"
        ? `${i.qty} ${i.qty === 1 ? "combo" : "combos"}`
        : i.kind === "deco"
          ? `${i.qty} ${i.qty === 1 ? "u" : "u"}`
          : step > 1
          ? `${bultos} ${bultos === 1 ? "bulto" : "bultos"} (${i.qty} u)`
          : `${i.qty} u`;
    // Presentación elegida (caja / pallet / paquete por color) y su SKU de la
    // planilla, que es el ítem que Marce tiene en su sistema.
    const pres =
      (i.presentationLabel
        ? ` · ${i.presentationLabel}${i.presentationSku ? ` [${i.presentationSku}]` : ""}`
        : "") + (i.variant ? ` · ${i.variant}` : "");
    msg += `• ${qtyLabel} — ${i.name}${pres}${i.deco ? " (+ decorado)" : ""} — ${ars(sub)}\n`;
  }
  if (t.finalConsumer) {
    // Cliente final: mismo desglose que el resumen del carrito — cada concepto
    // con su neto, su IVA y su total, así la cuenta se puede seguir a mano.
    if (t.rate > 0) {
      msg += `\nProductos: ${ars(t.subConIva)}`;
      msg += `\nDescuento volumen (${t.rate * 100}%): -${ars(t.discConIva)}`;
    }
    msg += `\nProductos: ${ars(t.net)} + IVA ${ars(t.ivaProductos)} = ${ars(t.productosConIva)}`;
    msg += t.shippingQuote
      ? `\nEnvío: a cotizar`
      : `\nEnvío: ${ars(t.shippingNeto)} + IVA ${ars(t.ivaEnvio)} = ${ars(t.shipping)} (estimado)`;
    msg += `\nTOTAL: ${ars(t.total)} (IVA 21% incluido: ${ars(t.iva)})`;
  } else {
    msg += `\nSubtotal (neto): ${ars(t.sub)}`;
    if (t.rate > 0) msg += `\nDescuento volumen (${t.rate * 100}%): -${ars(t.disc)}`;
    msg += `\nIVA 21%: ${ars(t.iva)}`;
    msg += `\nEnvío: a cotizar`;
    msg += `\nTotal estimado: ${ars(t.total)}`;
  }
  if (t.hasDeco) msg += "\n\nIncluye decorado — coordinar arte.";
  return msg;
}

export function waOrderURL(
  items: CartItem[],
  wholesale = false,
  cp?: string,
  batuZone?: BatuZone | null,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): string {
  const msg =
    "Hola DC Inc! Quiero cotizar este pedido:\n\n" +
    orderBody(items, wholesale, cp, batuZone, cfg) +
    "\n\n(Enviado desde el carrito web)";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export interface CheckoutInfo {
  nombre?: string;
  /** CUIT o DNI para facturar (pedido de Marce, 10-sep-2026) */
  cuit?: string;
  /** dirección de entrega — antes solo se pedía el CP y no alcanzaba para despachar */
  direccion?: string;
  empresa?: string;
  email?: string;
  telefono?: string;
  cp?: string;
  batuZone?: BatuZone | null;
  notas?: string;
}

export function waCheckoutURL(
  items: CartItem[],
  wholesale: boolean,
  info: CheckoutInfo,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): string {
  let msg = "Hola DC Inc! Quiero confirmar este pedido:\n\n" + orderBody(items, wholesale, info.cp, info.batuZone, cfg);
  const datos: string[] = [];
  if (info.nombre) datos.push(`Nombre: ${info.nombre}`);
  if (info.empresa) datos.push(`Empresa: ${info.empresa}`);
  if (info.email) datos.push(`Email: ${info.email}`);
  if (info.telefono) datos.push(`Tel: ${info.telefono}`);
  if (info.cp) datos.push(`CP envío: ${info.cp}`);
  if (datos.length) msg += "\n\nMis datos:\n" + datos.join("\n");
  if (info.notas) msg += `\n\nNotas: ${info.notas}`;
  msg += "\n\n(Enviado desde el checkout web)";
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
