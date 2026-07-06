/**
 * Integración con Monday (CRM de DC Inc).
 *
 * Uso actual: notificar registros de la tienda web en el board CRM.
 * Cuando alguien se registra (o completa datos de empresa → posible mayorista),
 * se crea un item en el board con los datos y un update con el detalle.
 * Marce se entera por las notificaciones nativas de Monday (suscribirse al
 * board o automatización "cuando se crea un item → notificar").
 *
 * GATED: si faltan MONDAY_API_TOKEN / MONDAY_BOARD_CRM_ID, todo es no-op.
 *
 * Diseño defensivo: no conocemos de antemano los IDs de columna del board,
 * así que se descubren en runtime (query de columnas, cache en memoria) y se
 * matchean por título. Si setear columnas falla, el item + update salen igual
 * (la info nunca se pierde).
 */

const MONDAY_API = "https://api.monday.com/v2";

export function isMondayConfigured(): boolean {
  return !!(process.env.MONDAY_API_TOKEN && process.env.MONDAY_BOARD_CRM_ID);
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.MONDAY_API_TOKEN ?? "",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Monday ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (data.errors?.length) {
    throw new Error(`Monday GraphQL: ${data.errors.map((e) => e.message).join("; ")}`);
  }
  if (!data.data) throw new Error("Monday: respuesta sin data");
  return data.data;
}

// --- Descubrimiento de columnas (cache en memoria del runtime) ---

interface MondayColumn {
  id: string;
  title: string;
  type: string;
}

let columnsCache: { boardId: string; columns: MondayColumn[] } | null = null;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

async function getColumns(boardId: string): Promise<MondayColumn[]> {
  if (columnsCache?.boardId === boardId) return columnsCache.columns;
  const data = await gql<{ boards: { columns: MondayColumn[] }[] }>(
    `query ($ids: [ID!]) { boards(ids: $ids) { columns { id title type } } }`,
    { ids: [boardId] },
  );
  const columns = data.boards?.[0]?.columns ?? [];
  columnsCache = { boardId, columns };
  return columns;
}

function findCol(cols: MondayColumn[], candidates: string[], type?: string): MondayColumn | undefined {
  for (const c of candidates) {
    const hit = cols.find(
      (col) => norm(col.title).includes(norm(c)) && (!type || col.type === type),
    );
    if (hit) return hit;
  }
  return undefined;
}

// --- Notificación de registro ---

export interface SignupNotification {
  kind: "registro" | "solicitud_mayorista";
  nombre?: string;
  empresa?: string;
  email?: string;
  cuit?: string;
  telefono?: string;
  clerkUserId: string;
}

function updateBody(n: SignupNotification): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const studioLink = site
    ? `${site}/admin/intent/edit/id=customer-${n.clerkUserId};type=customer`
    : "";
  const lines = [
    n.kind === "solicitud_mayorista"
      ? "🏷️ Completó datos de empresa — POSIBLE MAYORISTA. Revisar y aprobar desde el Studio."
      : "🆕 Nuevo registro en la tienda web.",
    "",
    `Nombre: ${n.nombre || "—"}`,
    `Empresa: ${n.empresa || "—"}`,
    `Email: ${n.email || "—"}`,
    `CUIT: ${n.cuit || "—"}`,
    `Teléfono: ${n.telefono || "—"}`,
  ];
  if (studioLink) lines.push("", `Ficha en el backend: ${studioLink}`);
  return lines.join("\n");
}

/**
 * Crea el item en el board CRM (+ update con el detalle). Devuelve el itemId
 * de Monday, o null si Monday no está configurado.
 * Lanza si Monday rechaza la creación del item (el caller decide si es fatal).
 */
export async function notifyCustomerSignup(n: SignupNotification): Promise<string | null> {
  if (!isMondayConfigured()) return null;
  const boardId = process.env.MONDAY_BOARD_CRM_ID as string;
  const groupId = process.env.MONDAY_CRM_GROUP_ID; // opcional; default: primer grupo

  const display = n.empresa || n.nombre || n.email || "Cliente web";
  const itemName =
    n.kind === "solicitud_mayorista"
      ? `${display} — Solicita MAYORISTA (web)`
      : `${display} — Registro web`;

  // 1) Crear el item pelado (nunca falla por columnas).
  const created = await gql<{ create_item: { id: string } }>(
    `mutation ($board: ID!, $group: String, $name: String!) {
       create_item(board_id: $board, group_id: $group, item_name: $name) { id }
     }`,
    { board: boardId, group: groupId || undefined, name: itemName },
  );
  const itemId = created.create_item.id;

  // 2) Setear columnas conocidas, best-effort (si falla, seguimos igual).
  try {
    const cols = await getColumns(boardId);
    const values: Record<string, unknown> = {};
    const colEmail = findCol(cols, ["email", "mail"], "email");
    const colPhone = findCol(cols, ["telefono", "teléfono", "celular", "phone"], "phone");
    const colCuit = findCol(cols, ["cuit"]);
    const colEmpresa = findCol(cols, ["empresa", "razon social"]);
    const colOrigen = findCol(cols, ["origen"], "status");
    if (colEmail && n.email) values[colEmail.id] = { email: n.email, text: n.email };
    if (colPhone && n.telefono)
      values[colPhone.id] = { phone: n.telefono.replace(/[^\d+]/g, ""), countryShortName: "AR" };
    if (colCuit && n.cuit) values[colCuit.id] = n.cuit;
    if (colEmpresa && n.empresa) values[colEmpresa.id] = n.empresa;
    if (colOrigen) values[colOrigen.id] = { label: "Web" };
    if (Object.keys(values).length > 0) {
      await gql(
        `mutation ($board: ID!, $item: ID!, $values: JSON!) {
           change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id }
         }`,
        { board: boardId, item: itemId, values: JSON.stringify(values) },
      );
    }
  } catch (err) {
    console.warn("[monday] no se pudieron setear columnas (sigo igual):", err);
  }

  // 3) Update con el detalle completo (best-effort).
  try {
    await gql(
      `mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`,
      { item: itemId, body: updateBody(n) },
    );
  } catch (err) {
    console.warn("[monday] no se pudo crear el update:", err);
  }

  return itemId;
}

/** Agrega un update a un item existente (ej: registro que después pide mayorista). */
export async function addSignupUpdate(itemId: string, n: SignupNotification): Promise<void> {
  if (!isMondayConfigured()) return;
  await gql(
    `mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`,
    { item: itemId, body: updateBody(n) },
  );
}
