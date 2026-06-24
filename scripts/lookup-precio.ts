/**
 * Busca filas en la planilla de precios (`Precios Insumos`) por texto, para
 * confirmar a mano el CODIGO real de un producto. Útil para mapear el "tail"
 * de SKUs que el matcher automático no resuelve con confianza.
 *
 * Uso:
 *   npm run sku:lookup -- agropecuari ambar 500
 *   npm run sku:lookup -- espumante
 *   npm run sku:lookup -- r28 plastic
 *
 * Imprime CODIGO + DESCRIPCION de las filas que contienen TODOS los términos.
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON.
 */
import { google } from "googleapis";

const SHEET_PRECIOS_ID =
  process.env.SHEET_PRECIOS_ID ?? "1rQoHe-bx5x8tBcEWgGGwyWIQi3zfUvYM5b7wYiLjdf0";
const TAB_PRECIOS = "Precios Insumos";

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  const terms = process.argv.slice(2).map(norm).filter(Boolean);
  if (!terms.length) {
    console.error('Uso: npm run sku:lookup -- <términos>   (ej: "agropecuari ambar 500")');
    process.exit(1);
  }
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON.");
  const jsonStr = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf-8");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(jsonStr),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_PRECIOS_ID,
    range: TAB_PRECIOS,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = (res.data.values ?? []) as unknown[][];
  const headers = values[0].map((h) => norm(h));
  const iCod = headers.indexOf("codigo");
  const iDesc = headers.indexOf("descripcion");

  console.log(`\n🔎 Buscando: ${terms.join(" + ")}\n`);
  let n = 0;
  for (let r = 1; r < values.length; r++) {
    const codigo = String(values[r][iCod] ?? "").trim();
    const descripcion = String(values[r][iDesc] ?? "").trim();
    if (!codigo || codigo.startsWith("product_")) continue;
    const hay = norm(`${codigo} ${descripcion}`);
    if (terms.every((t) => hay.includes(t))) {
      console.log(`   ${codigo.padEnd(16)} ${descripcion}`);
      n++;
    }
  }
  console.log(`\n   ${n} resultado(s).\n`);
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
