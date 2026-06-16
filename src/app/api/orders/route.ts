import { NextResponse } from "next/server";
import { sanityWriteClient } from "@/lib/sanity";

/**
 * POST /api/orders — crea un pedido (`order`) en Sanity desde el checkout.
 *
 * Server-side: usa `sanityWriteClient`, que se autentica con
 * SANITY_API_WRITE_TOKEN (la misma env var que usan los scripts de migración,
 * ver scripts/migrate-wix-to-sanity.ts). El token NUNCA se expone al cliente.
 *
 * IMPORTANTE: para que esto funcione en producción, SANITY_API_WRITE_TOKEN
 * también tiene que estar seteada en Vercel (Project Settings → Environment
 * Variables), no solo en .env.local local.
 *
 * El handoff a WhatsApp NO depende de esta ruta: el checkout abre wa.me igual
 * aunque acá falle. Por eso devolvemos errores "blandos" (200/500) que el
 * cliente loguea sin bloquear el flujo.
 */

export const runtime = "nodejs";

interface IncomingItem {
  name?: string;
  sku?: string;
  bultos?: number;
  unidades?: number;
  precioUnitario?: number;
  subtotal?: number;
}

interface IncomingOrder {
  customerName?: string;
  customerEmail?: string;
  customerCompany?: string;
  customerPhone?: string;
  items?: IncomingItem[];
  subtotal?: number;
  iva?: number;
  total?: number;
  notes?: string;
  origin?: "web" | "whatsapp";
}

/** Genera un número de pedido legible tipo "#10001" basado en timestamp. */
function makeOrderNumber(): string {
  // 10000 + minutos desde un epoch arbitrario → corto y monótono creciente.
  const base = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60000);
  return `#${10000 + base}`;
}

export async function POST(req: Request) {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    // Sin token no podemos escribir; lo señalamos pero sin romper el checkout.
    return NextResponse.json(
      { ok: false, error: "missing_write_token" },
      { status: 500 },
    );
  }

  let body: IncomingOrder;
  try {
    body = (await req.json()) as IncomingOrder;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    const doc = {
      _type: "order",
      orderNumber: makeOrderNumber(),
      createdAt: new Date().toISOString(),
      customerName: body.customerName ?? "",
      customerEmail: body.customerEmail ?? "",
      customerCompany: body.customerCompany ?? "",
      customerPhone: body.customerPhone ?? "",
      items: (body.items ?? []).map((i) => ({
        _type: "orderItem",
        _key: `${i.sku ?? "item"}-${Math.random().toString(36).slice(2, 8)}`,
        name: i.name ?? "",
        sku: i.sku ?? "",
        bultos: typeof i.bultos === "number" ? i.bultos : undefined,
        unidades: typeof i.unidades === "number" ? i.unidades : undefined,
        precioUnitario: typeof i.precioUnitario === "number" ? i.precioUnitario : undefined,
        subtotal: typeof i.subtotal === "number" ? i.subtotal : undefined,
      })),
      subtotal: typeof body.subtotal === "number" ? body.subtotal : undefined,
      iva: typeof body.iva === "number" ? body.iva : undefined,
      total: typeof body.total === "number" ? body.total : undefined,
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
