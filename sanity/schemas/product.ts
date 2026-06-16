import { defineField, defineType } from "sanity";
import {
  PackageIcon,
  TagIcon,
  CubeIcon,
  SparklesIcon,
  SearchIcon,
  InfoOutlineIcon,
} from "@sanity/icons";

export default defineType({
  name: "product",
  title: "Producto",
  type: "document",
  icon: PackageIcon,
  // Pestañas del formulario: el orden importa, es el orden en que Marce
  // las ve arriba del form. Cada una con su ícono para ubicarse rápido.
  groups: [
    { name: "basico", title: "Básico", icon: InfoOutlineIcon, default: true },
    { name: "precios", title: "Precios y oferta", icon: TagIcon },
    { name: "presentacion", title: "Presentación y stock", icon: CubeIcon },
    { name: "decoracion", title: "Decoración y destacados", icon: SparklesIcon },
    { name: "ficha", title: "Ficha técnica", icon: PackageIcon },
    { name: "seo", title: "SEO", icon: SearchIcon },
  ],
  fields: [
    // ---- BÁSICO ----
    defineField({
      name: "sku",
      title: "SKU",
      type: "string",
      group: "basico",
      description: "Código interno del producto. Tiene que ser único.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "name",
      title: "Nombre",
      type: "string",
      group: "basico",
      description: "Nombre que ve el cliente en el catálogo.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug (URL)",
      type: "slug",
      group: "basico",
      description:
        'Parte final de la URL del producto. Tocá "Generate" para crearlo a partir del nombre.',
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
      description:
        "Tipo de cristalería o envase (ej: copa de coctel, botella). Opcional, pero ayuda a filtrar.",
      to: [{ type: "subtype" }],
    }),
    defineField({
      name: "description",
      title: "Descripción",
      type: "text",
      group: "basico",
      rows: 4,
      description: "Texto descriptivo del producto que se muestra en la ficha.",
    }),
    defineField({
      name: "images",
      title: "Imágenes",
      type: "array",
      group: "basico",
      description:
        "La primera imagen es la principal (la que se ve en el listado). Podés arrastrar para reordenar.",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "legacyImageUrl",
      title: "URL legacy de imagen (Wix CDN)",
      type: "url",
      group: "basico",
      description:
        "Solo migración: URL de Wix usada hasta pasar las imágenes al CDN de Sanity. No completar a mano — se reemplaza por `Imágenes` al correr el script migrate-images-to-sanity.",
    }),

    // ---- PRECIOS Y OFERTA ----
    defineField({
      name: "pricePublic",
      title: "Precio público (visitante)",
      type: "number",
      group: "precios",
      description: "Precio normal que ve un visitante no logueado.",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "priceWholesale",
      title: "Precio mayorista",
      type: "number",
      group: "precios",
      description: "Precio para clientes mayoristas logueados.",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "isOnSale",
      title: "En oferta",
      type: "boolean",
      group: "precios",
      initialValue: false,
      description:
        "Activá esto para mostrar el producto en oferta con el precio tachado. Si lo activás, completá abajo el precio de oferta.",
    }),
    defineField({
      name: "salePrice",
      title: "Precio de oferta (público)",
      type: "number",
      group: "precios",
      hidden: ({ parent }) => !parent?.isOnSale,
      description:
        "Precio promocional que se muestra en lugar del precio público mientras la oferta está activa.",
      validation: (r) =>
        r.custom((value, ctx) => {
          const p = ctx.parent as { isOnSale?: boolean; pricePublic?: number };
          if (!p?.isOnSale) return true;
          if (typeof value !== "number")
            return "Completá el precio de oferta o desactivá «En oferta».";
          if (value <= 0) return "El precio de oferta tiene que ser mayor a 0.";
          if (typeof p.pricePublic === "number" && value >= p.pricePublic)
            return "El precio de oferta debería ser menor al precio público.";
          return true;
        }),
    }),
    defineField({
      name: "saleStartDate",
      title: "Inicio de la oferta (opcional)",
      type: "datetime",
      group: "precios",
      hidden: ({ parent }) => !parent?.isOnSale,
      description: "Desde cuándo arranca la oferta. Si lo dejás vacío, vale desde ya.",
    }),
    defineField({
      name: "saleEndDate",
      title: "Fin de la oferta (opcional)",
      type: "datetime",
      group: "precios",
      hidden: ({ parent }) => !parent?.isOnSale,
      description: "Hasta cuándo dura la oferta. Si lo dejás vacío, no caduca.",
      validation: (r) =>
        r.custom((value, ctx) => {
          const p = ctx.parent as { saleStartDate?: string };
          if (value && p?.saleStartDate && value < p.saleStartDate)
            return "El fin de la oferta no puede ser anterior al inicio.";
          return true;
        }),
    }),
    defineField({
      name: "pricePublicOld",
      title: "Precio público anterior (tachado)",
      type: "number",
      group: "precios",
      description:
        "Precio anterior que aparece tachado. Lo usa el catálogo actual para mostrar el ahorro. Tip: si activás «En oferta», poné acá el precio público viejo para que se vea el tachado.",
    }),

    // ---- PRESENTACIÓN Y STOCK ----
    defineField({
      name: "presentations",
      title: "Presentaciones",
      type: "array",
      group: "presentacion",
      of: [{ type: "string" }],
      description:
        'Opciones de presentación que ve el cliente (ej: "24un en Caja", "2025un en Pallet"). Vienen del export de Wix.',
    }),
    defineField({
      name: "unitsPerBulk",
      title: "Unidades por bulto",
      type: "number",
      group: "presentacion",
      description: "Cuántas unidades trae una caja/bulto.",
      validation: (r) => r.required().integer().positive(),
    }),
    defineField({
      name: "unitsPerPallet",
      title: "Unidades por pallet",
      type: "number",
      group: "presentacion",
      description: "Cuántas unidades entran en un pallet (opcional).",
      validation: (r) => r.integer().positive(),
    }),
    defineField({
      name: "deliveryTime",
      title: "Plazo de entrega",
      type: "string",
      group: "presentacion",
      initialValue: "24-48 hs",
      description: "Plazo estimado de entrega que se muestra en la ficha.",
    }),
    defineField({
      name: "stockLevel",
      title: "Stock",
      type: "string",
      group: "presentacion",
      description: "Estado de disponibilidad que ve el cliente.",
      options: {
        list: [
          { title: "Disponible", value: "ok" },
          { title: "Stock limitado", value: "low" },
          { title: "Sin stock", value: "out" },
        ],
        layout: "radio",
      },
      initialValue: "ok",
    }),
    defineField({
      name: "mondayItemId",
      title: "Monday item ID (sync stock)",
      type: "string",
      group: "presentacion",
      description:
        "ID del item en Monday — para sincronizar stock real. Se completa cuando llegue el acceso a Monday.",
    }),

    // ---- DECORACIÓN Y DESTACADOS ----
    defineField({
      name: "badges",
      title: "Destacados / Badges",
      type: "array",
      group: "decoracion",
      description:
        "Etiquetas que aparecen sobre la foto del producto en el catálogo (ej: Nuevo, Más vendido).",
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
      description: "Activado si el producto se puede decorar/personalizar.",
    }),

    // ---- FICHA TÉCNICA ----
    defineField({
      name: "specs",
      title: "Especificaciones técnicas",
      type: "array",
      group: "ficha",
      description:
        "Pares atributo/valor (ej: Material → Cristal sin plomo). Se muestran como tabla en la ficha.",
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

    // ---- SEO ----
    defineField({
      name: "seoTitle",
      title: "Título SEO",
      type: "string",
      group: "seo",
      description:
        "Título para Google y redes (50-60 caracteres). Si lo dejás vacío se usa el nombre del producto.",
      validation: (r) => r.max(70).warning("Mejor que no pase de 60-70 caracteres."),
    }),
    defineField({
      name: "seoDescription",
      title: "Descripción SEO (meta description)",
      type: "text",
      group: "seo",
      rows: 3,
      description:
        "Texto que aparece debajo del título en Google (150-160 caracteres). Si lo dejás vacío se usa la descripción.",
      validation: (r) => r.max(180).warning("Mejor que no pase de 160 caracteres."),
    }),
  ],
  preview: {
    select: {
      title: "name",
      sku: "sku",
      price: "pricePublic",
      salePrice: "salePrice",
      isOnSale: "isOnSale",
      stock: "stockLevel",
      media: "images.0",
    },
    prepare({ title, sku, price, salePrice, isOnSale, stock, media }) {
      const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;
      let precio: string;
      if (isOnSale && typeof salePrice === "number") {
        precio = `Oferta ${fmt(salePrice)}`;
      } else if (typeof price === "number") {
        precio = fmt(price);
      } else {
        precio = "sin precio";
      }
      const stockLabel =
        stock === "out"
          ? "Sin stock"
          : stock === "low"
            ? "Stock limitado"
            : null;
      const subtitle = [sku || null, precio, stockLabel]
        .filter(Boolean)
        .join("  ·  ");
      return {
        title: title || "(Sin nombre)",
        subtitle,
        media,
      };
    },
  },
});
