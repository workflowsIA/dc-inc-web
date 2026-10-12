/**
 * Cotizador EN VIVO de Andreani (API REST, cuenta "paquetería" de DC Inc).
 *
 * SOLO SERVER: lee las credenciales de variables de entorno. Nunca importarlo
 * desde un componente "use client".
 *
 * Qué hace: reemplaza la TABLA de tarifas por banda (shipping.ts →
 * rateForBulto) por el precio que devuelve Andreani para cada paquete. Todo lo
 * demás (consolidación de bultos, tope de 50 kg, "a cotizar" sin peso, Batu en
 * CABA/GBA, mayorista) sigue exactamente igual, porque se usa el mismo
 * andreaniPlan() que la tabla.
 *
 * Si la API falla, tarda o no está configurada → se cae a la tabla, en
 * silencio para el cliente (queda en el log). El checkout nunca se rompe por
 * Andreani.
 *
 * Activación: ANDREANI_API=on + credenciales. Sin eso, la web calcula como
 * siempre. Ver .env.example.
 *
 * Contratos (mail de Marce 9-oct-2026, cliente 0000126886). Para la API se
 * usan los números "WS"; los "A.COM" son para cargar envíos en el panel web.
 *   Entrega estándar (a domicilio) ........ WS 400043741  ← el que usa la web
 *   Sucursal (retira en sucursal Andreani)  WS 400043743  ← futuro, opcional
 *   Cambio / retiro en domicilio o sucursal  WS 400043745-51 (postventa, no web)
 *
 * API (developers.andreani.com):
 *   GET {base}/login  con Basic auth → header `x-authorization-token` (24 h)
 *   GET {base}/v1/tarifas?cpDestino&contrato&cliente[&sucursalOrigen]
 *       &bultos[0][kilos]&bultos[0][valorDeclarado]
 *   → { tarifaConIva: { total, distribucion, seguroDistribucion },
 *       tarifaSinIva: { … }, pesoAforado (EN GRAMOS) }
 *
 * Medido contra la API real el 12-oct-2026 (contrato 400043741, a Salta):
 *  - `bultos[0][pesoAforado]` se IGNORA para el precio (siempre da el
 *    mínimo). El peso va en `kilos`.
 *  - Aforo del contrato = 350 kg/m³ (60×60×60 → 75,6 kg), ver AFORO_DIVISOR.
 *  - Seguro = 2% del valor declarado + IVA (declarado $30.000 → $726).
 *  - Precio: mínimo plano y después ~lineal por kg (1 kg $17.368,
 *    20 kg $40.269, 49 kg $78.164 con IVA).
 */

import {
  andreaniPlan,
  DEFAULT_SHIPPING_CONFIG,
  effectiveBatuZone,
  normalizeCp,
  shippingEstimate,
  type Bulto,
  type ShippingConfig,
  type ShippingQuote,
} from "./shipping";

const PROD_URL = "https://apis.andreani.com";
const QA_URL = "https://apisqa.andreani.com";

/** Valor declarado mínimo por paquete que acepta Andreani Paquetes. */
export const VALOR_DECLARADO_MIN = 30000;

/** Cuánto esperamos a Andreani antes de caer a la tabla. El cliente está
 *  mirando el carrito: más de esto se siente roto. */
const TIMEOUT_MS = 4000;

/** Cuánto dura una cotización en memoria. Las tarifas no cambian en el día, y
 *  así el carrito y /api/orders (que cotizan lo mismo con segundos de
 *  diferencia) dan el mismo número sin pegarle dos veces a Andreani. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 1000;

export interface AndreaniEnv {
  base: string;
  user: string;
  pass: string;
  cliente: string;
  contratoDomicilio: string;
  sucursalOrigen?: string;
}

/** Credenciales del env. `ignoreFlag` = leerlas aunque ANDREANI_API no esté
 *  en "on" (lo usa el script de prueba, para probar sin prender la web). */
