/**
 * Integración con Nave (pasarela de Banco Galicia, plataforma Ranty / Naranja X).
 *
 * Modelo: checkout por redirección. Flujo:
 *   1. OAuth2 M2M (client_credentials) → access_token (válido ~24h).
 *   2. Crear "intención de pago" (payment_request/ecommerce) con el monto del
 *      pedido → devuelve `checkout_url` (y `qr_data`).
 *   3. Redirigir al cliente al `checkout_url`. Al terminar vuelve al
 *      `callback_url` (/checkout/gracias).
 *   4. Nave notifica por webhook (notification_url) cada cambio de estado; ahí
 *      re-consultamos el pago y marcamos el pedido pagado (fuente de verdad).
 *
 * GATED: si faltan NAVE_CLIENT_ID / NAVE_CLIENT_SECRET / NAVE_POS_ID, la
 * integración queda desactivada y el sitio no la ofrece.
 *
 * Endpoints (sandbox vs producción) según NAVE_ENV.
 * Doc: https://navenegocios.ar/home/developers
 */

export type NaveEnv = "sandbox" | "production";

const ENDPOINTS = {
  sandbox: {
    auth: "https://homoservices.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate",
    api: "https://api-sandbox.ranty.io",
  },
  production: {
    auth: "https://services.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate",
    api: "https://api.ranty.io",
  },
} as const;

const AUDIENCE = "https://naranja.com/ranty/merchants/api";

export function naveEnv(): NaveEnv {
  return process.env.NAVE_ENV === "production" ? "production" : "sandbox";
}

/** True si el pago con Nave está configurado en el server. */
export function isNaveConfigured(): boolean {
  return !!(
    process.env.NAVE_CLIENT_ID &&
    process.env.NAVE_CLIENT_SECRET &&
    process.env.NAVE_POS_ID
  );
}

export function naveSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// --- Token OAuth M2M (cache en memoria del runtime) ---
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const env = naveEnv();
  const res = await fetch(ENDPOINTS[env].auth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NAVE_CLIENT_ID,
      client_secret: process.env.NAVE_CLIENT_SECRET,
      audience: AUDIENCE,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nave auth ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Nave auth: sin access_token");
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 86400;
  tokenCache = { token: data.access_token, expiresAt: now + expiresIn * 1000 };
  return data.access_token;
}

// --- Crear intención de pago ---
export interface CreateIntentionInput {
  /** ≤ 36 chars, único por pedido — lo usamos para conciliar el webhook. */
  externalPaymentId: string;
  /** Monto total en ARS. */
  amount: number;
  description?: string;
  callbackUrl: string;
  buyerEmail?: string;
  /** Expiración de la intención en segundos (default ~1 semana en Nave). */
  durationTime?: number;
}

export interface CreateIntentionResult {
  id: string;
  checkoutUrl: string;
  qrData?: string;
}

export async function createPaymentIntention(
  input: CreateIntentionInput,
): Promise<CreateIntentionResult> {
  const env = naveEnv();
  const token = await getAccessToken();

  // Nave exige el monto como STRING con 2 decimales, y los products ANIDADOS
  // dentro de cada transaction (con unit_price). Ver doc "Checkout con Nave".
  const value = input.amount.toFixed(2);
  const body: Record<string, unknown> = {
    external_payment_id: input.externalPaymentId.slice(0, 36),
    seller: { pos_id: process.env.NAVE_POS_ID },
    transactions: [
      {
        amount: { currency: "ARS", value },
        products: [
          {
            name: input.description || "Pedido DC Inc",
            quantity: 1,
            unit_price: { currency: "ARS", value },
          },
        ],
      },
    ],
    additional_info: { callback_url: input.callbackUrl },
  };
  if (input.buyerEmail) body.buyer = { user_email: input.buyerEmail };
  if (input.durationTime) body.duration_time = input.durationTime;

  const res = await fetch(`${ENDPOINTS[env].api}/api/payment_request/ecommerce`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nave intention ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    id?: string | number;
    checkout_url?: string;
    qr_data?: string;
  };
  if (!data.checkout_url) throw new Error("Nave intention: sin checkout_url");
  return {
    id: String(data.id ?? ""),
    checkoutUrl: data.checkout_url,
    qrData: data.qr_data,
  };
}

// --- Consultar un pago (fuente de verdad del estado) ---
export interface NavePayment {
  status?: string; // PENDING | APPROVED | REJECTED | ...
  external_payment_id?: string;
  id?: string | number;
}

/** Usa el payment_check_url que manda el webhook (preferido). */
export async function getPaymentByCheckUrl(checkUrl: string): Promise<NavePayment> {
  const token = await getAccessToken();
  const res = await fetch(checkUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Nave payment check ${res.status}`);
  return (await res.json()) as NavePayment;
}

/** Alternativa: consulta por payment_id contra la API. */
export async function getPaymentById(paymentId: string): Promise<NavePayment> {
  const env = naveEnv();
  const token = await getAccessToken();
  const res = await fetch(
    `${ENDPOINTS[env].api}/ranty-payments/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Nave payment ${res.status}`);
  return (await res.json()) as NavePayment;
}
