/**
 * Sincronización Clerk → Sanity de cuentas de clientes.
 *
 * El login vive en Clerk; acá mantenemos un documento `customer` espejo en
 * Sanity para verlo/gestionarlo en el Studio. Usado por el webhook de Clerk
 * (/api/clerk/webhook) y por el backfill (scripts/backfill-customers.ts).
 *
 * Mapeo role(Clerk) ↔ estado(Sanity):
 *   customer → cliente_final · pending → en_revision · wholesale → mayorista
 *   visitor → visitante · admin → admin · rejected → rechazado
 */
import { sanityWriteClient } from "./sanity";

export type Estado =
  | "cliente_final"
  | "en_revision"
  | "mayorista"
  | "rechazado"
  | "visitante"
  | "admin";

export function roleToEstado(role?: string): Estado {
  switch (role) {
    case "wholesale":
      return "mayorista";
    case "admin":
      return "admin";
    case "visitor":
      return "visitante";
    case "rejected":
      return "rechazado";
    case "customer":
      return "cliente_final";
    case "pending":
      return "en_revision";
    default:
      // Sin rol conocido = cliente final normal (NO "en revisión": eso queda
      // solo para quien pidió alta mayorista, ver customerFieldsFromWebhook).
      return "cliente_final";
  }
}

export function estadoToRole(estado?: string): string {
  switch (estado) {
    case "mayorista":
      return "wholesale";
    case "admin":
      return "admin";
    case "rechazado":
    case "visitante":
      return "visitor";
    case "cliente_final":
      return "customer";
    case "en_revision":
      return "pending";
    default:
      return "customer";
  }
}

export function customerDocId(clerkUserId: string): string {
  return `customer-${clerkUserId}`;
}

export interface CustomerFields {
  clerkUserId: string;
  nombre?: string;
  empresa?: string;
  email?: string;
  cuit?: string;
  telefono?: string;
  estado: Estado;
  registeredAt?: string;
  /** Item del board CRM de Monday asociado (notificación de registro). */
  mondayItemId?: string;
}

/** Lee el doc espejo actual (o null). Útil para detectar transiciones. */
export async function getCustomer(
  clerkUserId: string,
): Promise<(CustomerFields & { _id: string }) | null> {
  return sanityWriteClient.fetch(
    `*[_id == $id][0]{ _id, clerkUserId, nombre, empresa, email, cuit, telefono, estado, mondayItemId }`,
    { id: customerDocId(clerkUserId) },
  );
}

/** Crea o reemplaza el documento espejo del cliente en Sanity. */
export async function upsertCustomer(f: CustomerFields): Promise<void> {
  await sanityWriteClient.createOrReplace({
    _id: customerDocId(f.clerkUserId),
    _type: "customer",
    clerkUserId: f.clerkUserId,
    nombre: f.nombre ?? "",
    empresa: f.empresa ?? "",
    email: f.email ?? "",
    cuit: f.cuit ?? "",
    telefono: f.telefono ?? "",
    estado: f.estado,
    registeredAt: f.registeredAt,
    ...(f.mondayItemId ? { mondayItemId: f.mondayItemId } : {}),
    lastSyncedAt: new Date().toISOString(),
  });
}

/** Guarda el itemId de Monday en el doc espejo (post-notificación). */
export async function setCustomerMondayItem(
  clerkUserId: string,
  mondayItemId: string,
): Promise<void> {
  await sanityWriteClient
    .patch(customerDocId(clerkUserId))
    .set({ mondayItemId })
    .commit()
    .catch(() => {});
}

export async function deleteCustomer(clerkUserId: string): Promise<void> {
  await sanityWriteClient.delete(customerDocId(clerkUserId)).catch(() => {});
}

// --- Adaptador desde el payload del webhook de Clerk (snake_case) ---
export interface ClerkWebhookUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
  public_metadata?: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
  created_at?: number;
}

export function customerFieldsFromWebhook(u: ClerkWebhookUser): CustomerFields {
  const md = (u.unsafe_metadata ?? {}) as Record<string, string>;
  const role = (u.public_metadata as { role?: string } | undefined)?.role;
  // ¿Pidió alta mayorista? Se detecta por haber completado empresa o CUIT.
  const hasCompanyData = !!(md.empresa || md.cuit);
  const primaryEmail =
    u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ??
    u.email_addresses?.[0]?.email_address;
  return {
    clerkUserId: u.id,
    nombre: [u.first_name, u.last_name].filter(Boolean).join(" ") || md.contacto || "",
    empresa: md.empresa ?? "",
    email: primaryEmail ?? "",
    cuit: md.cuit ?? "",
    telefono: md.telefono ?? "",
    // Si ya tiene rol asignado (aprobado/rechazado), lo respetamos. Si es un
    // registro sin rol: "en revisión" SOLO si pidió alta mayorista (dio empresa/
    // CUIT); de lo contrario es un cliente final normal.
    estado: role ? roleToEstado(role) : hasCompanyData ? "en_revision" : "cliente_final",
    registeredAt: u.created_at ? new Date(u.created_at).toISOString() : undefined,
  };
}
