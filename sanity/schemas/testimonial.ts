import { defineField, defineType } from "sanity";
import { CommentIcon } from "@sanity/icons";

/**
 * Testimonio de cliente — se muestran en la home (sección "Lo que dicen
 * nuestros clientes"). Editable por Marce desde el Studio: Contenido del sitio
 * → Testimonios de clientes. El sitio muestra solo los que tienen `active` en
 * true, ordenados por `order` y después por nombre.
 */
export default defineType({
  name: "testimonial",
  title: "Testimonio de cliente",
  type: "document",
  icon: CommentIcon,
  fields: [
    defineField({
      name: "quote",
      title: "Testimonio",
      type: "text",
      rows: 4,
      validation: (r) => r.required(),
    }),
    defineField({
      name: "name",
      title: "Cliente / marca",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "location",
      title: "Ubicación (ej. Rivadavia, San Juan)",
      type: "string",
    }),
    defineField({
      name: "active",
      title: "Mostrar en el sitio",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "order",
      title: "Orden",
      type: "number",
      description: "Menor primero. Dejalo vacío y se ordena por nombre.",
    }),
  ],
  orderings: [
    { title: "Orden", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
  preview: {
    select: { title: "name", subtitle: "location", active: "active" },
    prepare({ title, subtitle, active }) {
      return {
        title: title || "(Sin nombre)",
        subtitle: active === false ? "Oculto · " + (subtitle || "") : subtitle,
        media: CommentIcon,
      };
    },
  },
});
