import { defineField, defineType } from "sanity";
import { HomeIcon } from "@sanity/icons";

/** Hero/banner editable desde Sanity (home + intra-catálogo). */
export default defineType({
  name: "hero",
  title: "Hero / Banner",
  type: "document",
  icon: HomeIcon,
  fields: [
    defineField({ name: "title", title: "Título", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "placement",
      title: "Dónde se muestra",
      type: "string",
      options: {
        list: [
          { title: "Home", value: "home" },
          { title: "Banner promo en home", value: "home-promo" },
          { title: "Intra-catálogo (entre productos)", value: "catalog-inline" },
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({ name: "subtitle", title: "Subtítulo", type: "text", rows: 2 }),
    defineField({ name: "ctaLabel", title: "CTA label", type: "string" }),
    defineField({ name: "ctaHref", title: "CTA link", type: "string" }),
    defineField({ name: "image", title: "Imagen", type: "image" }),
    defineField({ name: "active", title: "Activo", type: "boolean", initialValue: true }),
    defineField({ name: "order", title: "Orden", type: "number" }),
  ],
  preview: { select: { title: "title", subtitle: "placement", media: "image" } },
});
