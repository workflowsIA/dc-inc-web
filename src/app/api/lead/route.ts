import { NextResponse } from "next/server";
import { z } from "zod";
import { sanityWriteClient } from "@/lib/sanity";

/**
 * POST /api/lead — guarda un lead (`lead`) en Sanity desde el formulario web.
 *
 * Server-side: usa `sanityWriteClient`, autenticado con SANITY_API_WRITE_TOKEN
 * (la misma env var de /api/orders). El token NUNCA se expone al cliente.
 *
 * El handoff a WhatsApp NO depende de esta ruta: el formulario de decorado abre
 * wa.me igual aunque acá falle. Devolvemos errores "blandos" que el cliente
 * loguea sin bloquear el flujo.
 */

export const runtime = "nodejs";

// Validación con Zod: producto + técnica obligatorios, todo acotado en longitud
// para frenar payloads basura (auditoría jun-2026, P0-1).
const LeadSchema = z.object({
  nombre: z.string().trim().max(120).optional(),
  producto: z.string().trim().min(1).max(200),
  cantidad: z.string().trim().max(80).optional(),
  tecnica: z.string().trim().min(1).max(120),
  marca: z.string().trim().max(120).optional(),
  comentarios: z.string().trim().max(2000).optional(),
  origen: z.string().trim().max(60).optional(),
});

export async function POST(req: Request) {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "missing_write_token" },
      { status: 500 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = LeadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const body = parsed.data;

  try {
    const doc = {
      _type: "lead",
      createdAt: new Date().toISOString(),
      nombre: body.nombre ?? "",
      producto: body.producto,
      cantidad: body.cantidad ?? "",
      tecnica: body.tecnica,
      marca: body.marca ?? "",
      comentarios: body.comentarios ?? "",
      origen: body.origen ?? "decorado-web",
    };

    const created = await sanityWriteClient.create(doc);
    return NextResponse.json({ ok: true, id: created._id });
  } catch (err) {
    console.error("[/api/lead] error creando lead en Sanity:", err);
    return NextResponse.json({ ok: false, error: "sanity_create_failed" }, { status: 500 });
  }
}
