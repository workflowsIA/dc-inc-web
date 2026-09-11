/**
 * Migración one-shot: da de alta en el Clerk de PRODUCTION a los clientes que
 * hoy solo existen aprobados en el Clerk de DEVELOPMENT (pre-cutover 5-sep-2026).
 *
 * Por qué existe: hasta el cutover, todo el alta/aprobación de mayoristas pasó
 * por el Clerk de Development. Production es una base de usuarios DISTINTA y
 * arrancó vacía — nadie de ahí existe en prod salvo que ya haya vuelto a
 * loguearse en el sitio real (y en ese caso arranca como "customer" de cero).
 * Esto lee los documentos `customer` de Sanity con estado mayorista/admin
 * (la fuente de verdad de quién está aprobado) y, por email:
 *   - si ya existe un usuario con ese mail en Production → le actualiza
 *     publicMetadata.role (y completa datos de empresa si faltan), SIN pisar
 *     nada que el usuario ya haya cargado en su cuenta real.
 *   - si no existe → lo crea en Production con el mismo mail + metadata, para
 *     que la primera vez que esa persona use Google/mail en el sitio real,
 *     Clerk enganche esa cuenta pre-creada (matchea por email verificado).
 * En los dos casos, deja/actualiza el documento espejo en Sanity apuntando al
 * ID de Production (customer-<id-prod>), para que el flujo normal de
 * aprobación (Sanity → webhook → Clerk) seguido funcione con esa cuenta.
 *
 * Los documentos viejos (apuntando al ID de Development) quedan intactos pero
 * huérfanos — no los borra, así se pueden revisar antes de limpiarlos.
 *
 * USO:
 *   npm run migrate:customers            → dry-run (no escribe nada, solo lista)
 *   npm run migrate:customers -- --apply → ejecuta de verdad
 *
 * Requiere en .env.local:
 *   SANITY_API_WRITE_TOKEN  (el de siempre)
 *   CLERK_SECRET_KEY_PROD   (Clerk dashboard → DC Inc Web → Production →
 *                            Configure → API keys → Secret key, sk_live_...)
 */
import { createClerkClient } from "@clerk/backend";
import { sanityWriteClient } from "../src/lib/sanity";
import { upsertCustomer, customerDocId, estadoToRole, type Estado } from "../src/lib/clerk-sync";

const APPLY = process.argv.includes("--apply");

interface SanityCustomer {
  _id: string;
  clerkUserId: string;
  nombre?: string;
  empresa?: string;
  email?: string;
  cuit?: string;
  telefono?: string;
  estado: Estado;
  registeredAt?: string;
}

async function main() {
  const prodSecret = process.env.CLERK_SECRET_KEY_PROD;
  if (!prodSecret) {
    console.error("Falta CLERK_SECRET_KEY_PROD en .env.local (Clerk → Production → API keys).");
    process.exit(1);
  }
  if (!prodSecret.startsWith("sk_live_")) {
    console.error(`CLERK_SECRET_KEY_PROD no parece una live key (empieza "${prodSecret.slice(0, 8)}..."). Frená y confirmá.`);
    process.exit(1);
  }
  const prodClerk = createClerkClient({ secretKey: prodSecret });

  const customers = await sanityWriteClient.fetch<SanityCustomer[]>(
    `*[_type == "customer" && estado in ["mayorista", "admin"] && defined(email) && email != ""]{
      _id, clerkUserId, nombre, empresa, email, cuit, telefono, estado, registeredAt
    }`,
  );

  console.log(`Encontrados ${customers.length} clientes mayorista/admin en Sanity.\n`);

  // Dedup por email (case-insensitive) — si dos docs viejos comparten mail,
  // solo migramos el primero y avisamos del resto.
  const seen = new Map<string, SanityCustomer>();
  const dupes: SanityCustomer[] = [];
  for (const c of customers) {
    const key = c.email!.trim().toLowerCase();
    if (seen.has(key)) dupes.push(c);
    else seen.set(key, c);
  }
  if (dupes.length) {
    console.log(`⚠ ${dupes.length} documentos con email duplicado (se ignoran):`);
    for (const d of dupes) console.log(`   - ${d._id} (${d.email})`);
    console.log("");
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const c of seen.values()) {
    const email = c.email!.trim();
    try {
      const existing = await prodClerk.users.getUserList({ emailAddress: [email] });
      const targetRole = estadoToRole(c.estado);

      if (existing.data.length > 0) {
        const u = existing.data[0];
        const curPub = (u.publicMetadata ?? {}) as Record<string, unknown>;
        const curUnsafe = (u.unsafeMetadata ?? {}) as Record<string, unknown>;
        console.log(`UPDATE  ${email} → prod user ${u.id} (ya existía) — role ${curPub.role ?? "(sin rol)"} → ${targetRole}`);
        if (APPLY) {
          await prodClerk.users.updateUserMetadata(u.id, {
            publicMetadata: { ...curPub, role: targetRole },
            unsafeMetadata: {
              ...curUnsafe,
              empresa: curUnsafe.empresa || c.empresa || "",
              cuit: curUnsafe.cuit || c.cuit || "",
              telefono: curUnsafe.telefono || c.telefono || "",
              contacto: curUnsafe.contacto || c.nombre || "",
            },
          });
          await upsertCustomer({
            clerkUserId: u.id,
            nombre: c.nombre ?? "",
            empresa: c.empresa ?? "",
            email,
            cuit: c.cuit ?? "",
            telefono: c.telefono ?? "",
            estado: c.estado,
            registeredAt: c.registeredAt,
          });
        }
        updated += 1;
      } else {
        console.log(`CREATE  ${email} → nuevo user en prod — role ${targetRole}`);
        if (APPLY) {
          const nameParts = (c.nombre ?? "").trim().split(/\s+/).filter(Boolean);
          const u = await prodClerk.users.createUser({
            emailAddress: [email],
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(" ") || undefined,
            publicMetadata: { role: targetRole },
            unsafeMetadata: {
              empresa: c.empresa ?? "",
              cuit: c.cuit ?? "",
              telefono: c.telefono ?? "",
              contacto: c.nombre ?? "",
            },
            skipPasswordChecks: true,
            skipPasswordRequirement: true,
          });
          console.log(`         → creado user_${u.id.slice(5, 13)}… (verificar en Clerk que el mail quedó "verified")`);
          await upsertCustomer({
            clerkUserId: u.id,
            nombre: c.nombre ?? "",
            empresa: c.empresa ?? "",
            email,
            cuit: c.cuit ?? "",
            telefono: c.telefono ?? "",
            estado: c.estado,
            registeredAt: c.registeredAt,
          });
        }
        created += 1;
      }
    } catch (err) {
      errors += 1;
      console.error(`ERROR   ${email}:`, (err as Error).message ?? err);
    }
  }

  console.log(`\n${APPLY ? "Hecho" : "Dry-run (nada escrito — correr con --apply)"}: ${created} a crear, ${updated} a actualizar, ${errors} errores.`);
}

main().catch((err) => {
  console.error("Migración falló:", err);
  process.exit(1);
});
