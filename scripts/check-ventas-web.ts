/**
 * Diagnóstico ampliado del descuento de stock web.
 *
 * Lee la pestaña `Productos_Inventario_DC` con valueRenderOption=FORMULA y
 * responde: ¿existe una columna "Ventas web" escribible (no fórmula)? Es la
 * condición para que el descuento de stock al confirmar un pago deje de ser
 * no-op. Reporta también "Stock Venta" y "Pedidos WEB" por las dudas.
 *
 * Uso:  npx tsx --env-file=.env.local scripts/check-ventas-web.ts
 * Env:  GOOGLE_SERVICE_ACCOUNT_JSON
 */
import { google } from "googleapis";

const SHEET_INVENTARIO_ID =
  process.env.SHEET_INVENTARIO_ID ?? "1IArDR92PfChhzAHHKsI-6KLY0xo63ERr7u07vNP_U8M";
const TAB = "Productos_Inventario_DC";
const TARGETS = ["ventas web", "stock venta", "pedidos web"];

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON.");
  const jsonStr = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(jsonStr),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_INVENTARIO_ID,
    range: TAB,
    valueRenderOption: "FORMULA",
  });
  const values = (res.data.values ?? []) as unknown[][];
  if (values.length < 2) throw new Error("Inventario vacío o ilegible.");
  const headers = values[0].map((h) => norm(h));

  console.log(`\n📋 Pestaña ${TAB} — ${values.length - 1} filas, ${headers.length} columnas.`);
  console.log(`\n=== TODOS los encabezados (normalizados) ===`);
  headers.forEach((h, i) => console.log(`   [${i}] ${h || "(vacío)"}`));

  const iSku = headers.indexOf("sku");
  const iUxb = headers.indexOf("uxb");

  for (const target of TARGETS) {
    const iCol = headers.indexOf(target);
    console.log(`\n=== "${target}" ===`);
    if (iCol < 0) {
      console.log(`   ❌ NO existe esa columna.`);
      continue;
    }
    let formulas = 0;
    let fijos = 0;
    let vacios = 0;
    const muestra: string[] = [];
    for (let r = 1; r < values.length; r++) {
      const sku = String(values[r][iSku] ?? "").trim();
      const uxb = iUxb >= 0 ? values[r][iUxb] : "";
      const isBase = uxb === "" || uxb === 0 || uxb === "0" || uxb == null;
      if (!sku || !isBase) continue;
      const cell = String(values[r][iCol] ?? "");
      if (cell.trim() === "") vacios++;
      else if (cell.trim().startsWith("=")) formulas++;
      else fijos++;
      if (muestra.length < 6)
        muestra.push(`   ${sku.padEnd(12)} ${cell.trim().startsWith("=") ? "FÓRMULA" : cell === "" ? "vacío  " : "número "}  ${cell.slice(0, 40)}`);
    }
    muestra.forEach((m) => console.log(m));
    console.log(`   → col ${iCol}: ${formulas} fórmula · ${fijos} número · ${vacios} vacío (filas base)`);
    if (target === "ventas web") {
      if (iCol >= 0 && formulas === 0) {
        console.log(`   ✅ "Ventas web" existe y es ESCRIBIBLE → apuntar STOCK_SALE_COLUMN="Ventas web" + STOCK_SALE_MODE=accumulate en Vercel.`);
      } else if (iCol >= 0) {
        console.log(`   ⚠️ "Ventas web" existe pero tiene fórmulas → no se puede escribir ahí.`);
      }
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌ Falló:", err instanceof Error ? err.message : err);
  process.exit(1);
});
