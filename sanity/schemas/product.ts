import { defineField, defineType } from "sanity";

export default defineType({
  name: "product",
  title: "Producto",
  type: "document",
  fields: [
    defineField({
      name: "sku",
      title: "SKU",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "name",
      title: "Nombre",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "category",
      title: "Categoría",
      type: "reference",
      to: [{ type: "category" }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "subtype",
      title: "Subtipo",
      type: "reference",
      to: [{ type: "subtype" }],
    }),
    defineField({
      name: "description",
      title: "Descripción",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "images",
      title: "Imágenes (Sanity assets)",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "legacyImageUrl",
      title: "URL legacy de imagen (Wix CDN)",
      type: "url",
      description:
        "URL de Wix CDN usada temporalmente hasta migrar las imágenes al CDN de Sanity. Se reemplaza por `images` al correr el script `migrate-images-to-sanity`.",
    }),
    defineField({
      name: "pricePublic",
      title: "Precio público (visitante)",
      type: "number",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "priceWholesale",
      title: "Precio mayorista",
      type: "number",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "pricePublicOld",
      title: "Precio público anterior (mostrar tachado si está en promo)",
      type: "number",
    }),
    defineField({
      name: "unitsPerBulk",
      title: "Unidades por bulto",
      type: "number",
      validation: (r) => r.required().integer().positive(),
    }),
    defineField({
      name: "unitsPerPallet",
      title: "Unidades por pallet",
      type: "number",
      validation: (r) => r.integer().positive(),
    }),
    defineField({
      name: "deliveryTime",
      title: "Plazo de entrega",
      type: "string",
      initialValue: "24-48 hs",
    }),
    defineField({
      name: "stockLevel",
      title: "Stock",
      type: "string",
      options: {
        list: [
          { title: "Disponible", value: "ok" },
          { title: "Stock limitado", value: "low" },
          { title: "Sin stock", value: "out" },
        ],
      },
      initialValue: "ok",
    }),
    defineField({
      name: "mondayItemId",
      title: "Monday item ID (sync stock)",
      type: "string",
      description:
        "ID del item correspondiente en Monday — para sincronizar stock real. Se completa cuando llega el acceso a Monday.",
    }),
    defineField({
      name: "badges",
      title: "Badges",
      type: "array",
      of: [
        {
          type: "string",
          options: {
            list: [
              { title: "Más vendido", value: "best" },
              { title: "Nuevo", value: "new" },
              { title: "Promo del mes", value: "promo" },
              { title: "Decorado bonificado", value: "deco" },
            ],
          },
        },
      ],
    }),
    defineField({
      name: "decoAvailable",
      title: "Decorado disponible",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "specs",
      title: "Especificaciones técnicas",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "key", title: "Atributo", type: "string" },
            { name: "value", title: "Valor", type: "string" },
          ],
          preview: {
            select: { title: "key", subtitle: "value" },
          },
        },
      ],
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "sku", media: "images.0" },
  },
});
