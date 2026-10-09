/**
 * Prueba de la API de Andreani — NO toca la web ni Sanity, solo consulta.
 *
 *   npm run andreani:probe
 *
 * 1. Hace login con ANDREANI_USER / ANDREANI_PASSWORD (de .env.local).
 * 2. Cotiza los casos que ya medimos en el panel Pymes y muestra, para cada
 *    uno, el precio de la API al lado del de la tabla que usa hoy la web.
 *
 * Funciona aunque ANDREANI_API no esté en "on" (no prende nada).
 */
import { cotizarPaquete, readEnv } from "../src/lib/andreani-api";
import { bandForCp, rateForBulto } from "../src/lib/shipping";

const CASOS: { cp: string; kg: number; nota: string }[] = [
  { cp: "1425", kg: 5, nota: "CABA, paquete chico" },
  { cp: "1824", kg: 30, nota: "Lanús, 21-35 kg" },
  { cp: "5000", kg: 10, nota: "Córdoba capital" },
  { cp: "7600", kg: 45, nota: "Mar del Plata, 36-50 kg" },
  { cp: "8300", kg: 4.84, nota: "Neuquén, 1 caja de 12 copas" },
  { cp: "8300", kg: 29, nota: "Neuquén, 6 cajas de copas juntas (panel: $88.387)" },
  { cp: "5500", kg: 25, nota: "Mendoza, 1 caja botella 330" },
  { cp: "4400", kg: 45, nota: "Salta, 36-50 kg" },
];

const ars = (n: number | null | undefined) =>
  typeof n === "number" ? "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 }) : "—";

async function main() {
  const env = readEnv(true);
  if (!env) {
    console.error(
      "Faltan variables en .env.local: ANDREANI_USER, ANDREANI_PASSWORD, ANDREANI_CLIENTE, ANDREANI_CONTRATO_DOMICILIO",
    );
    process.exit(1);
  }
  console.log(`Andreani ${env.base} · cliente ${env.cliente} · contrato ${env.contratoDomicilio}\n`);
  let ok = 0;
  for (const c of CASOS) {
    const band = bandForCp(c.cp);
    const tabla = band ? rateForBulto(band, c.kg) : null;
    try {
      const r = await cotizarPaquete(c.cp, c.kg, 30000, env);
      ok++;
      const diff = tabla ? (((r.conIva - tabla) / tabla) * 100).toFixed(1) + "%" : "";
      console.log(
        `CP ${c.cp} ${String(c.kg).padStart(5)} kg  API ${ars(r.conIva).padStart(10)} (sin IVA ${ars(r.sinIva)}, aforado ${r.pesoAforado ?? "?"} kg)  tabla ${ars(tabla).padStart(10)}  ${diff.padStart(7)}  · ${c.nota}`,
      );
    } catch (e) {
      console.log(`CP ${c.cp} ${c.kg} kg  ERROR ${(e as Error).message}`);
    }
  }
  console.log(`\n${ok}/${CASOS.length} cotizaciones OK.`);
  if (ok === 0) process.exit(1);
}

main().catch((e) => {
  console.error("FALLÓ:", (e as Error).message);
  process.exit(1);
});
