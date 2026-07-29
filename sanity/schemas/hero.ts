import { defineField, defineType } from "sanity";
import { HomeIcon } from "@sanity/icons";

/**
 * Hero / Banner de la home.
 *
 * NO se crean documentos de este tipo a mano: viven como dos "singletons" con
 * _id fijo (`hero-home` y `hero-home-promo`), que la estructura del Studio abre
 * directo como una pantalla de edición (ver sanity/structure.ts). Por eso
 * `placement` y `order` están ocultos — el destino lo define el _id, no un
 * dropdown que Marce tendría que adivinar.
 *
 * Todos los campos son opcionales salvo el título: la web cae en su contenido
 * por defecto para cada campo que falte.
 */
export default defineType({
  name: "hero",
  title: "Banner",
  type: "document",
  icon: HomeIcon,
  fields: [
    defineField({
      name: "active",
      title: "Mostrar este banner",
      type: "boolean",
      description:
        "Si lo apagás, la web vuelve automáticamente al banner por defecto. No queda un hueco.",
      initialValue: true,
    }),
    defineField({
      name: "title",
      title: "Título",
      type: "string",
      description: "El texto grande. Ej: “Decorado bonificado en tu primer pedido de cristalería”.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "subtitle",
      title: "Texto",
      type: "text",
      rows: 3,
      description: "Las dos o tres líneas de abajo del título.",
    }),
    defineField({
      name: "image",
      title: "Imagen",
      type: "image",
      options: { hotspot: true },
      description:
        "Foto de la derecha. Apaisada queda mejor (aprox. 3:2). Si no cargás ninguna, se usa la que está hoy.",
    }),
    defineField({
      name: "ctaLabel",
      title: "Texto del botón",
      type: "string",
      description: "Ej: “Cotizar decorado”.",
    }),
    defineField({
      name: "ctaHref",
      title: "Link del botón",
      type: "string",
      description: "A dónde lleva. Ej: /personaliza · /productos · /contacto",
    }),

    // --- técnicos, ocultos para Marce ---
    defineField({
      name: "placement",
      title: "Dónde se muestra",
      type: "string",
      hidden: true,
      options: {
        list: [
          { title: "Home", value: "home" },
          { title: "Banner promo en home", value: "home-promo" },
          { title: "Intra-catálogo (entre productos)", value: "catalog-inline" },
        ],
      },
    }),
    defineField({ name: "order", title: "Orden", type: "number", hidden: true }),
  ],
  preview: {
    select: { title: "title", active: "active", media: "image" },
    prepare({ title, active, media }) {
      return {
        title: title ?? "(sin título)",
        subtitle: active === false ? "Apagado — se muestra el banner por defecto" : "Activo",
        media,
      };
    },
  },
});
