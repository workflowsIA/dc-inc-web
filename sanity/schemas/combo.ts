import { defineField, defineType } from "sanity";
import { TrolleyIcon } from "@sanity/icons";

export default defineType({
  name: "combo",
  title: "Combo",
  type: "document",
  icon: TrolleyIcon,
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "description", title: "Descripción", type: "text", rows: 3 }),
    defineField({
      name: "items",
      title: "SKUs incluidos",
      type: "array",
      of: [{ type: "reference", to: [{ type: "product" }] }],
    }),
    defineField({ name: "pricePublicFrom", title: "Desde (público)", type: "number" }),
    defineField({ name: "pricePublicOld", title: "Antes (mostrar tachado)", type: "number" }),
    defineField({
      name: "badge",
      title: "Badge",
      type: "string",
      options: {
        list: [
          { title: "Más vendido", value: "Más vendido" },
          { title: "Promo del mes", value: "Promo del mes" },
          { title: "Decorado bonificado", value: "Decorado bonificado" },
          { title: "Nuevo", value: "Nuevo" },
        ],
      },
    }),
    defineField({ name: "image", title: "Imagen", type: "image", options: { hotspot: true } }),
    defineField({ name: "active", title: "Activo", type: "boolean", initialValue: true }),
  ],
  preview: {
    select: { title: "name", badge: "badge", price: "pricePublicFrom", media: "image" },
    prepare({ title, badge, price, media }) {
      const parts = [
        badge || null,
        typeof price === "number" ? `desde $${price.toLocaleString("es-AR")}` : null,
      ].filter(Boolean);
      return {
        title: title || "(Sin nombre)",
        subtitle: parts.join(" · ") || undefined,
        media: media || TrolleyIcon,
      };
    },
  },
});