export function readEnv(ignoreFlag = false): AndreaniEnv | null {
  if (!ignoreFlag && (process.env.ANDREANI_API ?? "").toLowerCase() !== "on") return null;
  const user = process.env.ANDREANI_USER;
  const pass = process.env.ANDREANI_PASSWORD;
  const cliente = process.env.ANDREANI_CLIENTE;
  const contratoDomicilio = process.env.ANDREANI_CONTRATO_DOMICILIO;
  if (!user || !pass || !cliente || !contratoDomicilio) return null;
  const env = (process.env.ANDREANI_ENV ?? "prod").toLowerCase();
  return {
    base: env === "qa" ? QA_URL : PROD_URL,
    user,
    pass,
    cliente,
    contratoDomicilio,
    sucursalOrigen: process.env.ANDREANI_SUCURSAL_ORIGEN || undefined,
  };
}

/** ¿Está prendida la cotización en vivo? (flag + credenciales completas) */
export function andreaniApiEnabled(): boolean {
  return readEnv() !== null;
}

/* ── token ─────────────────────────────────────────────────── */

let tokenCache: { token: string; exp: number } | null = null;

async function fetchWithTimeout(url: string, init: RequestInit, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function getToken(env: AndreaniEnv, force = false): Promise<string> {
  if (!force && tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;
  const auth = Buffer.from(`${env.user}:${env.pass}`).toString("base64");
  const res = await fetchWithTimeout(`${env.base}/login`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  const token = res.headers.get("x-authorization-token");
  if (!res.ok || !token) throw new Error(`andreani login ${res.status}`);
  // El token dura 24 h; lo renovamos a las 23 para no usar uno vencido.
  tokenCache = { token, exp: Date.now() + 23 * 60 * 60 * 1000 };
  return token;
}

/* ── tarifa de un paquete ──────────────────────────────────── */

const quoteCache = new Map<string, { total: number; exp: number }>();

function cacheGet(key: string): number | null {
  const hit = quoteCache.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    quoteCache.delete(key);
    return null;
  }
  return hit.total;
}

function cacheSet(key: string, total: number): void {
  if (quoteCache.size >= CACHE_MAX) {
    const first = quoteCache.keys().next().value;
    if (first !== undefined) quoteCache.delete(first);
  }
  quoteCache.set(key, { total, exp: Date.now() + CACHE_TTL_MS });
}

export interface PaqueteTarifa {
  /** total con IVA (misma base que la tabla: SHIPPING_RATES_INCLUDE_IVA) */
  conIva: number;
  sinIva: number | null;
  /** peso aforado con el que cotizó Andreani */
  pesoAforado: number | null;
  raw: unknown;
}

/**
 * Cotiza UN paquete a domicilio. Tira error si Andreani no responde bien:
 * quien llame decide el fallback.
 */
export async function cotizarPaquete(
  cp: string,
  kgAforado: number,
  valorDeclarado: number,
  envOverride?: AndreaniEnv,
): Promise<PaqueteTarifa> {
  const env = envOverride ?? readEnv();
  if (!env) throw new Error("andreani api off");
  const params = new URLSearchParams({
    cpDestino: cp,
    contrato: env.contratoDomicilio,
    cliente: env.cliente,
  });
  if (env.sucursalOrigen) params.set("sucursalOrigen", env.sucursalOrigen);
  // Mandamos el peso YA AFORADO como `kilos` (sin medidas, así Andreani no
  // vuelve a aforar): es el mismo número con el que consolidar() armó los
  // paquetes, así Andreani cotiza exactamente el paquete que sale del
  // depósito. OJO: el campo `pesoAforado` existe pero la API lo ignora.
  params.set("bultos[0][kilos]", String(Math.round(kgAforado * 100) / 100));
  params.set("bultos[0][valorDeclarado]", String(Math.round(valorDeclarado)));
  const url = `${env.base}/v1/tarifas?${params.toString()}`;

  let token = await getToken(env);
  let res = await fetchWithTimeout(url, { headers: { "x-authorization-token": token } });
  if (res.status === 401 || res.status === 403) {
    // Token vencido o revocado: un reintento con login nuevo.
    token = await getToken(env, true);
    res = await fetchWithTimeout(url, { headers: { "x-authorization-token": token } });
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) throw new Error(`andreani tarifas ${res.status} ${JSON.stringify(json)?.slice(0, 300)}`);
  const conIva = Number((json.tarifaConIva as { total?: unknown } | undefined)?.total);
  const sinIvaRaw = Number((json.tarifaSinIva as { total?: unknown } | undefined)?.total);
  if (!(conIva > 0)) throw new Error(`andreani tarifas sin total: ${JSON.stringify(json).slice(0, 300)}`);
  // La API devuelve el aforado en GRAMOS.
  const af = Number(json.pesoAforado) / 1000;
  return {
    conIva,
    sinIva: sinIvaRaw > 0 ? sinIvaRaw : null,
    pesoAforado: af > 0 ? af : null,
    raw: json,
  };
}

/* ── pedido completo ───────────────────────────────────────── */

/**
 * Valor declarado de cada paquete: el valor de los productos (con IVA)
 * repartido según el peso, con el mínimo de Andreani por paquete. Es lo que
 * cubre el seguro si el paquete se rompe o se pierde.
 */
export function valoresDeclarados(paquetes: number[], valorProductos: number): number[] {
  const kgTotal = paquetes.reduce((a, b) => a + b, 0);
  return paquetes.map((kg) => {
    const parte = kgTotal > 0 ? (valorProductos * kg) / kgTotal : 0;
    return Math.max(VALOR_DECLARADO_MIN, Math.round(parte));
  });
}

/**
 * Igual que andreaniQuote() de shipping.ts, pero tarifando cada paquete contra
 * la API. Si un solo paquete falla, el pedido entero vuelve a la tabla (no se
 * mezclan precios de la API con precios de tabla en un mismo envío).
 */
export async function andreaniQuoteLive(
  cp: string | undefined | null,
  bultos: Bulto[],
  valorProductos: number,
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): Promise<ShippingQuote> {
  const plan = andreaniPlan(cp, bultos, cfg);
  if ("quote" in plan) return plan.quote; // a cotizar / vacío / tabla no aplica
  const table: ShippingQuote = { total: plan.tableTotal, toQuote: false, source: "tabla" };
  const env = readEnv();
  const cpNorm = normalizeCp(cp);
  if (!env || !cpNorm) return table;
  const valores = valoresDeclarados(plan.paquetes, valorProductos);
  try {
    const precios = await Promise.all(
      plan.paquetes.map(async (kg, i) => {
        const key = `${env.base}|${env.contratoDomicilio}|${cpNorm}|${kg.toFixed(2)}|${valores[i]}`;
        const hit = cacheGet(key);
        if (hit !== null) return hit;
        const r = await cotizarPaquete(cpNorm, kg, valores[i], env);
        cacheSet(key, r.conIva);
        return r.conIva;
      }),
    );
    const total = Math.round(precios.reduce((a, b) => a + b, 0) * 100) / 100;
    return { total, toQuote: false, source: "api" };
  } catch (err) {
    console.error("[andreani] cotización en vivo falló, uso la tabla:", err);
    return table;
  }
}

/**
 * Estimador unificado con Andreani en vivo. Misma lógica de ruteo que
 * shippingEstimate(): mayorista, Batu, modo "cotizar" → sin cambios; solo el
 * camino Andreani (interior) pasa por la API.
 */
export async function shippingEstimateLive(
  opts: Parameters<typeof shippingEstimate>[0] & { valorProductos: number },
  cfg: ShippingConfig = DEFAULT_SHIPPING_CONFIG,
): Promise<ShippingQuote> {
  const base = shippingEstimate(opts, cfg);
  const viaAndreani =
    !opts.wholesale &&
    !effectiveBatuZone(opts.cp, opts.batuZone) &&
    cfg.andreaniMode !== "cotizar" &&
    !base.toQuote;
  if (!viaAndreani || !andreaniApiEnabled()) return base;
  return andreaniQuoteLive(opts.cp, opts.detalle ?? [{ kg: null, cantidad: opts.bultos ?? 1 }], opts.valorProductos, cfg);
}
