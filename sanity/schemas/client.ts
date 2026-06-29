import { defineField, defineType } from "sanity";
import { StarIcon } from "@sanity/icons";

/**
 * Marca con la que trabajamos — logos de la vidriera (home / nosotros).
 * El type sigue siendo "client" para no romper datos/queries existentes; solo
 * cambió el nombre visible. Separado de `brand` (SOLO marcas de producto).
 */
export default defineType({
  name: "client",
  title: "Marca con la que trabajamos",
  type: "document",
  icon: StarIcon,
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({ name: "logo", title: "Logo", type: "image", options: { hotspot: true } }),
    defineField({ name: "website", title: "Sitio web (opcional)", type: "url" }),
    defineField({ name: "active", title: "Activo", type: "boolean", initialValue: true }),
    defineField({ name: "order", title: "Orden", type: "number" }),
  ],
  orderings: [
    { title: "Orden", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
  preview: {
    select: { title: "name", active: "active", media: "logo" },
    prepare({ title, active, media }) {
      return {
        title: title || "(Sin nombre)",
        subtitle: active === false ? "Inactivo" : undefined,
        media: media || StarIcon,
      };
    },
  },
});
