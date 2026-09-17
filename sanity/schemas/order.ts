import { defineField, defineType, defineArrayMember } from "sanity";
import { BillIcon } from "@sanity/icons";

/**
 * Pedido (order) — espeja un panel de pedidos tipo Wix.
 * Se crea desde el checkout vía /api/orders (server-side, token de escritura),
 * y también puede crearse/editarse a mano desde el Studio.
 *
 * El orderNumber se autogenera en el API route (formato "#10001" / timestamp);
 * acá queda como string editable por si Marce necesita corregirlo.
 */
export default defineType({
  name: "order",
  title: "Pedido",
  type: "document",
  icon: BillIcon,
  fields: [
    defineField({
      name: "orderNumber",
      title: "N° de pedido",
      type: "string",
      description: 'Autogenerado al crear el pedido (ej. "#10001").',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "createdAt",
      title: "Fecha",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (r) => r.required(),
    }),

    // ---- Cliente ----
    defineField({
      name: "clerkUserId",
      title: "ID de usuario (Clerk)",
      type: "string",
      description: "Se setea solo cuando el pedido lo hace un usuario logueado. Habilita el historial en Mi cuenta.",
      readOnly: true,
    }),
    defineField({
      name: "priceBasis",
      title: "Base de precio",
      type: "string",
      description: "Con qué lista se calculó el pedido (recalculado server-side).",
      options: {
        list: [
          { title: "Cliente final", value: "final" },
          { title: "Mayorista", value: "mayorista" },
        ],
        layout: "radio",
      },
      readOnly: true,
    }),
    defineField({ name: "customerName", title: "Nombre del cliente", type: "string" }),
    defineField({ name: "customerEmail", title: "Email", type: "string" }),
    defineField({ name: "customerCompany", title: "Empresa", type: "string" }),
    defineField({ name: "customerPhone", title: "Teléfono", type: "string" }),

    // ---- Items ----
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "orderItem",
          fields: [
            defineField({ name: "name", title: "Producto", type: "string" }),
            defineField({
              name: "sku",
              title: "SKU",
              type: "string",
              description:
                "SKU de lo que se compró: si eligió una presentación (caja / pallet / paquete por color) es el SKU de esa fila de la planilla; si compró por unidad, el del producto.",
            }),
            defineField({
              name: "baseSku",
              title: "SKU del producto base",
              type: "string",
              description: "Solo cuando la línea es una presentación: el SKU del producto (unidad).",
            }),
            defineField({ name: "bultos", title: "Bultos", type: "number" }),
            defineField({ name: "unidades", title: "Unidades", type: "number" }),
            defineField({ name: "precioUnitario", title: "Precio unitario", type: "number" }),
            defineField({ name: "subtotal", title: "Subtotal", type: "number" }),
          ],
          preview: {
            select: { title: "name", sku: "sku", bultos: "bultos", subtotal: "subtotal" },
            prepare({ title, sku, bultos, subtotal }) {
              const parts = [
                typeof bultos === "number" ? `${bultos} bulto${bultos === 1 ? "" : "s"}` : null,
                typeof subtotal === "number" ? `$${subtotal.toLocaleString("es-AR")}` : null,
              ].filter(Boolean);
              return {
                title: title || "(Item)",
                subtitle: [sku, parts.join(" · ")].filter(Boolean).join(" — ") || undefined,
              };
            },
          },
        }),
      ],
    }),

    // ---- Totales ----
    defineField({
      name: "subtotal",
      title: "Subtotal",
      type: "number",
      description: "Neto de productos, SIN IVA y sin envío.",
    }),
    defineField({
      name: "iva",
      title: "IVA",
      type: "number",
      description:
        "IVA total del pedido: el de los productos MÁS el del envío. Ojo: Subtotal + IVA NO es el precio de los productos con IVA. El desglose está en los dos campos siguientes.",
    }),
    defineField({
      name: "ivaProductos",
      title: "IVA de productos",
      type: "number",
      description: "Parte del IVA total que corresponde a los productos (sobre el Subtotal).",
    }),
    defineField({
      name: "ivaEnvio",
      title: "IVA del envío",
      type: "number",
      description: "Parte del IVA total que corresponde al envío (sobre «Envío estimado» en neto).",
    }),
    defineField({
      name: "total",
      title: "Total",
      type: "number",
      description: "Lo que pagó el cliente: productos con IVA + envío con IVA.",
    }),

    // ---- Envío ----
    // Los escribe /api/orders al crear el pedido (estimado server-side por CP o
    // por zona Batu, ver src/lib/shipping.ts). Solos de lectura: el precio ya se
    // cobró con este valor, editarlo acá no recotiza nada.
    defineField({
      name: "cpDestino",
      title: "CP de destino",
      type: "string",
      description: "Código postal que cargó el cliente en el checkout (normalizado a 4 dígitos).",
      readOnly: true,
    }),
    defineField({
      name: "zonaBatu",
      title: "Zona Batu",
      type: "number",
      description:
        "Zona de reparto propio (1 a 4) si el cliente eligió Batu. Vacío si se estimó por banda de CP.",
      readOnly: true,
    }),
    defineField({
      name: "customerTaxId",
      title: "CUIT o DNI",
      type: "string",
      description: "Lo carga el cliente en el checkout. Necesario para facturar.",
      readOnly: true,
    }),
    defineField({
      name: "customerAddress",
      title: "Dirección de entrega",
      type: "string",
      description: "Lo carga el cliente en el checkout, junto con el código postal.",
      readOnly: true,
    }),
    defineField({
      name: "shippingToQuote",
      title: "Envío a cotizar",
      type: "boolean",
      readOnly: true,
      description:
        "ACTIVADO = a este pedido NO se le cobró envío y hay que cotizarlo con el cliente antes de despachar (pasa cuando el pedido supera el peso máximo de las tarifas cargadas). APAGADO = el envío ya se cobró: el monto está en «Envío estimado». Este texto aparece en todos los pedidos; lo que vale es el interruptor.",
    }),
    defineField({
      name: "envioEstimado",
      title: "Envío estimado",
      type: "number",
      description:
        "Envío que se le cobró al cliente, CON IVA incluido. Ya está sumado en el Total. Cuenta de control: Subtotal + IVA de productos + este valor = Total.",
      readOnly: true,
    }),
    defineField({
      name: "bultosDespacho",
      title: "Bultos a despachar",
      type: "number",
      readOnly: true,
      description:
        "Cuántos paquetes salen del depósito con este pedido, ya aplicada la regla de consolidación: los bultos chicos se juntan y los grandes salen de a uno. Es el número con el que se cotizó el envío. Vacío = no se pudo calcular (algún producto sin peso cargado).",
    }),

    // ---- Estados ----
    defineField({
      name: "paymentStatus",
      title: "Estado de pago",
      type: "string",
      options: {
        list: [
          { title: "No pagado", value: "no_pagado" },
          { title: "Pagado", value: "pagado" },
          // "Expirado": pedido que inició pago y nunca lo terminó; lo marca la
          // barredora /api/orders/expire-pending tras > EXPIRE_PENDING_HOURS.
          { title: "Expirado", value: "expirado" },
          // Anulaciones manuales (Marce, desde el panel). "Devuelto" = se cobró
          // y después se reintegró la plata (ej. pruebas reales de Nave).
          // Ninguno de los dos cuenta en las métricas de ventas del Dashboard.
          { title: "Cancelado", value: "cancelado" },
          { title: "Devuelto / reembolsado", value: "devuelto" },
        ],
        layout: "radio",
      },
      initialValue: "no_pagado",
      description:
        "Solo los pedidos «Pagado» suman en las ventas del panel. Si un pedido se cobró y después se devolvió la plata, marcalo «Devuelto» (o borralo desde el menú ⋯ del pedido si fue una prueba).",
    }),
    defineField({
      name: "isTest",
      title: "Pedido de prueba",
      type: "boolean",
      initialValue: false,
      description:
        "Marcalo si el pedido fue una prueba interna: queda guardado pero no cuenta en ventas, pedidos ni ticket promedio del panel.",
    }),
    defineField({
      name: "paymentProvider",
      title: "Medio de pago",
      type: "string",
      description: "Pasarela que confirmó el cobro (ej. nave). Vacío si se cerró por WhatsApp.",
      readOnly: true,
    }),
    defineField({
      name: "paymentId",
      title: "ID de pago",
      type: "string",
      description: "ID del pago en la pasarela, para conciliar contra el panel.",
      readOnly: true,
    }),
    defineField({
      name: "naveExternalId",
      title: "External payment ID (Nave)",
      type: "string",
      description: "ID que enviamos a Nave como external_payment_id para conciliar el webhook.",
      readOnly: true,
    }),
    defineField({
      name: "navePaymentRequestId",
      title: "Intención de pago (Nave)",
      type: "string",
      description: "ID de la payment_request en Nave — usado para conciliar por polling sin webhook.",
      readOnly: true,
    }),
    defineField({
      name: "stockAppliedAt",
      title: "Unidades registradas en el inventario",
      type: "datetime",
      description:
        "Momento en que las unidades de este pedido se sumaron a la columna «Pedidos WEB» de la planilla de inventario. Lo escribe el sistema al confirmarse el pago y sirve para no contarlas dos veces si la confirmación llega por más de un camino. Vacío = todavía no se registraron.",
      readOnly: true,
    }),
    defineField({
      name: "fulfillmentStatus",
      title: "Estado de procesamiento",
      type: "string",
      options: {
        list: [
          { title: "No procesado", value: "no_procesado" },
          { title: "Procesado", value: "procesado" },
          { title: "Enviado", value: "enviado" },
        ],
        layout: "radio",
      },
      initialValue: "no_procesado",
    }),
    defineField({
      name: "origin",
      title: "Origen",
      type: "string",
      options: {
        list: [
          { title: "Web", value: "web" },
          { title: "WhatsApp", value: "whatsapp" },
        ],
        layout: "radio",
      },
      initialValue: "web",
    }),
    defineField({ name: "notes", title: "Notas", type: "text", rows: 3 }),
  ],

  orderings: [
    {
      title: "Más recientes primero",
      name: "createdAtDesc",
      by: [{ field: "createdAt", direction: "desc" }],
    },
  ],

  preview: {
    select: {
      orderNumber: "orderNumber",
      customerName: "customerName",
      customerCompany: "customerCompany",
      createdAt: "createdAt",
      total: "total",
      paymentStatus: "paymentStatus",
      fulfillmentStatus: "fulfillmentStatus",
      isTest: "isTest",
    },
    prepare({ orderNumber, customerName, customerCompany, createdAt, total, paymentStatus, fulfillmentStatus, isTest }) {
      const cliente = [customerName, customerCompany].filter(Boolean).join(" · ");
      const fecha = createdAt
        ? new Date(createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";
      const totalLabel = typeof total === "number" ? `$${total.toLocaleString("es-AR")}` : "";
      const pagoLabel =
        paymentStatus === "pagado"
          ? "Pagado"
          : paymentStatus === "expirado"
            ? "Expirado"
            : paymentStatus === "cancelado"
              ? "Cancelado"
              : paymentStatus === "devuelto"
                ? "Devuelto"
                : "No pagado";
      const estado = [
        isTest ? "PRUEBA" : null,
        pagoLabel,
        fulfillmentStatus === "enviado" ? "Enviado" : fulfillmentStatus === "procesado" ? "Procesado" : "No procesado",
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        title: [orderNumber, cliente].filter(Boolean).join(" — ") || "(Pedido)",
        subtitle: [fecha, totalLabel, estado].filter(Boolean).join(" · "),
      };
    },
  },
});
