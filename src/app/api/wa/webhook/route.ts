/**
 * Proxy del webhook de WhatsApp Cloud API → Chatwoot.
 *
 * POR QUÉ EXISTE: Chatwoot no soporta los mensajes de PEDIDO de catálogo
 * (type "order"): llegan vacíos. Este proxy se pone en el medio entre Meta y
 * Chatwoot. Reenvía TODO el tráfico normal tal cual (para no cambiar el
 * comportamiento del inbox) y, cuando detecta un `order`, lo formatea como
 * texto y lo inyecta en la conversación vía la Application API de Chatwoot.
 *
 * FLUJO DE DEPLOY (ver Runbook_Proxy_Pedidos_WhatsApp_DC_Inc.md):
 *   Meta → https://<web>/api/wa/webhook → (reenvía) → Chatwoot /webhooks/whatsapp/<pnid>
 * Se repunta la Callback URL de Meta a este endpoint y se usa WA_VERIFY_TOKEN.
 *
 * SEGURIDAD: si WA_APP_SECRET está seteado, se valida X-Hub-Signature-256.
 * DEGRADA BIEN: si Chatwoot no está configurado o algo falla en la inyección,
 * igual se reenvía el tráfico y se responde 200 (no rompemos el inbound).
 */
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  isChatwootConfigured,
  injectIncomingText,
  chatwootConfigFlags,
  pingChatwoot,
} from "@/lib/chatwoot";
import {
  extractOrders,
  hasOrders,
  stripOrders,
  formatOrder,
  type WaWebhookPayload,
} from "@/lib/wa-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUILD = "v7-private-note";
const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || "";
const APP_SECRET = process.env.WA_APP_SECRET || "";
/** URL del webhook de WhatsApp DENTRO de Chatwoot (destino del reenvío). */
const CHATWOOT_WA_WEBHOOK_URL = process.env.CHATWOOT_WA_WEBHOOK_URL || "";

// ---- GET: verificación del webhook de Meta ----
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  // Diagnóstico (protegido por el verify token). No expone secretos.
  const debug = url.searchParams.get("debug");
  if (debug && VERIFY_TOKEN && debug === VERIFY_TOKEN) {
    // Test de inyección: ?debug=<token>&inject=<telefono>&msg=<texto>
    const injectPhone = url.searchParams.get("inject");
    if (injectPhone) {
      try {
        const ok = await injectIncomingText({
          waId: injectPhone,
          name: url.searchParams.get("name") || "Test Proxy",
          content: url.searchParams.get("msg") || "🔧 test de inyección del proxy",
        });
        return NextResponse.json({ build: BUILD, injected: ok });
      } catch (e) {
        return NextResponse.json({ build: BUILD, injected: false, error: String((e as Error)?.message || e) });
      }
    }
    const ping = await pingChatwoot();
    return NextResponse.json({
      build: BUILD,
      chatwoot: chatwootConfigFlags(),
      forwardUrl: Boolean(CHATWOOT_WA_WEBHOOK_URL),
      appSecret: Boolean(APP_SECRET),
      chatwootPing: ping,
    });
  }

  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** Valida la firma de Meta (si hay APP_SECRET). */
function validSignature(raw: string, header: string | null): boolean {
  if (!APP_SECRET) return true; // sin secret → no validamos (config opcional)
  if (!header) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Reenvía el body (posiblemente modificado) a Chatwoot. No lanza. */
async function forwardToChatwoot(body: string): Promise<void> {
  if (!CHATWOOT_WA_WEBHOOK_URL) return;
  try {
    await fetch(CHATWOOT_WA_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    console.error("[wa/webhook] reenvío a Chatwoot falló:", e);
  }
}

// ---- POST: mensajes entrantes ----
export async function POST(req: Request) {
  const raw = await req.text();

  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let payload: WaWebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // No es JSON válido → lo pasamos igual y salimos.
    await forwardToChatwoot(raw);
    return NextResponse.json({ ok: true, ignored: "no_json" });
  }

  // Log de tipos de mensaje recibidos (para diagnóstico en Vercel logs).
  try {
    const types = (payload.entry || []).flatMap((e) =>
      (e.changes || []).flatMap((c) =>
        (c.value?.messages || []).map((m) => m.type ?? "?"),
      ),
    );
    if (types.length) console.log("[wa/webhook] msg types:", JSON.stringify(types));
  } catch {}

  // Caso rápido y mayoritario: no hay pedidos → passthrough byte-idéntico.
  if (!hasOrders(payload)) {
    await forwardToChatwoot(raw);
    return NextResponse.json({ ok: true, orders: 0 });
  }

  // Hay pedidos: reenviamos el resto (sin las burbujas vacías) e inyectamos.
  const stripped = stripOrders(payload);
  if (stripped) {
    await forwardToChatwoot(JSON.stringify(stripped));
  }

  const orders = extractOrders(payload);
  let injected = 0;
  const errors: string[] = [];

  if (isChatwootConfigured()) {
    for (const o of orders) {
      try {
        const content = await formatOrder(o.order);
        const ok = await injectIncomingText({ waId: o.waId, name: o.name, content });
        if (ok) injected++;
        else errors.push(`no se posteó (${o.waId})`);
      } catch (e) {
        console.error("[wa/webhook] inyección falló:", e);
        errors.push(String((e as Error)?.message || e));
      }
    }
  } else {
    console.warn("[wa/webhook] pedidos detectados pero Chatwoot no está configurado");
  }

  // Siempre 200: Meta no debe reintentar por errores de inyección.
  return NextResponse.json({ ok: true, orders: orders.length, injected, errors });
}
