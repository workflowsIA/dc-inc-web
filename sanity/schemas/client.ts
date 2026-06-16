import { defineField, defineType } from "sanity";
import { UsersIcon } from "@sanity/icons";

/**
 * Cliente — logos de la vidriera "clientes que confían en nosotros"
 * (home / nosotros). Separado de `brand`, que ahora es SOLO marcas de producto.
 */
export default defineType({
  name: "client",
  title: "Cliente",
  type: "document",
  icon: UsersIcon,
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
        media: media || UsersIcon,
      };
    },
  },
});
