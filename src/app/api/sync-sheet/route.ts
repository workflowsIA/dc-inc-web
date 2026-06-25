/**
 * Endpoint de sincronización Sheet → Sanity (precios + stock).
 *
 * - GET  → lo dispara el Vercel Cron (configurado en vercel.json) 1x/día (límite Hobby).
 *          Para mayor frecuencia: Pro plan, o un scheduler externo pegándole con ?secret=.
 * - POST → "publicar ahora" (botón en el panel admin para empujar cambios urgentes).
 *
 * Auth: header `Authorization: Bearer <SYNC_CRON_SECRET>` (solo header, no query
 * string — ver src/lib/api-auth.ts). Vercel Cron manda el header automáticamente;
 * soportamos tanto SYNC_CRON_SECRET como el CRON_SECRET nativo de Vercel.
 */
import { NextRequest, NextResponse } from "next/server";
import { runSheetSync } from "@/lib/sheet-sync";
import { isCronAuthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest, dryRun: boolean) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  try {
    const summary = await runSheetSync({ dryRun });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Cron programado.
export async function GET(req: NextRequest) {
  return handle(req, req.nextUrl.searchParams.get("dryRun") === "1");
}

// "Publicar ahora" desde el panel.
export async function POST(req: NextRequest) {
  return handle(req, false);
}
