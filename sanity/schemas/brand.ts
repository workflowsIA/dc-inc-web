import { defineField, defineType } from "sanity";
import { TagIcon } from "@sanity/icons";

/**
 * Marca de producto (Pernod, Coca, etc.). SOLO marcas de catálogo.
 * Los logos de "clientes que confían en nosotros" viven en el schema `client`.
 */
export default defineType({
  name: "brand",
  title: "Marca",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({ name: "url", title: "Link (opcional)", type: "url" }),
    defineField({ name: "order", title: "Orden", type: "number" }),
    defineField({ name: "active", title: "Activo", type: "boolean", initialValue: true }),
  ],
  preview: {
    select: { title: "name", active: "active", media: "logo" },
    prepare({ title, active, media }) {
      return {
        title: title || "(Sin nombre)",
        subtitle: active === false ? "Inactivo" : undefined,
        media: media || TagIcon,
      };
    },
  },
});
