import { NextResponse } from "next/server";
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

interface IncomingLead {
  nombre?: string;
  producto?: string;
  cantidad?: string;
  tecnica?: string;
  marca?: string;
  comentarios?: string;
  origen?: string;
}

export async function POST(req: Request) {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "missing_write_token" },
      { status: 500 },
    );
  }

  let body: IncomingLead;
  try {
    body = (await req.json()) as IncomingLead;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Validación mínima: necesitamos al menos producto y técnica para que el lead
  // sea útil. El resto es opcional.
  if (!body.producto || !body.tecnica) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    );
  }

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
