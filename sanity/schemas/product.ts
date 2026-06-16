import { defineField, defineType } from "sanity";
import { PackageIcon } from "@sanity/icons";

export default defineType({
  name: "product",
  title: "Producto",
  type: "document",
  icon: PackageIcon,
  groups: [
    { name: "basico", title: "Básico", default: true },
    { name: "precios", title: "Precios" },
    { name: "presentacion", title: "Presentación / Stock" },
    { name: "decoracion", title: "Decoración / Destacados" },
    { name: "ficha", title: "Ficha técnica" },
  ],
  fields: [
    defineField({
      name: "sku",
      title: "SKU",
      type: "string",
      group: "basico",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "name",
      title: "Nombre",
      type: "string",
      group: "basico",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "basico",
      options: { source: "name", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "category",
      title: "Categoría",
      type: "reference",
      group: "basico",
      to: [{ type: "category" }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "subtype",
      title: "Subtipo",
      type: "reference",
      group: "basico",
      to: [{ type: "subtype" }],
    }),
    defineField({
      name: "description",
      title: "Descripción",
      type: "text",
      group: "basico",
      rows: 4,
    }),
    defineField({
      name: "images",
      title: "Imágenes",
      type: "array",
      group: "basico",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "legacyImageUrl",
      title: "URL legacy de imagen (Wix CDN)",
      type: "url",
      group: "basico",
      description:
        "URL de Wix CDN usada temporalmente hasta migrar las imágenes al CDN de Sanity. Se reemplaza por `images` al correr el script `migrate-images-to-sanity`.",
    }),
    defineField({
      name: "pricePublic",
      title: "Precio público (visitante)",
      type: "number",
      group: "precios",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "priceWholesale",
      title: "Precio mayorista",
      type: "number",
      group: "precios",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "pricePublicOld",
      title: "Precio público anterior (mostrar tachado si está en promo)",
      type: "number",
      group: "precios",
    }),
    defineField({
      name: "presentations",
      title: "Presentaciones (ej: 24un en Cajas, 2025un en Pallet)",
      type: "array",
      group: "presentacion",
      of: [{ type: "string" }],
      description: "Opciones de presentación que ve el cliente. Vienen del export de Wix.",
    }),
    defineField({
      name: "unitsPerBulk",
      title: "Unidades por bulto",
      type: "number",
      group: "presentacion",
      validation: (r) => r.required().integer().positive(),
    }),
    defineField({
      name: "unitsPerPallet",
      title: "Unidades por pallet",
      type: "number",
      group: "presentacion",
      validation: (r) => r.integer().positive(),
    }),
    defineField({
      name: "deliveryTime",
      title: "Plazo de entrega",
      type: "string",
      group: "presentacion",
      initialValue: "24-48 hs",
    }),
    defineField({
      name: "stockLevel",
      title: "Stock",
      type: "string",
      group: "presentacion",
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
      group: "presentacion",
      description:
        "ID del item correspondiente en Monday — para sincronizar stock real. Se completa cuando llega el acceso a Monday.",
    }),
    defineField({
      name: "badges",
      title: "Destacados / Badges",
      type: "array",
      group: "decoracion",
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
      group: "decoracion",
      initialValue: true,
    }),
    defineField({
      name: "specs",
      title: "Especificaciones técnicas",
      type: "array",
      group: "ficha",
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
    select: {
      title: "name",
      sku: "sku",
      price: "pricePublic",
      media: "images.0",
    },
    prepare({ title, sku, price, media }) {
      const precio =
        typeof price === "number"
          ? `$${price.toLocaleString("es-AR")}`
          : "sin precio";
      return {
        title: title || "(Sin nombre)",
        subtitle: `${sku ? `${sku} · ` : ""}${precio}`,
        media,
      };
    },
  },
});
