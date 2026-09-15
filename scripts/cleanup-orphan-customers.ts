/**
 * Borra los documentos `customer` de Sanity cuyo usuario ya no existe en la
 * instancia de PRODUCCIÓN de Clerk.
 *
 *   CLERK_SECRET_KEY=sk_live_… npm run customers:cleanup              → lista
 *   CLERK_SECRET_KEY=sk_live_… npm run customers:cleanup -- --apply   → borra
 *
 * De dónde salen estos huérfanos: el cutover del 5-sep-2026 cambió la instancia
 * de Clerk. Las cuentas viejas quedaron en la de desarrollo, la gente se volvió
 * a registrar en producción, y en Sanity quedaron los dos documentos — uno
 * apuntando a un usuario que en producción no existe.
 *
 * Borrar es seguro: NADA referencia a estos documentos. El `customer` existe
 * solo para verlos en el Studio; los pedidos guardan el `clerkUserId` como
 * texto suelto, así que no se rompe ningún pedido ni ningún historial.
 *
 * CRITERIO DE SEGURIDAD — el que importa. Un huérfano se borra solo si ese
 * mismo mail tiene OTRO documento apuntando a un usuario vivo en producción:
 * ahí el huérfano es puro residuo y la persona sigue estando. Si es el único
 * documento de ese mail, NO se toca y se lista aparte, porque borrarlo haría
 * desaparecer del Studio a alguien que quizá es un cliente real que hoy no
 * puede entrar (caso `medp.2310@gmail.com`, mayorista sin cuenta en
 * producción). Para incluirlos hay que pedirlo con --incluir-solos.
 *
 * Requiere en .env.local: SANITY_API_WRITE_TOKEN.
 */
import { createClerkClient } from "@clerk/nextjs/server";
import { sanityClient, sanityWriteClient } from "../src/lib/sanity";
import { exigirProduccion } from "./clerk-instance";

const APPLY = process.argv.includes("--apply");
const INCLUIR_SOLOS = process.argv.includes("--incluir-solos");

interface CustomerDoc {
  _id: string;
  clerkUserId?: string;
  estado?: string;
  email?: string;
}

/**
 * Parte los huérfanos en los que son puro residuo (el mail conserva otra cuenta
 * viva) y los que dejarían a esa persona sin ningún documento. Exportada para
 * poder probarla sin pegarle a Clerk: es la función que decide qué se borra.
 */
export function clasificarHuerfanos(docs: CustomerDoc[], vivos: Set<string>) {
  const esHuerfano = (d: CustomerDoc) => !d.clerkUserId || !vivos.has(d.clerkUserId);
  const mailesConCuentaViva = new Set(
    docs.filter((d) => !esHuerfano(d) && d.email).map((d) => d.email!),
  );
  const huerfanos = docs.filter(esHuerfano);
  return {
    huerfanos,
    residuos: huerfanos.filter((d) => d.email && mailesConCuentaViva.has(d.email)),
    solos: huerfanos.filter((d) => !d.email || !mailesConCuentaViva.has(d.email)),
  };
}

async function main() {
  const secretKey = exigirProduccion("npm run customers:cleanup");

  const docs = await sanityClient.fetch<CustomerDoc[]>(
    `*[_type=="customer"]|order(email asc,_createdAt asc){_id,clerkUserId,estado,email}`,
  );

  const clerk = createClerkClient({ secretKey });
  const vivos = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const { data: users } = await clerk.users.getUserList({ limit: 100, offset });
    if (users.length === 0) break;
    for (const u of users) vivos.add(u.id);
  }
  console.log(`Sanity: ${docs.length} clientes · Clerk: ${vivos.size} usuarios\n`);

  const { huerfanos, residuos, solos } = clasificarHuerfanos(docs, vivos);

  if (huerfanos.length === 0) {
    console.log("✅ No hay documentos huérfanos.");
    return;
  }

  if (residuos.length) {
    console.log(`${residuos.length} residuo(s) de la instancia vieja — se pueden borrar:\n`);
    for (const d of residuos) console.log(`  ${d.email}  (${d.estado ?? "—"})  ${d._id}`);
    console.log();
  }

  if (solos.length) {
    console.log(`⚠️  ${solos.length} huérfano(s) SIN otra cuenta con ese mail:\n`);
    for (const d of solos) console.log(`  ${d.email ?? "(sin mail)"}  (${d.estado ?? "—"})  ${d._id}`);
    console.log(
      "  → No se borran. Si es un cliente real, hoy NO puede entrar al sitio:\n" +
        "    su cuenta quedó en la instancia vieja. Averiguá antes de descartarlo.\n" +
        "    Para borrarlos igual: --incluir-solos\n",
    );
  }

  const aBorrar = INCLUIR_SOLOS ? [...residuos, ...solos] : residuos;
  if (aBorrar.length === 0) {
    console.log("Nada para borrar con los criterios actuales.");
    return;
  }

  if (!APPLY) {
    console.log(`Modo lectura. Para borrar ${aBorrar.length} documento(s):`);
    console.log(
      `  CLERK_SECRET_KEY=sk_live_… npm run customers:cleanup -- --apply${INCLUIR_SOLOS ? " --incluir-solos" : ""}`,
    );
    return;
  }

  console.log(`Borrando ${aBorrar.length} documento(s)...\n`);
  let ok = 0;
  for (const d of aBorrar) {
    try {
      await sanityWriteClient.delete(d._id);
      console.log(`  ✓ ${d.email ?? d._id}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${d.email ?? d._id}  ${(err as Error).message}`);
    }
  }
  console.log(`\n${ok}/${aBorrar.length} borrados.`);
  console.log(
    "Si vuelven a aparecer, el webhook de la instancia de DESARROLLO de Clerk\n" +
      "sigue apuntando al sitio de producción y hay que desconectarlo.",
  );
}

// Solo corre cuando se lo invoca directamente, no al importarlo: así
// `clasificarHuerfanos` se puede probar sin disparar el borrado ni pedir claves.
if (process.argv[1]?.includes("cleanup-orphan-customers")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
