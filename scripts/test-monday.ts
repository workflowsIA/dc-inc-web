/**
 * Test de la integración Monday (notificación de registros en el board CRM).
 *
 * 1) Sin argumentos: lista grupos y columnas del board (para verificar acceso
 *    y ver qué matchea el descubrimiento por título).
 * 2) Con --create: crea un item de prueba "TEST — Registro web (borrar)" con
 *    update incluido, ejercitando el mismo camino que el webhook real.
 *
 * Uso:
 *   npm run monday:test              # solo inspección
 *   npm run monday:test -- --create  # crea item de prueba
 *
 * Env: MONDAY_API_TOKEN + MONDAY_BOARD_CRM_ID (en .env.local).
 */
import { isMondayConfigured, notifyCustomerSignup } from "../src/lib/monday";

async function main() {
  if (!isMondayConfigured()) {
    console.error(
      "Falta MONDAY_API_TOKEN y/o MONDAY_BOARD_CRM_ID en .env.local.\n" +
        "Token: monday.com → avatar → Developers → My access tokens.\n" +
        "Board ID: es el número en la URL del board (ej: monday.com/boards/1234567890).",
    );
    process.exit(1);
  }

  const boardId = process.env.MONDAY_BOARD_CRM_ID;
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.MONDAY_API_TOKEN ?? "",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({
      query: `query ($ids: [ID!]) { boards(ids: $ids) { id name groups { id title } columns { id title type } } }`,
      variables: { ids: [boardId] },
    }),
  });
  const data = (await res.json()) as {
    data?: { boards: { id: string; name: string; groups: { id: string; title: string }[]; columns: { id: string; title: string; type: string }[] }[] };
    errors?: { message: string }[];
  };
  if (data.errors?.length) {
    console.error("Error de Monday:", data.errors.map((e) => e.message).join("; "));
    process.exit(1);
  }
  const board = data.data?.boards?.[0];
  if (!board) {
    console.error(`No se encontró el board ${boardId} (¿el token tiene acceso?).`);
    process.exit(1);
  }
  console.log(`Board: ${board.name} (${board.id})\n`);
  console.log("Grupos:");
  for (const g of board.groups) console.log(`  ${g.id}  ${g.title}`);
  console.log("\nColumnas:");
  for (const c of board.columns) console.log(`  ${c.id}  [${c.type}]  ${c.title}`);
  console.log(
    "\nTip: si querés que los registros caigan en un grupo específico, seteá\n" +
      "MONDAY_CRM_GROUP_ID con el id del grupo (si no, van al primero).",
  );

  if (process.argv.includes("--create")) {
    console.log("\nCreando item de prueba…");
    const itemId = await notifyCustomerSignup({
      kind: "solicitud_mayorista",
      nombre: "TEST — borrar",
      empresa: "Empresa de Prueba SRL",
      email: "test@example.com",
      cuit: "30-11111111-1",
      telefono: "+54 9 11 1234-5678",
      clerkUserId: "test",
    });
    console.log(`✓ Item creado: ${itemId} (borralo del board cuando lo veas).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
