import { defineField, defineType } from "sanity";
import { PackageIcon } from "@sanity/icons";

/**
 * Configuración de envíos — singleton editable por Marce desde el Studio
 * (Contenido del sitio → Configuración de envíos). Documento único con _id fijo
 * "shipping-config". Los valores por defecto (si acá falta algo) son las tarifas
 * hardcodeadas en src/lib/shipping.ts. El sitio arma el cálculo con estos
 * valores tanto en el carrito como en el checkout, el mensaje de WhatsApp y el
 * pedido server-side.
 */
export default defineType({
  name: "shippingConfig",
  title: "Configuración de envíos",
  type: "document",
  icon: PackageIcon,
  fields: [
    defineField({
      name: "andreaniMode",
      title: "Envío al interior (Andreani)",
      type: "string",
      description:
        "Estimado = el cliente ve una tarifa aproximada por zona. A cotizar = no se muestra monto, se coordina por WhatsApp.",
      options: {
        list: [
          { title: "Mostrar tarifa estimada", value: "estimado" },
          { title: "A cotizar (sin monto)", value: "cotizar" },
        ],
        layout: "radio",
      },
      initialValue: "estimado",
    }),
    defineField({
      name: "andreaniBands",
      title: "Tarifas Andreani por banda (interior, ≤10 kg)",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            {
              name: "band",
              title: "Banda",
              type: "string",
              options: {
                list: [
                  { title: "AMBA — CABA y GBA", value: "AMBA" },
                  { title: "B2 — Buenos Aires interior y Centro", value: "B2" },
                  { title: "B3 — Cuyo, Patagonia y NEA", value: "B3" },
                  { title: "B4 — NOA", value: "B4" },
                ],
              },
              validation: (r) => r.required(),
            },
            { name: "price", title: "Precio ($)", type: "number", validation: (r) => r.required().min(0) },
          ],
          preview: {
            select: { title: "band", subtitle: "price" },
            prepare: ({ title, subtitle }) => ({ title, subtitle: subtitle != null ? `$${subtitle}` : "" }),
          },
        },
      ],
    }),
    defineField({
      name: "bultoConsolidaMaxKg",
      title: "Bulto chico: hasta cuántos kg se consolida",
      type: "number",
      initialValue: 10,
      validation: (r) => r.min(1).max(50),
      description:
        "Regla de despacho: los bultos de hasta este peso facturable se juntan en un mismo paquete y se paga un envío solo; los más pesados salen de a uno. Subir el número junta más cosas (envío más barato, más trabajo de armado); bajarlo despacha más separado. 10 kg deja adentro una caja de 12 copas y afuera una caja de botellas.",
    }),
    defineField({
      name: "batuZones",
      title: "Tarifas Batu por zona (CABA / GBA, envío propio)",
      readOnly: true,
      description:
        "Se carga sola desde la planilla de precios (ProductosDC-Todos, filas de despacho DBZ…) en cada sincronización, así que editarla acá no sirve: la próxima corrida la pisa. Los precios son NETOS, tal como están en la planilla; el sitio les suma el IVA al mostrarlos. Para cambiar una tarifa, cambiala en la planilla.",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            {
              name: "zone",
              title: "Zona",
              type: "number",
              options: {
                list: [
                  { title: "Zona 1", value: 1 },
                  { title: "Zona 2", value: 2 },
                  { title: "Zona 3", value: 3 },
                  { title: "Zona 4", value: 4 },
                ],
              },
              validation: (r) => r.required(),
            },
            {
              name: "tramos",
              title: "Tramos (hasta N bultos → precio)",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    { name: "maxBultos", title: "Hasta N bultos", type: "number", validation: (r) => r.required().min(1) },
                    { name: "price", title: "Precio NETO minorista ($)", type: "number", validation: (r) => r.required().min(0) },
                    {
                      name: "priceWholesale",
                      title: "Precio NETO mayorista ($)",
                      type: "number",
                      description:
                        "Referencia: el mayorista compra con envío a cotizar, así que hoy la web no cobra esta tarifa.",
                    },
                  ],
                  preview: {
                    select: { title: "maxBultos", subtitle: "price" },
                    prepare: ({ title, subtitle }) => ({
                      title: `Hasta ${title} bultos`,
                      subtitle: subtitle != null ? `$${subtitle}` : "",
                    }),
                  },
                },
              ],
            },
          ],
          preview: {
            select: { title: "zone", tramos: "tramos" },
            prepare: ({ title, tramos }) => ({
              title: `Zona ${title}`,
              subtitle: `${(tramos ?? []).length} tramos`,
            }),
          },
        },
      ],
    }),
    defineField({
      name: "batuUpdatedAt",
      title: "Tarifa Batu actualizada",
      type: "datetime",
      readOnly: true,
      description: "Última vez que la sincronización trajo la tarifa de Batu de la planilla.",
    }),
  ],
  preview: {
    prepare: () => ({ title: "Configuración de envíos" }),
  },
});
