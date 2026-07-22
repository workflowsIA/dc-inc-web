/**
 * Imprime el client_email de la service account de Google (GOOGLE_SERVICE_ACCOUNT_JSON)
 * para poder compartirle el Google Sheet de inventario con permiso de Editor.
 *
 * Uso: npm run gsa:email
 */
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.error("Falta GOOGLE_SERVICE_ACCOUNT_JSON en .env.local");
  process.exit(1);
}
const jsonStr = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
const creds = JSON.parse(jsonStr);
console.log(`\nclient_email: ${creds.client_email}\n`);
console.log("Compartí el Sheet de inventario con este email, permiso Editor.\n");
