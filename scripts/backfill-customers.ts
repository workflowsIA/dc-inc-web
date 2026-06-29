/**
 * Backfill de clientes: lee todas las cuentas de Clerk y crea/actualiza su
 * documento espejo `customer` en Sanity. Correr una vez (y cuando haga falta
 * resincronizar todo).
 *
 *   npm run backfill:customers
 *
 * Requiere en .env.local: CLERK_SECRET_KEY + SANITY_API_WRITE_TOKEN.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { upsertCustomer, roleToEstado } from "../src/lib/clerk-sync";

async function main() {
  const clerk = await clerkClient();
  const limit = 100;
  let offset = 0;
  let total = 0;

  for (;;) {
    const { data: users } = await clerk.users.getUserList({ limit, offset });
    if (users.length === 0) break;

    for (const u of users) {
      const md = (u.unsafeMetadata ?? {}) as Record<string, string>;
      const role = (u.publicMetadata as { role?: string } | undefined)?.role;
      const email =
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
        u.emailAddresses[0]?.emailAddress;
      await upsertCustomer({
        clerkUserId: u.id,
        nombre: [u.firstName, u.lastName].filter(Boolean).join(" ") || md.contacto || "",
        empresa: md.empresa ?? "",
        email: email ?? "",
        cuit: md.cuit ?? "",
        telefono: md.telefono ?? "",
        estado: roleToEstado(role),
        registeredAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
      });
      total += 1;
    }
    offset += users.length;
    if (users.length < limit) break;
  }

  console.log(`Backfill OK: ${total} clientes sincronizados a Sanity.`);
}

main().catch((err) => {
  console.error("Backfill falló:", err);
  process.exit(1);
});
