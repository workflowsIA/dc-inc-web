import { defineField, defineType } from "sanity";
import { UsersIcon } from "@sanity/icons";

/** Vidriera de marcas/clientes en el home. */
export default defineType({
  name: "brand",
  title: "Marca / Cliente vidriera",
  type: "document",
  icon: UsersIcon,
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({ name: "url", title: "Link (opcional)", type: "url" }),
    defineField({ name: "testimonial", title: "Testimonio (opcional)", type: "text", rows: 3 }),
    defineField({ name: "order", title: "Orden", type: "number" }),
    defineField({ name: "active", title: "Activo", type: "boolean", initialValue: true }),
  ],
  preview: {
    select: { title: "name", active: "active", media: "logo" },
    prepare({ title, active, media }) {
      return {
        title: title || "(Sin nombre)",
        subtitle: active === false ? "Inactivo" : undefined,
        media: media || UsersIcon,
      };
    },
  },
});
