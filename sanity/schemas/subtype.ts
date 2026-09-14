import { defineField, defineType } from "sanity";
import { TagsIcon } from "@sanity/icons";

/**
 * Subcategoría.
 *
 * El tipo técnico sigue llamándose "subtype" a propósito: así los 498 productos
 * que ya apuntan acá no hay que tocarlos. Lo que cambió es el modelo alrededor:
 *
 *  - `group`  → a qué grupo de filtro pertenece (Bebida, Modelo, Tipo de pieza).
 *               Es lo que decide en qué bloque del catálogo aparece.
 *  - `parents`→ de qué categorías cuelga. Puede ser más de una: "Cerveza" vive
 *               en Copas y vasos, en Botellas y en Botellones a la vez. Si se
 *               deja vacío, la subcategoría se ofrece en todas las categorías.
 *
 * El campo viejo `scope` (Cristalería / Envases) queda oculto: servía para
 * ordenar la lista en el Studio pero mezclaba ejes y no filtraba nada en la
 * web. Se usó para inferir los grupos en la migración y no se borra para no
 * perder el dato.
 */
export default defineType({
  name: "subtype",
  title: "Subcategoría",
  type: "document",
  icon: TagsIcon,
  fields: [
    defineField({
      name: "name",
      title: "Nombre",
      type: "string",
      description: 'Como se ve en el filtro. Ej: "Cerveza", "Pinta".',
      validation: (r) => r.required().max(60),
    }),
    defineField({
      name: "group",
      title: "Grupo de filtro",
      type: "reference",
      to: [{ type: "subcategoryGroup" }],
      description:
        "En qué bloque de filtros aparece. Si no le ponés ninguno, la subcategoría no se muestra en el catálogo.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "parents",
      title: "Categorías donde se ofrece",
      type: "array",
      of: [{ type: "reference", to: [{ type: "category" }] }],
      description:
        "Puede ser más de una. Vacío = se ofrece en todas las categorías.",
      validation: (r) => r.unique(),
    }),
    defineField({
      name: "order",
      title: "Orden",
      type: "number",
      description:
        "Opcional. Si no ponés nada, dentro del grupo se ordenan por cantidad de productos.",
      validation: (r) => r.integer().min(0),
    }),
    defineField({
      name: "scope",
      title: "Familia (en desuso)",
      type: "string",
      hidden: true,
      readOnly: true,
      options: {
        list: [
          { title: "Cristalería (Copas y vasos)", value: "glass" },
          { title: "Envases (Botellas, Latas, Botellones…)", value: "container" },
        ],
        layout: "radio",
      },
    }),
  ],
  orderings: [
    {
      name: "porGrupo",
      title: "Grupo y nombre",
      by: [
        { field: "group.name", direction: "asc" },
        { field: "name", direction: "asc" },
      ],
    },
  ],
  preview: {
    select: { title: "name", group: "group.name", parent0: "parents.0.name", parentCount: "parents" },
    prepare({ title, group, parent0, parentCount }) {
      const n = Array.isArray(parentCount) ? parentCount.length : 0;
      const donde = n === 0 ? "todas las categorías" : n === 1 ? parent0 : `${n} categorías`;
      return {
        title: title || "(Sin nombre)",
        subtitle: [group || "SIN GRUPO", donde].filter(Boolean).join(" · "),
      };
    },
  },
});
