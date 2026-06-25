import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/** Comparación de strings en tiempo constante (evita timing attacks).
 *  Devuelve false si alguno falta o difieren en longitud. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Autoriza requests de cron/webhook internos (sync-sheet, stock-sale).
 * SOLO acepta el header `Authorization: Bearer <secret>` — NO query string
 * (auditoría jun-2026, P1-3: los `?secret=` se loguean en access logs).
 * Vercel Cron ya manda el header automáticamente.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.SYNC_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return safeEqual(header, `Bearer ${secret}`);
}
