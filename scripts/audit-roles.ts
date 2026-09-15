/**
 * Auditoría de roles: compara el `estado` de cada cliente en Sanity contra el
 * `publicMetadata.role` del usuario en Clerk, que es lo ÚNICO que la web mira
 * para decidir si alguien ve precios mayoristas o minoristas.
 *
 *   CLERK_SECRET_KEY=sk_live_… npm run roles:audit              → solo lista
 *   CLERK_SECRET_KEY=sk_live_… npm run roles:audit -- --apply   → corrige Clerk
 *
 * OJO CON LA INSTANCIA. Clerk tiene una instancia de DESARROLLO y otra de
 * PRODUCCIÓN, con usuarios y IDs distintos. `.env.local` tiene la de desarrollo
 * (`sk_test_…`), donde hay un puñado de usuarios de prueba; la web real corre
 * con la de producción (`sk_live_…`, está en Vercel). Correr esto contra
 * desarrollo da un informe que parece válido y es basura: el 15-sep-2026 marcó
 * 33 clientes reales como "borrados" simplemente porque no existen en la
 * instancia de prueba. Por eso el script se planta si no es producción.
 *
 * La variable de entorno del shell le gana a la de `--env-file`, así que
 * anteponer `CLERK_SECRET_KEY=sk_live_…` alcanza y no hay que dejar la clave de
 * producción escrita en ningún archivo.
 *
 * Por qué existe: el 15-sep-2026 Marce figuraba "mayorista" en el Studio y en
 * Clerk seguía en `customer`, así que veía precios minoristas. El sync
 * Sanity → Clerk (/api/sanity/customer-webhook) normalmente funciona; ese
 * desfasaje quedó del cruce de bases durante el cutover del 5-sep (18 de las 39
 * cuentas se crearon esa semana, varias duplicadas). Un mayorista viendo precio
 * minorista no se queja: no compra y no te enterás. De ahí el barrido.
 *
 * SANITY MANDA. El estado del Studio es la consola del admin, así que es la
 * fuente de verdad y Clerk se acomoda. Ojo: eso significa que --apply puede
 * BAJAR a alguien de categoría si en Sanity quedó mal. Por eso cada cambio se
 * marca como ALTA o BAJA en el listado — leelo antes de aplicar.
 *
 * Requiere en .env.local: CLERK_SECRET_KEY (+ la config de Sanity de siempre).
 */
import { createClerkClient } from "@clerk/nextjs/server";
import { sanityClient } from "../src/lib/sanity";
import { estadoToRole } from "../src/lib/clerk-sync";

const APPLY = process.argv.includes("--apply");
/** Escape hatch para mirar a propósito la instancia de prueba. */
const DEV_OK = process.argv.includes("--dev");

/**
 * De qué instancia de Clerk es esta clave. El prefijo lo define Clerk:
 * `sk_live_` = producción, `sk_test_` = desarrollo.
 */
function instanciaDe(key: string): "produccion" | "desarrollo" | "desconocida" {
  if (key.startsWith("sk_live_")) return "produccion";
  if (key.startsWith("sk_test_")) return "desarrollo";
  return "desconocida";
}

interface CustomerDoc {
  _id: string;
  clerkUserId?: string;
  estado?: string;
  email?: string;
  nombre?: string;
}

/** Rol efectivo en Clerk. Sin rol explícito la web trata al usuario como cliente final. */
function clerkRole(md: unknown): string {
  return (md as { role?: string } | undefined)?.role ?? "customer";
}

