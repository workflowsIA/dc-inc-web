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
    defineField({
      // Los tiles "Elegí por categoría" del home salían de una lista fija de
      // NOMBRES en el código: al renombrar una categoría, su tile desaparecía
      // (pasó el 12-sep-2026 con "Tapas y precintos"). Ahora se controla desde
      // acá. Si nunca se tocó, valen los seis rubros históricos.
      name: "showOnHome",
      title: "Mostrar en el home",
      type: "boolean",
      description:
        "Si está activo, la categoría aparece en la grilla “Elegí por categoría” de la home (siempre que tenga al menos un producto publicado).",
    }),
    defineField({ name: "image", title: "Imagen", type: "image", options: { hotspot: true } }),
  ],
  preview: {
    select: { title: "name", order: "order", media: "image", showOnHome: "showOnHome" },
    prepare({ title, order, media, showOnHome }) {
      const bits = [
        typeof order === "number" ? `Orden: ${order}` : "",
        showOnHome === false ? "Fuera del home" : showOnHome === true ? "En el home" : "",
      ].filter(Boolean);
      return {
        title: title || "(Sin nombre)",
        subtitle: bits.length ? bits.join(" · ") : undefined,
        media: media || TagIcon,
      };
    },
  },
});
