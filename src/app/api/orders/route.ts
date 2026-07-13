import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { sanityClient, sanityWriteClient } from "@/lib/sanity";
import { isWholesale } from "@/lib/user";
import {
  productsBySkusQuery,
  combosBySlugsQuery,
  type OrderPricingProduct,
  type OrderPricingCombo,
} from "@/lib/queries";
import { IVA_RATE, isSaleActive } from "@/lib/pricing";
import { shippingForCp } from "@/lib/shipping";

/**
 * POST /api/orders — crea un pedido (`order`) en Sanity desde el checkout.
 *
 * SEGURIDAD (auditoría jun-2026):
 *  - El cliente manda SOLO { sku/slug, kind, qty }. Los precios y totales se
 *    RECALCULAN server-side leyendo Sanity → nunca se confía en lo que manda el
 *    browser (antes el total era 100% manipulable).
 *  - El rol mayorista se deriva server-side con isWholesale() (sesión Clerk),
 *    no de un flag del cliente.
 *  - El payload se valida con Zod (tipos, longitudes, topes) para frenar basura.
 *
 * Token de escritura: SANITY_API_WRITE_TOKEN (server-only, nunca al cliente).
 * El handoff a WhatsApp NO depende de esta ruta (errores "blandos").
 *
 * NOTA: rate-limit real por IP requiere infra externa (Upstash / Vercel
 * Firewall); acá queda la validación de payload como primera barrera.
 */

export const runtime = "nodejs";

const ItemSchema = z.object({
  sku: z.string().trim().max(64).optional(),
  slug: z.string().trim().max(160).optional(),
  kind: z.literal("combo").optional(),
  qty: z.number().int().positive().max(100000),
  name: z.string().trim().max(200).optional(),
  deco: z.boolean().optional(),
  // SKU de la presentación elegida (caja/pallet). El server valida que
  // pertenezca al producto y reprecia con SU precio; nunca confía en el cliente.
  presentationSku: z.string().trim().max(64).optional(),
});

const OrderSchema = z.object({
  customerName: z.string().trim().max(120).optional(),
  customerEmail: z.string().trim().max(160).optional(),
  customerCompany: z.string().trim().max(160).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  items: z.array(ItemSchema).min(1).max(200),
  cp: z.string().trim().max(12).optional(), // CP destino → banda de envío
  notes: z.string().trim().max(2000).optional(),
  origin: z.enum(["web", "whatsapp"]).optional(),
});

/** Descuento por volumen — DESACTIVADO (13-jul). El descuento por volumen real
 *  ahora viaja en el precio por presentación (caja/pallet), repreciado arriba.
 *  Activarlo stackearía → doble descuento. Espeja src/lib/whatsapp.ts. */
function volumeRate(_subtotal: number): number {
  return 0;
}

/** N° de pedido legible + sufijo aleatorio para evitar colisiones en el mismo minuto. */
function makeOrderNumber(): string {
  const base = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60000);
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `#${10000 + base}-${rnd}`;
}

