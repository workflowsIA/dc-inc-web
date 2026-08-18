import { defineField, defineType } from "sanity";
import { EnvelopeIcon } from "@sanity/icons";

/**
 * Lead (consulta) — capturado desde formularios de la web.
 * Hoy lo alimenta el formulario de decorado (`DecoradoForm`), que escribe vía
 * /api/lead (server-side, token de escritura) ANTES de abrir WhatsApp.
 *
 * El handoff a WhatsApp NO depende de que esto se escriba: si /api/lead falla,
 * el formulario abre wa.me igual. Por eso es un registro "best effort".
 */
export default defineType({
  name: "lead",
  title: "Lead",
  type: "document",
  icon: EnvelopeIcon,
  fields: [
    defineField({
      name: "createdAt",
      title: "Fecha",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (r) => r.required(),
    }),
    defineField({ name: "nombre", title: "Contacto / Nombre", type: "string" }),
    defineField({ name: "producto", title: "Producto base", type: "string" }),
    defineField({ name: "cantidad", title: "Cantidad estimada", type: "string" }),
    defineField({ name: "tecnica", title: "Técnica", type: "string" }),
    defineField({ name: "marca", title: "Marca / logo", type: "string" }),
    defineField({ name: "logoUrl", title: "Logo / arte adjunto (URL)", type: "url" }),
    defineField({ name: "comentarios", title: "Comentarios", type: "text", rows: 3 }),
    defineField({
      name: "origen",
      title: "Origen",
      type: "string",
      description: 'Formulario que generó el lead (ej. "decorado-web").',
      initialValue: "decorado-web",
    }),
  ],

  orderings: [
    {
      title: "Más recientes primero",
      name: "createdAtDesc",
      by: [{ field: "createdAt", direction: "desc" }],
    },
  ],

  preview: {
    select: {
      nombre: "nombre",
      producto: "producto",
      tecnica: "tecnica",
      createdAt: "createdAt",
      origen: "origen",
    },
    prepare({ nombre, producto, tecnica, createdAt, origen }) {
      const fecha = createdAt
        ? new Date(createdAt).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "";
      return {
        title: [nombre, producto].filter(Boolean).join(" — ") || "(Lead)",
        subtitle: [fecha, tecnica, origen].filter(Boolean).join(" · ") || undefined,
      };
    },
  },
});
