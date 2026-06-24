/**
 * Diagnóstico: ¿la columna "Stock Venta" de Productos_Inventario_DC es fórmula
 * o número fijo? Lee la planilla con valueRenderOption=FORMULA, así una celda
 * con fórmula aparece como "=SUM(...)" en vez de su valor calculado.
 *
 * Responde la consulta a Marce sobre el webhook de descuento de stock.
 *
 * Uso: npm run stock:check
 * Env: GOOGLE_SERVICE_ACCOUNT_JSON.
 */
import { google } from "googleapis";

const SHEET_INVENTARIO_ID =
  process.env.SHEET_INVENTARIO_ID ?? "1IArDR92PfChhzAHHKsI-6KLY0xo63ERr7u07vNP_U8M";
const TAB = "Productos_Inventario_DC";

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
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
    spreadsheetId: SHEET_INVENTARIO_ID,
    range: TAB,
    valueRenderOption: "FORMULA", // ← clave: devuelve la fórmula si la hay
  });
  const values = (res.data.values ?? []) as unknown[][];
  const headers = values[0].map((h) => norm(h));
  const iSku = headers.indexOf("sku");
  const iUxb = headers.indexOf("uxb");
  const iSV = headers.indexOf("stock venta");
  if (iSV < 0) throw new Error("No encuentro la columna 'Stock Venta'.");

  console.log(`\n🔎 Columna "Stock Venta" — ¿fórmula o número?\n`);
  let formulas = 0;
  let fijos = 0;
  let muestras = 0;
  for (let r = 1; r < values.length && muestras < 12; r++) {
    const sku = String(values[r][iSku] ?? "").trim();
    const uxb = values[r][iUxb];
    const isBase = uxb === "" || uxb === 0 || uxb === "0" || uxb == null;
    if (!sku || !isBase) continue;
    const cell = String(values[r][iSV] ?? "");
    const esFormula = cell.trim().startsWith("=");
    if (esFormula) formulas++;
    else fijos++;
    if (muestras < 8) {
      console.log(
        `   ${sku.padEnd(12)} ${esFormula ? "FÓRMULA" : "número "}  ${cell.slice(0, 50)}`,
      );
    }
    muestras++;
  }
  console.log(
    `\n   Resultado (muestra de filas base): ${formulas} con fórmula · ${fijos} número fijo`,
  );
  console.log(
    formulas > 0
      ? `   → Es FÓRMULA: el webhook NO debe pisarla. Hace falta columna 'Ventas web' aparte.\n`
      : `   → Es número FIJO: el webhook puede descontar directo sobre 'Stock Venta'.\n`,
  );
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