export async function POST(req: Request) {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "missing_write_token" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = OrderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const body = parsed.data;

  // Rol y usuario desde la sesión (server-side, no del cliente).
  const wholesale = await isWholesale();
  const { userId } = await auth();

  try {
    // Separamos items en combos (por slug) y productos (por sku).
    const comboSlugs = body.items.filter((i) => i.kind === "combo" && i.slug).map((i) => i.slug!);
    const productSkus = body.items.filter((i) => i.kind !== "combo" && i.sku).map((i) => i.sku!);

    const [products, combos] = await Promise.all([
      productSkus.length
        ? sanityClient.fetch<OrderPricingProduct[]>(productsBySkusQuery, { skus: productSkus })
        : Promise.resolve([]),
      comboSlugs.length
        ? sanityClient.fetch<OrderPricingCombo[]>(combosBySlugsQuery, { slugs: comboSlugs })
        : Promise.resolve([]),
    ]);

    const productBySku = new Map(products.map((p) => [p.sku, p]));
    const comboBySlug = new Map(combos.map((c) => [c.slug, c]));

    type Line = {
      _type: "orderItem";
      _key: string;
      name: string;
      sku: string;
      bultos?: number;
      unidades?: number;
      precioUnitario?: number;
      subtotal?: number;
    };

    const lines: Line[] = [];
    let sub = 0;

    for (const it of body.items) {
      let name = it.name ?? "";
      let sku = it.sku ?? "";
      let unitNet: number | undefined;
      let bultos: number | undefined;

      if (it.kind === "combo") {
        const combo = it.slug ? comboBySlug.get(it.slug) : undefined;
        if (!combo) continue; // combo inexistente → no inventamos precio
        name = combo.name;
        sku = combo.slug;
        unitNet = typeof combo.pricePublicFrom === "number" ? combo.pricePublicFrom : 0;
      } else {
        const prod = it.sku ? productBySku.get(it.sku) : undefined;
        if (!prod) continue; // sku inexistente → se descarta
        name = prod.name;
        sku = prod.sku;
        const saleOn = isSaleActive(prod.isOnSale, prod.saleStartDate, prod.saleEndDate);
        // Presentación elegida (caja/pallet): buscamos su fila en la planilla y
        // usamos SU precio neto por unidad. Solo la aceptamos si el presentationSku
        // pertenece realmente a este producto (validación server-side).
        const pres =
          it.presentationSku && prod.presentationPricing
            ? prod.presentationPricing.find((pp) => pp.sku === it.presentationSku)
            : undefined;
        const basePub = pres?.pricePublic ?? prod.pricePublic;
        const baseMay = pres?.priceWholesale ?? prod.priceWholesale;
        // Precio NETO (sin IVA). Espeja al buy-box: la oferta (salePrice) mantiene
        // prioridad sobre el precio de presentación para el cliente final.
        unitNet = wholesale
          ? baseMay
          : saleOn && typeof prod.salePrice === "number"
            ? prod.salePrice
            : basePub;
        const stepUnits = pres?.unitsPerBulk ?? prod.unitsPerBulk;
        const step = stepUnits > 0 ? stepUnits : 1;
        bultos = Math.max(1, Math.round(it.qty / step));
      }

      const lineSub = (unitNet ?? 0) * it.qty;
      sub += lineSub;
      lines.push({
        _type: "orderItem",
        _key: `${sku || "item"}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        sku,
        bultos,
        unidades: it.qty,
        precioUnitario: unitNet,
        subtotal: lineSub,
      });
    }

    // Totales (misma fórmula que totalsFor de whatsapp.ts).
    const rate = volumeRate(sub);
    const net = sub - sub * rate;
    const iva = net * IVA_RATE;
    // Envío estimado server-side según la banda del CP (≤10 kg). Mayorista → 0.
    const shipping = shippingForCp(body.cp, wholesale);
    const total = net + iva + shipping;

    const doc = {
      _type: "order",
      orderNumber: makeOrderNumber(),
      createdAt: new Date().toISOString(),
      clerkUserId: userId ?? undefined,
      priceBasis: wholesale ? "mayorista" : "final",
      customerName: body.customerName ?? "",
      customerEmail: body.customerEmail ?? "",
      customerCompany: body.customerCompany ?? "",
      customerPhone: body.customerPhone ?? "",
      items: lines,
      subtotal: sub,
      iva,
      cpDestino: body.cp ?? "",
      envioEstimado: shipping,
      total,
      paymentStatus: "no_pagado",
      fulfillmentStatus: "no_procesado",
      origin: body.origin ?? "web",
      notes: body.notes ?? "",
    };

    const created = await sanityWriteClient.create(doc);
    return NextResponse.json({ ok: true, id: created._id, orderNumber: doc.orderNumber });
  } catch (err) {
    console.error("[/api/orders] error creando pedido en Sanity:", err);
    return NextResponse.json({ ok: false, error: "sanity_create_failed" }, { status: 500 });
  }
}
