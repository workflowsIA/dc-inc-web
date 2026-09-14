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
        "Si está activo, la categoría aparece en la grilla “Elegí por categoría” de la home. Para que aparezca necesita tener al menos un producto publicado Y un dibujo: los seis rubros de siempre ya lo traen; para sumar una categoría nueva hay que cargarle una imagen acá abajo, si no queda afuera aunque el check esté prendido.",
    }),
    defineField({ name: "image", title: "Imagen", type: "image", options: { hotspot: true } }),
    defineField({
      // La dirección web de la categoría sale del slug de arriba. Cuando se le
      // cambia el nombre, el slug se puede regenerar y la dirección vieja queda
      // rota para quien la tenga guardada o la encuentre en Google (pasó el
      // 12-sep-2026 con "Tapas y precintos"). Acá quedan las direcciones
      // anteriores: el sitio las redirige solas a la actual.
      name: "previousSlugs",
      title: "Direcciones anteriores",
      type: "array",
      of: [{ type: "string" }],
      description:
        "Las direcciones que tuvo antes esta categoría. El sitio las redirige a la actual, así no se pierde el que llega desde Google o desde un link guardado. Se completan solas cuando cambia el nombre; no hace falta tocarlas.",
      options: { layout: "tags" },
    }),
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