/** ¿El cambio le da MÁS acceso del que tenía? Solo para etiquetar el listado. */
const RANK: Record<string, number> = {
  visitor: 0,
  rejected: 0,
  customer: 1,
  pending: 1,
  wholesale: 2,
  admin: 3,
};

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  const instancia = instanciaDe(secretKey);
  if (!secretKey) {
    console.error("Falta CLERK_SECRET_KEY.");
    process.exit(1);
  }
  console.log(`Instancia de Clerk: ${instancia.toUpperCase()}\n`);
  if (instancia !== "produccion" && !DEV_OK) {
    console.error(
      `Esta clave es de ${instancia}, no de producción.\n\n` +
        "Contra la instancia de prueba el informe es engañoso: los clientes reales\n" +
        "aparecen como inexistentes porque viven en la otra instancia.\n\n" +
        "Sacá la clave de producción de Vercel y corré:\n" +
        "  CLERK_SECRET_KEY=sk_live_… npm run roles:audit\n\n" +
        "Si de verdad querés auditar la instancia de prueba, agregá --dev.",
    );
    process.exit(1);
  }

  const docs = await sanityClient.fetch<CustomerDoc[]>(
    `*[_type=="customer"]|order(email asc){_id,clerkUserId,estado,email,nombre}`,
  );
  console.log(`Sanity: ${docs.length} clientes`);

  // Cliente explícito (no el ambiente de Next) para que la clave que se usa sea
  // exactamente la que se verificó arriba y no una que aparezca por otro lado.
  const clerk = createClerkClient({ secretKey });

  // Se traen TODOS los usuarios de Clerk de una y se indexan: así el script hace
  // un puñado de llamadas en vez de una por cliente, y de paso quedan a la vista
  // los que existen en Clerk pero no tienen documento en Sanity.
  const byId = new Map<string, { role: string; email: string }>();
  const byEmail = new Map<string, string[]>();
  for (let offset = 0; ; offset += 100) {
    const { data: users } = await clerk.users.getUserList({ limit: 100, offset });
    if (users.length === 0) break;
    for (const u of users) {
      const email =
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        "(sin mail)";
      byId.set(u.id, { role: clerkRole(u.publicMetadata), email });
      byEmail.set(email, [...(byEmail.get(email) ?? []), u.id]);
    }
  }
  console.log(`Clerk:  ${byId.size} usuarios\n`);

  const desfasados: { doc: CustomerDoc; actual: string; esperado: string }[] = [];
  const huerfanos: CustomerDoc[] = [];
  const vistos = new Set<string>();

  for (const d of docs) {
    if (!d.clerkUserId) {
      huerfanos.push(d);
      continue;
    }
    vistos.add(d.clerkUserId);
    const u = byId.get(d.clerkUserId);
    if (!u) {
      huerfanos.push(d);
      continue;
    }
    const esperado = estadoToRole(d.estado);
    if (u.role !== esperado) desfasados.push({ doc: d, actual: u.role, esperado });
  }

  // --- Informe ---
  if (desfasados.length === 0) {
    console.log("✅ Ningún desfasaje: Clerk y Sanity coinciden en los 39.\n");
  } else {
    console.log(`⚠️  ${desfasados.length} cuenta(s) desfasada(s):\n`);
    for (const { doc, actual, esperado } of desfasados) {
      const dir =
        (RANK[esperado] ?? 1) > (RANK[actual] ?? 1)
          ? "ALTA"
          : (RANK[esperado] ?? 1) < (RANK[actual] ?? 1)
            ? "BAJA"
            : "="; // mismo nivel de acceso, distinto nombre (customer ↔ pending)
      console.log(
        `  [${dir}] ${doc.email ?? "(sin mail)"}  Clerk: ${actual} → ${esperado}  (Studio: ${doc.estado ?? "—"})`,
      );
      console.log(`         ${doc.clerkUserId}`);
    }
    console.log();
  }

  const dupes = [...byEmail.entries()].filter(([, ids]) => ids.length > 1);
  if (dupes.length) {
    console.log(`⚠️  ${dupes.length} mail(s) con más de una cuenta en Clerk:\n`);
    for (const [email, ids] of dupes) {
      console.log(`  ${email}`);
      for (const id of ids) console.log(`     ${id}  role: ${byId.get(id)!.role}`);
    }
    console.log("  → Si entra por la cuenta equivocada ve el rol de esa. Revisar a mano.\n");
  }

  if (huerfanos.length) {
    console.log(`ℹ️  ${huerfanos.length} documento(s) en Sanity sin usuario en Clerk:\n`);
    for (const d of huerfanos) console.log(`  ${d.email ?? d._id}  (${d.clerkUserId ?? "sin clerkUserId"})`);
    console.log(
      "  → Puede ser una cuenta borrada, o un documento que quedó de la otra\n" +
        "    instancia de Clerk. NO los borres del Studio sin confirmar uno por uno:\n" +
        "    si el mail te suena a cliente real, es lo segundo.\n",
    );
  }

  const sinDoc = [...byId.keys()].filter((id) => !vistos.has(id));
  if (sinDoc.length) {
    console.log(`ℹ️  ${sinDoc.length} usuario(s) en Clerk sin documento en Sanity:\n`);
    for (const id of sinDoc) console.log(`  ${byId.get(id)!.email}  ${id}  role: ${byId.get(id)!.role}`);
    console.log("  → No se ven en el Studio. Se arregla con npm run backfill:customers.\n");
  }

  // --- Corrección ---
  if (!APPLY) {
    if (desfasados.length) {
      console.log("Modo lectura. Para corregir Clerk según Sanity:");
      console.log("  npm run roles:audit -- --apply\n");
    }
    return;
  }

  console.log(`Aplicando ${desfasados.length} cambio(s) en Clerk...\n`);
  let ok = 0;
  for (const { doc, actual, esperado } of desfasados) {
    try {
      // Se relee el usuario para no pisar otras claves de publicMetadata que
      // hayan cambiado entre el listado y este momento.
      const u = await clerk.users.getUser(doc.clerkUserId!);
      await clerk.users.updateUserMetadata(doc.clerkUserId!, {
        publicMetadata: { ...(u.publicMetadata ?? {}), role: esperado },
      });
      console.log(`  ✓ ${doc.email}  ${actual} → ${esperado}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${doc.email}  ${(err as Error).message}`);
    }
  }
  console.log(`\n${ok}/${desfasados.length} corregidos.`);
  if (ok) {
    console.log(
      "El rol viaja dentro del token de sesión: quien tenga la sesión abierta\n" +
        "tiene que cerrarla y volver a entrar para ver el precio nuevo.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
