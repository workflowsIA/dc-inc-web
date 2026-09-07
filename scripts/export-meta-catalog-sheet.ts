/**
 * Publica wix-export/meta-catalog.csv (generado por `npm run export:meta`) en un
 * Google Sheet público, para usarlo como "Origen de datos" del catálogo de ads de
 * Meta (Commerce Manager → Orígenes de datos → Configurar → Programación) en
 * reemplazo del feed de Wix.
 *
 * Primera corrida: crea el Sheet, lo comparte "cualquiera con el link puede ver"
 * y muestra la URL CSV para pegar en Commerce Manager y el ID para guardar en
 * .env.local como META_CATALOG_SHEET_ID.
 *
 * Corridas siguientes (con META_CATALOG_SHEET_ID seteado): reusa el mismo Sheet
 * y solo actualiza el contenido, así la URL para Meta no cambia nunca.
 *
 * Requiere en .env.local:
 *   - GOOGLE_SERVICE_ACCOUNT_JSON (la misma que ya se usa para el Sheet de stock)
 *   - META_CATALOG_SHEET_ID (opcional, solo a partir de la 2ª corrida)
 *
 * Uso:
 *   npm run export:meta            # 1) genera wix-export/meta-catalog.csv
 *   npm run export:meta:sheet      # 2) lo publica/actualiza en Google Sheets
 */

import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { google } from "googleapis";

const CSV_PATH = resolve("wix-export/meta-catalog.csv");
const SHEET_TITLE = "DC Inc — Meta Catalog Feed (auto, no editar a mano)";
const TAB_NAME = "feed";

async function getClients() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Falta GOOGLE_SERVICE_ACCOUNT_JSON (JSON o base64 de la service account de Google) en .env.local.",
    );
  }
  const jsonStr = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf-8");
  const credentials = JSON.parse(jsonStr);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });
  return { sheets, drive };
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    throw new Error(
      `No existe ${CSV_PATH}. Corré primero: npm run export:meta`,
    );
  }
  const rows: string[][] = parse(readFileSync(CSV_PATH), {
    bom: true,
    skip_empty_lines: true,
  });
  console.log(`[export:meta:sheet] Leídas ${rows.length - 1} filas de producto de ${CSV_PATH}`);

  const { sheets, drive } = await getClients();

  let spreadsheetId = process.env.META_CATALOG_SHEET_ID?.trim();
  let createdNew = false;

  if (!spreadsheetId) {
    console.log("[export:meta:sheet] META_CATALOG_SHEET_ID no seteado → creando Sheet nuevo...");
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: SHEET_TITLE },
        sheets: [{ properties: { title: TAB_NAME } }],
      },
    });
    spreadsheetId = created.data.spreadsheetId!;
    createdNew = true;
    console.log(`[export:meta:sheet] Sheet creado: ${spreadsheetId}`);

    // Cualquiera con el link puede VER (necesario para que Meta lo pueda leer).
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { role: "reader", type: "anyone" },
    });
    console.log("[export:meta:sheet] Permiso 'cualquiera con el link → lector' aplicado.");

    // Para que Fede lo vea/edite en su propio Drive.
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          role: "writer",
          type: "user",
          emailAddress: "federicomilstein@gmail.com",
        },
        sendNotificationEmail: false,
      });
      console.log("[export:meta:sheet] Compartido como editor con federicomilstein@gmail.com.");
    } catch (e) {
      console.warn("[export:meta:sheet] No se pudo compartir con federicomilstein@gmail.com:", (e as Error).message);
    }
  } else {
    console.log(`[export:meta:sheet] Reusando Sheet existente: ${spreadsheetId}`);
  }

  // No asumimos el nombre de la pestaña: si el Sheet lo creó a mano Fede (o Google
  // Sheets con el locale en español), la primera pestaña puede llamarse "Hoja 1",
  // no "feed". Resolvemos el nombre real de la primera pestaña siempre.
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const firstSheet = meta.data.sheets?.[0]?.properties;
  const actualTabName = firstSheet?.title ?? TAB_NAME;
  const gid = firstSheet?.sheetId ?? 0;

  if (!createdNew) {
    // Limpia el contenido previo antes de reescribir (por si el CSV tiene menos filas que antes).
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: actualTabName,
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${actualTabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
  console.log(`[export:meta:sheet] ${rows.length - 1} filas escritas en la pestaña "${actualTabName}".`);

  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const editUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  console.log("\n✓ Listo.");
  console.log(`  Sheet (editar):        ${editUrl}`);
  console.log(`  URL CSV (para Meta):   ${csvUrl}`);
  if (!process.env.META_CATALOG_SHEET_ID) {
    console.log(
      `\n⚠ Guardá esto en .env.local para que la próxima corrida actualice el MISMO Sheet en vez de crear uno nuevo:\n  META_CATALOG_SHEET_ID=${spreadsheetId}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
