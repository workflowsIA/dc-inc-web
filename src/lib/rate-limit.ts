/**
 * Rate limiting server-side para las APIs de dc-inc-web.
 *
 * Por qué: Zod valida la FORMA del payload, no el VOLUMEN. Sin esto, cualquiera
 * puede pegarle a /api/orders o /api/lead miles de veces con payloads válidos y
 * (a) llenar Sanity de pedidos basura, (b) inundar el CRM de Monday con tarjetas,
 * (c) hacernos gastar invocaciones de Vercel / requests de Sanity.
 *
 * Diseño: dos backends, misma interfaz.
 *   - Si están UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → contador
 *     distribuido en Redis (correcto en serverless: todas las lambdas comparten
 *     el contador).
 *   - Si no → contador en memoria del proceso. Es por instancia de lambda, así
 *     que un atacante distribuido puede pasar más de lo configurado, pero frena
 *     el caso real (un script pegando desde una IP) sin pedir infraestructura.
 *
 * No agrega dependencias: Upstash se usa por su REST API con fetch, así que esto
 * funciona igual en Node runtime y en Edge/middleware.
 */

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Segundos hasta que se libere el cupo. Solo tiene sentido si ok === false. */
  retryAfter: number;
};

export type RateLimitOptions = {
  /** Identificador del recurso, p.ej. "orders". Se combina con la IP. */
  bucket: string;
  /** Cantidad de requests permitidos por ventana. */
  limit: number;
  /** Largo de la ventana en segundos. */
  windowSec: number;
  /**
   * Identidad a limitar. Por defecto la IP del request. Pasar un userId cuando
   * el endpoint es autenticado y querés limitar por usuario y no por IP.
   */
  identifier?: string;
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

/**
 * IP del cliente. En Vercel viene en x-forwarded-for (el primero de la lista es
 * el cliente real; los siguientes son proxies). Si no hay nada usable devuelve
 * "unknown", que agrupa a todos los desconocidos en un mismo cupo — a propósito:
 * preferimos ser estrictos con tráfico que no podemos identificar.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/* ------------------------------------------------------------------ */
/* Backend en memoria                                                  */
/* ------------------------------------------------------------------ */

type Counter = { count: number; resetAt: number };
const memory = new Map<string, Counter>();
/** Cota para que un flood con IPs distintas no haga crecer el Map sin límite. */
const MEMORY_MAX_KEYS = 10_000;

function memoryHit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSec * 1000;

  const current = memory.get(key);
  if (!current || current.resetAt <= now) {
    if (memory.size >= MEMORY_MAX_KEYS) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
      // Si después de limpiar los vencidos sigue lleno, vaciamos: preferimos
      // perder precisión antes que consumir memoria sin techo.
      if (memory.size >= MEMORY_MAX_KEYS) memory.clear();
    }
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit, remaining: limit - 1, retryAfter: 0 };
  }

  current.count += 1;
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  if (current.count > limit) {
    return { ok: false, limit, remaining: 0, retryAfter };
  }
  return { ok: true, limit, remaining: limit - current.count, retryAfter: 0 };
}

/* ------------------------------------------------------------------ */
/* Backend Upstash (REST)                                              */
/* ------------------------------------------------------------------ */

/**
 * INCR + EXPIRE en un pipeline. Si la clave es nueva (valor 1) le ponemos TTL;
 * si ya existía, el TTL original sigue corriendo → ventana fija por período.
 */
async function upstashHit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["TTL", key],
    ]),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`upstash ${res.status}`);

  const data = (await res.json()) as Array<{ result: number }>;
  const count = Number(data[0]?.result ?? 0);
  let ttl = Number(data[1]?.result ?? -1);

  if (ttl < 0) {
    // Clave sin TTL (recién creada, o alguien la creó sin expiración).
    await fetch(`${UPSTASH_URL}/expire/${encodeURIComponent(key)}/${windowSec}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      cache: "no-store",
    });
    ttl = windowSec;
  }

  if (count > limit) {
    return { ok: false, limit, remaining: 0, retryAfter: Math.max(1, ttl) };
  }
  return { ok: true, limit, remaining: Math.max(0, limit - count), retryAfter: 0 };
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

/**
 * Registra un hit y dice si el request puede seguir.
 *
 * Nunca tira: si el backend remoto falla, deja pasar el request (fail-open).
 * Un Redis caído no puede tumbar el checkout.
 */
export async function rateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { bucket, limit, windowSec } = opts;
  const id = opts.identifier ?? clientIp(req);
  const key = `rl:${bucket}:${id}`;

  if (hasUpstash) {
    try {
      return await upstashHit(key, limit, windowSec);
    } catch {
      // Cae al contador local en vez de bloquear o de dejar pasar todo.
      return memoryHit(key, limit, windowSec);
    }
  }
  return memoryHit(key, limit, windowSec);
}

/** Headers estándar para que el cliente sepa cuánto cupo le queda. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
  };
  if (!r.ok) h["Retry-After"] = String(r.retryAfter);
  return h;
}

/** Respuesta 429 lista para devolver desde un route handler. */
export function tooManyRequests(r: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Demasiados intentos. Probá de nuevo en unos segundos.",
    }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", ...rateLimitHeaders(r) },
    },
  );
}

/**
 * Atajo para el patrón de siempre en un route handler:
 *
 *   const limited = await guard(req, LIMITS.orders);
 *   if (limited) return limited;
 *
 * Devuelve null si el request puede seguir, o la Response 429 si hay que cortar.
 */
export async function guard(
  req: Request,
  opts: RateLimitOptions,
): Promise<Response | null> {
  const r = await rateLimit(req, opts);
  return r.ok ? null : tooManyRequests(r);
}

/**
 * Presets por endpoint. Los números están calibrados para uso humano real:
 * un cliente cargando un pedido no pasa de un puñado de intentos por minuto.
 */
export const LIMITS = {
  /** Creación de pedidos: lo más caro (escribe en Sanity + notifica Monday). */
  orders: { bucket: "orders", limit: 10, windowSec: 60 },
  /** Formularios de contacto / cotización de decorado. */
  lead: { bucket: "lead", limit: 5, windowSec: 60 },
  /** Arranque de checkout contra Nave. */
  naveCheckout: { bucket: "nave-checkout", limit: 15, windowSec: 60 },
  /** Polling del estado del pago: se llama seguido a propósito, va más alto. */
  naveStatus: { bucket: "nave-status", limit: 120, windowSec: 60 },
  /** Default para cualquier endpoint público que no tenga preset propio. */
  publicApi: { bucket: "public", limit: 60, windowSec: 60 },
} as const satisfies Record<string, RateLimitOptions>;
