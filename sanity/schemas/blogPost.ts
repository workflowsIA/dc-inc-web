import { defineField, defineType } from "sanity";
import { DocumentsIcon } from "@sanity/icons";

export default defineType({
  name: "blogPost",
  title: "Artículo blog",
  type: "document",
  icon: DocumentsIcon,
  fields: [
    defineField({ name: "title", title: "Título", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "excerpt", title: "Resumen", type: "text", rows: 3 }),
    defineField({ name: "cover", title: "Imagen", type: "image", options: { hotspot: true } }),
    defineField({ name: "body", title: "Cuerpo", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "publishedAt", title: "Publicado", type: "datetime" }),
    defineField({ name: "category", title: "Categoría", type: "string" }),
  ],
  preview: { select: { title: "title", subtitle: "category", media: "cover" } },
});
