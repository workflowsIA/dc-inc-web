/**
 * Siembra el singleton `shippingConfig` en Sanity con las tarifas actuales
 * (las hardcodeadas en src/lib/shipping.ts), para que Marce las vea y edite
 * desde el Studio (Contenido del sitio → Configuración de envíos). Idempotente:
 * _id fijo "shipping-config".
 *
 *   npm run seed:shipping
 *
 * Requiere en .env.local: SANITY_API_WRITE_TOKEN.
 */
import { sanityWriteClient } from "../src/lib/sanity";
import { SHIPPING_RATES, BATU_RATES, type ShippingBand, type BatuZone } from "../src/lib/shipping";

async function main() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("Falta SANITY_API_WRITE_TOKEN en .env.local");
  }
  const andreaniBands = (Object.keys(SHIPPING_RATES) as ShippingBand[]).map((band) => ({
    _key: band,
    band,
    price: SHIPPING_RATES[band],
  }));
  const batuZones = (Object.keys(BATU_RATES) as unknown as BatuZone[]).map((z) => {
    const zone = Number(z) as BatuZone;
    return {
      _key: `zona-${zone}`,
      zone,
      tramos: BATU_RATES[zone].map((t, i) => ({ _key: `t${i}`, maxBultos: t.maxBultos, price: t.price })),
    };
  });

  await sanityWriteClient.createOrReplace({
    _id: "shipping-config",
    _type: "shippingConfig",
    andreaniMode: "estimado",
    andreaniBands,
    batuZones,
  });

  console.log("Seed OK: singleton shippingConfig cargado con las tarifas actuales.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
