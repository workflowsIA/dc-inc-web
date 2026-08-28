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
import { IVA_RATE, isSaleActive, retailCanBuyPresentation } from "@/lib/pricing";
import { shippingEstimate, type BatuZone } from "@/lib/shipping";
import { getDecoPricing, getShippingConfig } from "@/lib/sanity-data";
import { decoQuote } from "@/lib/deco";
import { guard, LIMITS } from "@/lib/rate-limit";

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
  kind: z.enum(["combo", "deco"]).optional(),
  qty: z.number().int().positive().max(100000),
  name: z.string().trim().max(200).optional(),
  deco: z.boolean().optional(),
  // SKU de la presentación elegida (caja/pallet). El server valida que
  // pertenezca al producto y reprecia con SU precio; nunca confía en el cliente.
  presentationSku: z.string().trim().max(64).optional(),
  // Color / terminación elegida como texto (unidad o caja de una tapa con
  // colores): no cambia el precio ni el SKU, solo el nombre de la línea.
  variant: z.string().trim().max(60).optional(),
});

const OrderSchema = z.object({
  customerName: z.string().trim().max(120).optional(),
  customerEmail: z.string().trim().max(160).optional(),
  customerCompany: z.string().trim().max(160).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  items: z.array(ItemSchema).min(1).max(200),
  cp: z.string().trim().max(12).optional(), // CP destino → banda de envío (interior)
  batuZone: z.number().int().min(1).max(4).optional(), // zona CABA/GBA (envío propio Batu)
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
  // Rate limit por IP antes de tocar nada: este endpoint escribe en Sanity y
  // dispara una tarjeta en Monday, así que un flood sale caro en los dos lados.
  const limited = await guard(req, LIMITS.orders);
  if (limited) return limited;

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
    const productSkus = body.items.filter((i) => !i.kind && i.sku).map((i) => i.sku!);

    const hasDeco = body.items.some((i) => i.kind === "deco");
    const [products, combos, decoPricing] = await Promise.all([
      productSkus.length
        ? sanityClient.fetch<OrderPricingProduct[]>(productsBySkusQuery, { skus: productSkus })
        : Promise.resolve([]),
      comboSlugs.length
        ? sanityClient.fetch<OrderPricingCombo[]>(combosBySlugsQuery, { slugs: comboSlugs })
        : Promise.resolve([]),
      hasDeco ? getDecoPricing() : Promise.resolve(null),
    ]);

    const productBySku = new Map(products.map((p) => [p.sku, p]));
    const comboBySlug = new Map(combos.map((c) => [c.slug, c]));

    type Line = {
      _type: "orderItem";
      _key: string;
      name: string;
      /** SKU de la línea: el de la PRESENTACIÓN elegida (caja/pallet/paquete por
       *  color) si la hay — es el ítem que Marce tiene en su sistema —, si no el
       *  del producto. */
      sku: string;
      /** SKU del producto base (para stock e historial), cuando difiere de `sku`. */
      baseSku?: string;
      bultos?: number;
      unidades?: number;
      precioUnitario?: number;
      subtotal?: number;
    };

    const lines: Line[] = [];
    let sub = 0;
    let totalBultos = 0; // para el envío Batu (zona × bultos)

    for (const it of body.items) {
      let name = it.name ?? "";
      let sku = it.sku ?? "";
      let baseSku: string | undefined;
      let unitNet: number | undefined;
      let bultos: number | undefined;

      if (it.kind === "combo") {
        const combo = it.slug ? comboBySlug.get(it.slug) : undefined;
        if (!combo) continue; // combo inexistente → no inventamos precio
        name = combo.name;
        sku = combo.slug;
        unitNet = typeof combo.pricePublicFrom === "number" ? combo.pricePublicFrom : 0;
        totalBultos += it.qty; // 1 bulto por combo
      } else if (it.kind === "deco") {
        // Decorado: el SKU es un tramo de la tarifa (DBC1124…). Se reprecia
        // contra la tarifa de Sanity: el tramo se recalcula por la cantidad real
        // de piezas (nunca se confía en el precio del cliente). Sin tarifa o SKU
        // desconocido → se descarta la línea. El montaje (DCMYM1/2) ya no se
        // cobra aparte (incluido en la tarifa por pieza): si un carrito viejo
        // trae esa línea, se descarta.
        const opt = decoPricing?.options.find(
          (o) => o.setupSku === it.sku || o.tiers.some((t) => t.sku === it.sku),
        );
        if (!opt || !it.sku) continue;
        if (opt.setupSku === it.sku) continue; // línea de montaje de un carrito viejo → se descarta
        const q = decoQuote(opt, it.qty);
        if (!q) continue; // por debajo del tramo mínimo → no se cotiza
        unitNet = q.perUnit;
        sku = q.tier.sku;
        name = it.name || `Decorado ${opt.label}`;
        // servicio: no suma bultos para el envío
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
        // Producto por color (tapas): solo presentación cerrada de la planilla.
        if (prod.soldByBulkOnly && !pres) {
          return NextResponse.json(
            {
              ok: false,
              error: "bulk_only",
              message: `«${prod.name}» se vende solo por paquete/caja cerrada. Elegí una presentación.`,
            },
            { status: 400 },
          );
        }
        const basePub = pres?.pricePublic ?? prod.pricePublic;
        const baseMay = pres?.priceWholesale ?? prod.priceWholesale;
        // TOPE MINORISTA (server-side, espeja al buy-box): el cliente final no
        // puede comprar una presentación cerrada que supere el tope con IVA.
        if (!wholesale && pres && !retailCanBuyPresentation(basePub, pres.unitsPerBulk)) {
          return NextResponse.json(
            {
              ok: false,
              error: "presentation_wholesale_only",
              message: `«${prod.name} — ${pres.label ?? "presentación"} x${pres.unitsPerBulk}» es solo para clientes mayoristas. Pedí tu alta mayorista o comprá por unidad.`,
            },
            { status: 400 },
          );
        }
        if (pres?.sku) {
          sku = pres.sku;
          baseSku = prod.sku;
          const tag = [pres.label, pres.variant].filter(Boolean).join(" · ");
          if (tag) name = `${prod.name} — ${tag} x${pres.unitsPerBulk}`;
        }
        // Color elegido como texto (solo si la fila no tiene color propio).
        if (it.variant && !pres?.variant) name = `${name} · ${it.variant}`;
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
        totalBultos += bultos;
      }

      const lineSub = (unitNet ?? 0) * it.qty;
      sub += lineSub;
      lines.push({
        _type: "orderItem",
        _key: `${sku || "item"}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        sku,
        ...(baseSku && baseSku !== sku ? { baseSku } : {}),
        bultos,
        unidades: it.qty,
        precioUnitario: unitNet,
        subtotal: lineSub,
      });
    }

    // Totales (misma fórmula que totalsFor de whatsapp.ts).
    const rate = volumeRate(sub);
    const net = sub - sub * rate;
    // Envío estimado server-side: Batu (zona × bultos) si el cliente eligió zona
    // CABA/GBA; si no, banda de CP (interior). Mayorista → 0.
    const shipCfg = await getShippingConfig();
    const shipping = shippingEstimate(
      {
        cp: body.cp,
        batuZone: body.batuZone as BatuZone | undefined,
        bultos: Math.max(1, totalBultos),
        wholesale,
      },
      shipCfg,
    );
    const iva = (net + shipping) * IVA_RATE;
    const total = net + shipping + iva;

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
      zonaBatu: body.batuZone ?? null,
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
