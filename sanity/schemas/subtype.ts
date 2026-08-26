import { defineField, defineType } from "sanity";
import { TagsIcon } from "@sanity/icons";

export default defineType({
  name: "subtype",
  title: "Subtipo (tipo de cristalería / envase)",
  type: "document",
  icon: TagsIcon,
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "scope",
      title: "Familia",
      type: "string",
      description:
        "Solo para ordenar la lista de subtipos en el panel: si es un tipo de cristalería (Copas y vasos) o un tipo de envase (Botellas, Latas, Botellones…). No cambia nada en la web: el producto se filtra por los subtipos que tenga marcados, sin importar su categoría.",
      options: {
        list: [
          { title: "Cristalería (Copas y vasos)", value: "glass" },
          { title: "Envases (Botellas, Latas, Botellones…)", value: "container" },
        ],
        layout: "radio",
      },
    }),
  ],
  preview: {
    select: { title: "name", scope: "scope" },
    prepare({ title, scope }) {
      return {
        title: title || "(Sin nombre)",
        subtitle: scope === "glass" ? "Cristalería" : scope === "container" ? "Envases" : undefined,
      };
    },
  },
});
