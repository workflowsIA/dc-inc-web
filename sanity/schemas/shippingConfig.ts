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
      name: "batuZones",
      title: "Tarifas Batu por zona (CABA / GBA, envío propio)",
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
                    { name: "price", title: "Precio ($)", type: "number", validation: (r) => r.required().min(0) },
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
  ],
  preview: {
    prepare: () => ({ title: "Configuración de envíos" }),
  },
});
