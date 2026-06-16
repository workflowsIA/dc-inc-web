import { defineField, defineType } from "sanity";
import { TagIcon } from "@sanity/icons";

export default defineType({
  name: "category",
  title: "Categoría",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "order", title: "Orden", type: "number" }),
    defineField({ name: "image", title: "Imagen", type: "image", options: { hotspot: true } }),
  ],
  preview: {
    select: { title: "name", order: "order", media: "image" },
    prepare({ title, order, media }) {
      return {
        title: title || "(Sin nombre)",
        subtitle: typeof order === "number" ? `Orden: ${order}` : undefined,
        media: media || TagIcon,
      };
    },
  },
});
