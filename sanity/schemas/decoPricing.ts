import { defineField, defineType } from "sanity";
import { SparklesIcon } from "@sanity/icons";

/**
 * Tarifa de decorado (serigrafía) por tramo de cantidad — singleton con _id
 * fijo "deco-pricing". NO se edita acá: la carga la sincronización diaria
 * desde las filas de decorado de la planilla de precios (DBC11xx, DBG11xx,
 * DG111xx, DG211xx, DC11xx + montaje DCMYM1/DCMYM2). Ver src/lib/deco.ts.
 * Se muestra en Contenido del sitio → Tarifa de decorado, solo para consultar.
 */
export default defineType({
  name: "decoPricing",
  title: "Tarifa de decorado",
  type: "document",
  icon: SparklesIcon,
  readOnly: true,
  fields: [
    defineField({
      name: "updatedAt",
      title: "Última sincronización",
      type: "datetime",
    }),
    defineField({
      name: "options",
      title: "Opciones (familia × caras)",
      type: "array",
      description:
        "Una por familia de producto y cantidad de caras. Los precios son NETOS por pieza, según la cantidad decorada (a más piezas, menor precio por unidad). Se edita en la planilla, no acá.",
      of: [
        {
          type: "object",
          fields: [
            { name: "family", title: "Familia", type: "string" },
            { name: "sides", title: "Caras", type: "number" },
            { name: "label", title: "Opción", type: "string" },
            { name: "setupSku", title: "SKU montaje y horneado", type: "string" },
            { name: "setupPrice", title: "Montaje y horneado (neto, por trabajo)", type: "number" },
            {
              name: "tiers",
              title: "Tramos",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    { name: "sku", title: "SKU (planilla)", type: "string" },
                    { name: "minUnits", title: "Desde (unidades)", type: "number" },
                    { name: "pricePerUnit", title: "Precio neto por pieza", type: "number" },
                  ],
                  preview: {
                    select: { sku: "sku", min: "minUnits", price: "pricePerUnit" },
                    prepare({ sku, min, price }) {
                      return {
                        title: `desde ${min} u → $${Math.round(price ?? 0).toLocaleString("es-AR")}/u`,
                        subtitle: sku,
                      };
                    },
                  },
                },
              ],
            },
          ],
          preview: {
            select: { family: "family", label: "label", tiers: "tiers" },
            prepare({ family, label, tiers }) {
              const n = Array.isArray(tiers) ? tiers.length : 0;
              return { title: `${family} — ${label}`, subtitle: `${n} tramos` };
            },
          },
        },
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Tarifa de decorado (desde la planilla)" }) },
});
