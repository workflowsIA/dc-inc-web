import { defineField, defineType } from "sanity";
import { UsersIcon } from "@sanity/icons";

/**
 * Cartel de bienvenida — singleton editable desde el Studio
 * (Contenido del sitio → Cartel de bienvenida). Documento único con _id fijo
 * "welcome-modal".
 *
 * Sale del pedido de Marce del 14-sep-2026: el visitante que entra por primera
 * vez no sabe que hay precios mayoristas y minoristas. El cartel se lo cuenta y
 * lo manda a donde corresponda.
 *
 * Dos cosas que NO hace, a propósito:
 *  - No bloquea el catálogo: se cierra con la X, con Escape o tocando afuera.
 *  - No habilita precios mayoristas. El botón "Por mayor" solo lleva a crear la
 *    cuenta; la aprobación sigue siendo manual, igual que siempre. El precio lo
 *    decide el rol del usuario logueado, nunca este cartel.
 *
 * Si el documento no existe o está apagado, el sitio no muestra nada (los
 * textos por defecto viven en src/lib/sanity-data.ts, DEFAULT_WELCOME_MODAL).
 */
export default defineType({
  name: "welcomeModal",
  title: "Cartel de bienvenida",
  type: "document",
  icon: UsersIcon,
  fields: [
    defineField({
      name: "enabled",
      title: "Mostrar el cartel",
      type: "boolean",
      description:
        "Apagalo para que deje de aparecer, sin perder los textos que cargaste.",
      initialValue: true,
    }),
    defineField({
      name: "title",
      title: "Título",
      type: "string",
      initialValue: "¿Comprás por mayor o por menor?",
      validation: (r) => r.required().max(80),
    }),
    defineField({
      name: "subtitle",
      title: "Bajada",
      type: "text",
      rows: 2,
      initialValue:
        "Elegí y te mostramos nuestros productos disponibles con sus precios.",
      validation: (r) => r.max(220),
    }),
    defineField({
      name: "options",
      title: "Opciones",
      type: "array",
      description:
        "Los botones del cartel. Con dos alcanza; podés poner hasta tres.",
      validation: (r) => r.min(1).max(3),
      of: [
        {
          type: "object",
          fields: [
            {
              name: "label",
              title: "Botón",
              type: "string",
              description: 'Lo que dice el botón. Ej: "Por mayor".',
              validation: (r) => r.required().max(40),
            },
            {
              name: "description",
              title: "Explicación",
              type: "text",
              rows: 2,
              description: "La línea chica que va abajo del botón.",
              validation: (r) => r.max(200),
            },
            {
              name: "href",
              title: "A dónde lleva",
              type: "string",
              description:
                'Dirección dentro del sitio, empezando con barra. Ej: /cuenta o /productos',
              validation: (r) =>
                r
                  .required()
                  .custom((v) =>
                    typeof v === "string" && v.startsWith("/")
                      ? true
                      : "Tiene que empezar con / (una página de este sitio)",
                  ),
            },
            {
              name: "highlight",
              title: "Destacar este botón",
              type: "boolean",
              description: "El destacado se pinta en amarillo. Dejá uno solo.",
              initialValue: false,
            },
          ],
          preview: {
            select: { title: "label", subtitle: "href" },
          },
        },
      ],
    }),
    defineField({
      name: "dismissLabel",
      title: "Texto para cerrar",
      type: "string",
      description: "El link de abajo de todo, que cierra el cartel sin ir a ningún lado.",
      initialValue: "Solo estoy mirando el catálogo",
      validation: (r) => r.max(60),
    }),
    defineField({
      name: "frequencyDays",
      title: "Cada cuántos días vuelve a aparecer",
      type: "number",
      description:
        "Una vez que el visitante lo cierra, no lo vuelve a ver por esta cantidad de días. 365 = prácticamente una sola vez.",
      initialValue: 365,
      validation: (r) => r.required().integer().min(1).max(3650),
    }),
    defineField({
      name: "delaySeconds",
      title: "Segundos antes de mostrarlo",
      type: "number",
      description:
        "Un par de segundos evita que aparezca encima de la página antes de que llegue a verla. 0 = al instante.",
      initialValue: 2,
      validation: (r) => r.required().min(0).max(30),
    }),
  ],
  preview: {
    select: { title: "title", enabled: "enabled" },
    prepare: ({ title, enabled }) => ({
      title: title || "Cartel de bienvenida",
      subtitle: enabled ? "Activo" : "Apagado",
    }),
  },
});
