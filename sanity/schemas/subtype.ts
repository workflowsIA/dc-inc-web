import { defineField, defineType } from "sanity";

export default defineType({
  name: "subtype",
  title: "Subtipo (tipo de cristalería / envase)",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Nombre", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "scope",
      title: "Aplicable a",
      type: "string",
      options: {
        list: [
          { title: "Cristalería", value: "glass" },
          { title: "Envase", value: "container" },
        ],
      },
    }),
  ],
  preview: { select: { title: "name", subtitle: "scope" } },
});
