import { defineField, defineType } from "sanity";
import { PriceWithIvaInput } from "./PriceWithIvaInput";
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
      name: "subtypes",
      title: "Subtipos",
      type: "array",
      group: "basico",
      description:
        "Tipo de cristalería o envase (ej: Cognac, Whisky, Pinta). Podés elegir más de uno: el producto aparece en el filtro de cada subtipo que marques.",
      of: [{ type: "reference", to: [{ type: "subtype" }] }],
      validation: (r) => r.unique(),
    }),
    defineField({
      // Campo viejo (una sola referencia). Se migró a `subtypes` (array) en
      // ago-2026 — ver scripts/migrate-subtypes.ts. Queda oculto para no perder
      // datos mientras se corre la migración; la web lee subtypes y cae a este.
      name: "subtype",
      title: "Subtipo (campo viejo)",
      type: "reference",
      group: "basico",
      to: [{ type: "subtype" }],
      hidden: true,
      readOnly: true,
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
      name: "fromSheet",
      title: "Creado desde la planilla",
      type: "boolean",
      group: "basico",
      readOnly: true,
      hidden: ({ value }) => !value,
      description:
        "Lo creó la sincronización al detectar un SKU nuevo en la planilla de precios. Completá foto y categoría y publicalo para que aparezca en la web.",
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
    // Los precios NO se editan acá: los escribe la sincronización desde la
    // planilla de precios (ProductosDC-Todos) todos los días. Se muestran solo
    // como información. Si un precio está mal, se corrige en la planilla.
    defineField({
      name: "pricePublic",
      title: "Precio unitario NETO (sin IVA) — desde la planilla",
      type: "number",
      group: "precios",
      readOnly: true,
      description:
        "Precio por unidad SIN IVA que trae la planilla de precios (columna «Precio unitario» de ProductosDC-Todos). No se edita acá: lo pisa la sincronización diaria. En la web, el cliente final lo ve con IVA incluido (× 1,21) y el mayorista lo ve neto + IVA.",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "priceWholesale",
      title: "Precio mayorista NETO — desde la planilla (igual al unitario)",
      type: "number",
      group: "precios",
      readOnly: true,
      hidden: ({ parent }) =>
        typeof parent?.pricePublic === "number" && parent?.priceWholesale === parent?.pricePublic,
      description:
        "Mismo neto que el precio unitario: hoy no hay una lista mayorista aparte, el mayorista se diferencia por comprar por caja/pallet (ver «Precios por presentación») y por ver el precio sin IVA. Solo aparece si difiere del unitario.",
      validation: (r) => r.required().positive(),
    }),
    defineField({
      name: "priceFinalInfo",
      title: "Precio que ve el cliente final (con IVA)",
      type: "string",
      group: "precios",
      readOnly: true,
      description: "Calculado: precio unitario neto × 1,21. Solo informativo.",
      components: { input: PriceWithIvaInput },
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
      title: "Precio de oferta por unidad (NETO, sin IVA)",
      type: "number",
      group: "precios",
      hidden: ({ parent }) => !parent?.isOnSale,
      description:
        "Precio promocional NETO por unidad que reemplaza al precio unitario mientras la oferta está activa (la web le suma el IVA igual que al normal). Este sí se edita acá. Aplica solo al cliente final y a la compra por unidad.",
      validation: (r) =>
        r.custom((value, ctx) => {
          const p = ctx.parent as { isOnSale?: boolean; pricePublic?: number };
          if (!p?.isOnSale) return true;
          if (typeof value !== "number")
            return "Completá el precio de oferta o desactivá «En oferta».";
          if (value <= 0) return "El precio de oferta tiene que ser mayor a 0.";
          if (typeof p.pricePublic === "number" && value >= p.pricePublic)
            return "El precio de oferta debería ser menor al precio unitario neto.";
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
      title: "Precio anterior tachado (NETO, sin IVA)",
      type: "number",
      group: "precios",
      description:
        "Opcional. Precio unitario NETO anterior que aparece tachado al lado del actual, para mostrar el ahorro. Se edita acá (la planilla no lo maneja).",
    }),

    // ---- PRESENTACIÓN Y STOCK ----
    defineField({
      name: "presentations",
      title: "Presentaciones",
      type: "array",
      group: "presentacion",
      of: [{ type: "string" }],
      description:
        'Texto heredado de Wix, SOLO informativo. Las presentaciones que se venden (Caja / Pallet) salen de las filas de la planilla de precios (ver "Precios por presentación"): si la planilla no tiene fila de caja, la web no ofrece caja.',
    }),
    defineField({
      name: "presentationPricing",
      title: "Precios por presentación (bulto)",
      type: "array",
      group: "presentacion",
      readOnly: true,
      description:
        "Las presentaciones que la web OFRECE (Caja / Pallet / Paquete…), una por cada fila con sufijo que tiene el producto en la planilla de precios (ej. B355C = caja, B355P = pallet). Lo carga la sincronización: si falta una presentación, hay que agregar la fila en la planilla, no acá. Los precios son POR UNIDAD, NETOS (sin IVA), a ese markup.",
      of: [
        {
          type: "object",
          fields: [
            { name: "sku", title: "SKU de la fila (planilla)", type: "string" },
            { name: "label", title: "Presentación", type: "string" },
            {
              name: "variant",
              title: "Distintivo (ej. color)",
              type: "string",
              description: "Lo que esa fila agrega respecto de la base, ej. «Lisa Negra» en una tapa corona.",
            },
            { name: "unitsPerBulk", title: "Unidades por bulto", type: "number" },
            { name: "pricePublic", title: "Precio por unidad NETO (sin IVA)", type: "number" },
            {
              name: "priceWholesale",
              title: "Precio mayorista por unidad NETO (igual al anterior)",
              type: "number",
              hidden: ({ parent }) => parent?.priceWholesale === parent?.pricePublic,
            },
          ],
          preview: {
            select: { title: "label", variant: "variant", units: "unitsPerBulk", price: "pricePublic", sku: "sku" },
            prepare({ title, variant, units, price, sku }) {
              const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
              const subtitle = [
                units ? `${units} u` : null,
                typeof price === "number" ? `${fmt(price)}/u neto` : null,
                sku ? String(sku) : null,
              ]
                .filter(Boolean)
                .join("  ·  ");
              const t = [title || "(presentación)", variant].filter(Boolean).join(" · ");
              return { title: t, subtitle };
            },
          },
        },
      ],
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
      name: "stockQty",
      title: "Stock (unidades)",
      type: "number",
      group: "presentacion",
      description:
        "Stock real en piezas individuales. Se sincroniza desde la planilla (Productos_Inventario_DC → Stock Venta). No editar a mano: lo pisa la sincronización.",
      validation: (r) => r.integer(),
    }),
    defineField({
      name: "stockMin",
      title: "Stock mínimo (umbral)",
      type: "number",
      group: "presentacion",
      description:
        "Umbral de reposición (Minimos stock). Si el stock real baja de este número, el cliente ve 'Stock limitado'. Se sincroniza desde la planilla.",
      validation: (r) => r.integer().positive(),
    }),
    defineField({
      name: "stockLevel",
      title: "Stock (estado mostrado)",
      type: "string",
      group: "presentacion",
      description:
        "Estado de disponibilidad que ve el cliente. Se calcula automáticamente desde el stock real: 0 = Sin stock, ≤ mínimo = Limitado, resto = Disponible. Override manual solo si hace falta.",
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
      name: "homeFeatured",
      title: "Destacar en el home",
      type: "boolean",
      group: "decoracion",
      initialValue: false,
      description:
        "Activalo para que el producto salga en la portada (las 3 fotos grandes del inicio y la sección «Productos destacados»). Si no hay ninguno marcado, se usan los que tienen el badge «Más vendido». El orden entre destacados lo define «Orden en el catálogo».",
    }),
    defineField({
      name: "sortOrder",
      title: "Orden en el catálogo",
      type: "number",
      group: "decoracion",
      description:
        "Opcional. Los productos con número aparecen primero en el catálogo, de menor a mayor (1, 2, 3…). Los que no tienen número van después, agrupados por categoría y por nombre. Sirve también para ordenar los destacados del home.",
      validation: (r) => r.integer().min(0),
    }),
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
    defineField({
      name: "decoFamily",
      title: "Tarifa de decorado que aplica",
      type: "string",
      group: "decoracion",
      description:
        "Qué tarifa de serigrafía de la planilla usa la ficha para cotizar el decorado (según tamaño del envase). Vacío = la ficha no ofrece decorado con precio (solo la página Personalización). Se completa solo la primera vez (script) y se puede corregir acá.",
      options: {
        list: [
          { title: "Botellas 330 a 500 ml", value: "botella-chica" },
          { title: "Botellas 660 a 1000 ml", value: "botella-grande" },
          { title: "Botellón 1 litro", value: "botellon-1l" },
          { title: "Botellón 2 litros", value: "botellon-2l" },
          { title: "Cristalería (copas y vasos)", value: "cristaleria" },
        ],
      },
      hidden: ({ parent }) => parent?.decoAvailable === false,
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
