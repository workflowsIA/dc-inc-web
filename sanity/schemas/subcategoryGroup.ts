import { defineField, defineType } from "sanity";
import { FilterIcon } from "@sanity/icons";

/**
 * Grupo de filtro — el agrupador de subcategorías.
 *
 * Es el nivel que faltaba. Antes había una sola lista plana de "subtipos" que
 * mezclaba dos cosas distintas: para qué bebida es (Cerveza, Vino, Fernet) y
 * qué forma tiene la pieza (Pinta, Chopp, Tulipa). El catálogo las mostraba
 * todas juntas, 42 casillas alfabéticas, sin importar en qué categoría estabas.
 *
 * Ahora cada subcategoría pertenece a un grupo, y el grupo es lo que se dibuja
 * como un bloque desplegable en los filtros del catálogo y como una columna en
 * el CSV. Marce puede crear los que quiera sin que nadie toque código: el
 * filtro y la columna aparecen solos.
 *
 * Un grupo se muestra en el catálogo únicamente si alguna de sus subcategorías
 * aplica a la categoría que el visitante está mirando. Por eso "Modelo" no
 * aparece cuando mirás Botellas: no hay que configurar nada.
 *
 * Sobre el slug: el CSV reconoce la columna por el nombre del grupo, pero
 * también por el slug y por los alias. Como el slug no cambia cuando renombrás
 * el grupo, los archivos que ya bajaste siguen entrando bien.
 */
export default defineType({
  name: "subcategoryGroup",
  title: "Grupo de filtro",
  type: "document",
  icon: FilterIcon,
  fields: [
    defineField({
      name: "name",
      title: "Nombre",
      type: "string",
      description:
        'Como se ve en los filtros de la web y como se llama la columna en el CSV. Ej: "Bebida", "Modelo".',
      validation: (r) => r.required().max(40),
    }),
    defineField({
      name: "slug",
      title: "Identificador",
      type: "slug",
      options: { source: "name", maxLength: 40 },
      description:
        "Se genera solo a partir del nombre. Es lo que mantiene funcionando los CSV que ya bajaste si después le cambiás el nombre al grupo: no hace falta tocarlo.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "order",
      title: "Orden",
      type: "number",
      description: "En qué posición aparece el bloque dentro de los filtros. Menor = más arriba.",
      validation: (r) => r.integer().min(0),
    }),
    defineField({
      name: "aliases",
      title: "Otros nombres de columna que acepta el CSV",
      type: "array",
      of: [{ type: "string" }],
      description:
        "Solo hace falta si alguna vez le cambiaste mucho el nombre al grupo y querés que los archivos viejos sigan entrando. En general se puede dejar vacío.",
      options: { layout: "tags" },
    }),
  ],
  orderings: [
    {
      name: "orden",
      title: "Orden",
      by: [
        { field: "order", direction: "asc" },
        { field: "name", direction: "asc" },
      ],
    },
  ],
  preview: {
    select: { title: "name", order: "order" },
    prepare: ({ title, order }) => ({
      title: title || "(Sin nombre)",
      subtitle: typeof order === "number" ? `Orden: ${order}` : undefined,
    }),
  },
});
