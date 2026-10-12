/**
 * Regenera la tabla de respaldo de Andreani (src/lib/andreani-tarifas.ts)
 * contra la API real. Solo CONSULTA a Andreani; el archivo nuevo se sube con
 * un deploy como cualquier cambio de código.
 *
 *   npm run andreani:tabla
 *
 * Además de bajar los precios, chequea que la ESTRUCTURA siga siendo la que
 * asume la web (mismos tramos de peso y mismas zonas por CP). Si Andreani
 * la cambió, avisa y NO escribe nada: ahí hay que revisar bandForCp() o los
 * tramos a mano.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cotizarPaquete, readEnv } from "../src/lib/andreani-api";
import { ANDREANI_TABLA } from "../src/lib/andreani-tarifas";
import { bandForCp, type ShippingBand } from "../src/lib/shipping";

/** Un CP de referencia por zona: de acá salen los precios. */
const REFERENCIA: Record<ShippingBand, string> = { AMBA: "1425", B2: "5000", B3: "8300", B4: "9410" };
/** CPs de control: tienen que cotizar igual que la referencia de su zona. */
const CONTROL = ["1824", "1900", "2000", "3500", "4400", "5500", "7600", "8000", "9000", "9420"];
const VALOR_DECLARADO = 30000;

async function main() {
  const env = readEnv(true);
  if (!env) throw new Error("Faltan ANDREANI_USER / ANDREANI_PASSWORD / ANDREANI_CLIENTE / ANDREANI_CONTRATO_DOMICILIO en .env.local");
  const tramos = ANDREANI_TABLA.tramosKg;
  const precio = (cp: string, kg: number) => cotizarPaquete(cp, kg, VALOR_DECLARADO, env).then((r) => r.conIva);
  const avisos: string[] = [];

  const zonas = {} as Record<ShippingBand, number[]>;
  for (const band of Object.keys(REFERENCIA) as ShippingBand[]) {
    const cp = REFERENCIA[band];
    zonas[band] = [];
    for (let i = 0; i < tramos.length; i++) {
      const tope = await precio(cp, tramos[i]);
      // Un punto adentro del tramo tiene que costar lo mismo que el tope.
      const adentro = await precio(cp, i === 0 ? tramos[0] / 2 : tramos[i - 1] + 0.5);
      if (Math.abs(adentro - tope) > 0.01) {
        avisos.push(`Zona ${band} (CP ${cp}): el tramo hasta ${tramos[i]} kg ya no es parejo ($${adentro} vs $${tope}). Cambiaron los tramos.`);
      }
      zonas[band].push(tope);
    }
    console.log(`${band.padEnd(4)} CP ${cp}: ${zonas[band].map((p) => Math.round(p)).join(" · ")}`);
  }

  // Zonas: cada CP de control a 10 kg tiene que dar el precio de su zona.
  const i10 = tramos.indexOf(10);
  for (const cp of CONTROL) {
    const band = bandForCp(cp);
    if (!band || i10 < 0) continue;
    const p = await precio(cp, 10);
    if (Math.abs(p - zonas[band][i10]) > 0.01) {
      avisos.push(`CP ${cp}: la web lo pone en zona ${band} ($${zonas[band][i10]}) pero Andreani cotiza $${p}. Cambiaron las zonas.`);
    }
  }

  if (avisos.length) {
    console.log("\nNO SE ACTUALIZÓ LA TABLA — Andreani cambió la estructura:\n- " + avisos.join("\n- "));
    process.exit(1);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const fmt = (xs: number[]) => "[" + xs.map((x) => x.toFixed(2).replace(/\.00$/, "")).join(", ") + "]";
  const archivo = `/**
 * Tarifa de Andreani a DOMICILIO por zona × tramo de peso aforado (ARS, CON
 * IVA, valor declarado $30.000 → incluye $726 de seguro).
 *
 * GENERADO por \`npm run andreani:tabla\` (scripts/andreani-tabla.ts) contra la
 * API real. No editar a mano: si Andreani cambia precios, se vuelve a correr
 * el script y se deploya.
 *
 * Con la API prendida (ANDREANI_API=on) el precio sale de la API en vivo y
 * esta tabla es solo el RESPALDO para cuando Andreani no responde.
 */
export const ANDREANI_TABLA = {
  relevado: "${hoy}",
  contrato: "${env.contratoDomicilio}",
  /** Tope de peso aforado de cada tramo, en kg. El último es el tope de paquetería. */
  tramosKg: [${tramos.join(", ")}],
  /** Precio por tramo (mismo orden que tramosKg). Zonas: ver bandForCp(). */
  zonas: {
    AMBA: ${fmt(zonas.AMBA)},
    B2: ${fmt(zonas.B2)},
    B3: ${fmt(zonas.B3)},
    B4: ${fmt(zonas.B4)},
  },
};
`;
  writeFileSync(join(__dirname, "..", "src", "lib", "andreani-tarifas.ts"), archivo);
  const cambio = (Object.keys(zonas) as ShippingBand[]).some((b) =>
    zonas[b].some((p, i) => Math.abs(p - ANDREANI_TABLA.zonas[b][i]) > 0.01),
  );
  console.log(
    cambio
      ? `\nTabla ACTUALIZADA (src/lib/andreani-tarifas.ts, relevado ${hoy}). Commiteá y deployá para que la web la use.`
      : `\nSin cambios de precio respecto de la tabla del ${ANDREANI_TABLA.relevado} (se actualizó solo la fecha).`,
  );
}

main().catch((e) => {
  console.error("FALLÓ:", (e as Error).message);
  process.exit(1);
});
