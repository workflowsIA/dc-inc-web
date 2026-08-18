import type { StructureResolver } from "sanity/structure";
import {
  PackageIcon,
  TagIcon,
  TagsIcon,
  TrolleyIcon,
  UsersIcon,
  HomeIcon,
  DocumentsIcon,
  WarningOutlineIcon,
  StarIcon,
  BoltIcon,
  BillIcon,
  ClockIcon,
  CheckmarkCircleIcon,
  CommentIcon,
} from "@sanity/icons";

/**
 * Estructura custom del Studio — pensada para que Marce encuentre todo rápido.
 * Cuatro grupos top-level claros:
 *   1) Catálogo: productos, categorías, subtipos, combos, marcas (de producto).
 *   2) Ventas: pedidos (Nuevos / Procesados / todos).
 *   3) Clientes: cuentas de la tienda (espejo de Clerk) — Todos / En revisión /
 *      Mayoristas. El estado se edita acá y se propaga a Clerk.
 *   4) Contenido del sitio: Home/Hero, Blog y "Marcas con las que trabajamos"
 *      (la vidriera de logos que antes se llamaba "Clientes").
 * Dentro de Productos hay vistas "inteligentes" (filtradas) para detectar
 * lo que falta cargar de un vistazo.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("DC Inc")
    .items([
      // ---- CATÁLOGO ----
      S.listItem()
        .title("Catálogo")
        .icon(PackageIcon)
        .child(
          S.list()
            .title("Catálogo")
            .items([
              // Productos + vistas filtradas
              S.listItem()
                .title("Productos")
                .icon(PackageIcon)
                .child(
                  S.list()
                    .title("Productos")
                    .items([
                      S.documentTypeListItem("product").title("Todos los productos"),
                      S.divider(),
                      // Bandeja de altas: SKUs nuevos que la sincronización
                      // detectó en la planilla y creó como borrador. Completar
                      // foto + categoría y publicar para que salgan a la web.
                      S.listItem()
                        .title("Nuevos desde la planilla")
                        .icon(ClockIcon)
                        .child(
                          S.documentList()
                            .title("Borradores creados por el sync — completar y publicar")
                            .filter('_type == "product" && fromSheet == true && _id in path("drafts.**")'),
                        ),
                      S.listItem()
                        .title("Sin foto")
                        .icon(WarningOutlineIcon)
                        .child(
                          S.documentList()
                            .title("Productos sin foto")
                            .filter('_type == "product" && !defined(images) && !defined(legacyImageUrl)'),
                        ),
                      S.listItem()
                        .title("Categoría: Otros")
                        .icon(WarningOutlineIcon)
                        .child(
                          S.documentList()
                            .title("Sin categorizar bien")
                            .filter('_type == "product" && category->name == "Otros"'),
                        ),
                      S.listItem()
                        .title("Cristalería sin subtipo")
                        .icon(WarningOutlineIcon)
                        .child(
                          S.documentList()
                            .title("Copas/vasos sin subtipo")
                            .filter('_type == "product" && category->name == "Copas y vasos" && !defined(subtype)'),
                        ),
                      S.listItem()
                        .title("Destacados (con badge)")
                        .icon(StarIcon)
                        .child(
                          S.documentList()
                            .title("Productos destacados")
                            .filter('_type == "product" && count(badges) > 0'),
                        ),
                      S.listItem()
                        .title("En oferta")
                        .icon(BoltIcon)
                        .child(
                          S.documentList()
                            .title("Productos en oferta")
                            .filter('_type == "product" && isOnSale == true'),
                        ),
                      S.listItem()
                        .title("Sin stock")
                        .icon(WarningOutlineIcon)
                        .child(
                          S.documentList()
                            .title("Productos sin stock")
                            .filter('_type == "product" && stockLevel == "out"'),
                        ),
                    ]),
                ),
              S.divider(),
              S.documentTypeListItem("category").title("Categorías").icon(TagIcon),
              S.documentTypeListItem("subtype").title("Subtipos").icon(TagsIcon),
              S.documentTypeListItem("combo").title("Combos").icon(TrolleyIcon),
              // Solo marcas de producto. Los logos de clientes viven en "Clientes".
              S.documentTypeListItem("brand").title("Marcas").icon(TagIcon),
            ]),
        ),

      S.divider(),

      // ---- VENTAS ----
      S.listItem()
        .title("Ventas")
        .icon(BillIcon)
        .child(
          S.list()
            .title("Ventas")
            .items([
              S.listItem()
                .title("Pedidos")
                .icon(BillIcon)
                .child(
                  S.list()
                    .title("Pedidos")
                    .items([
                      S.listItem()
                        .title("Todos")
                        .icon(BillIcon)
                        .child(
                          S.documentList()
                            .title("Todos los pedidos")
                            .filter('_type == "order"')
                            .defaultOrdering([{ field: "createdAt", direction: "desc" }]),
                        ),
                      S.divider(),
                      S.listItem()
                        .title("Nuevos")
                        .icon(ClockIcon)
                        .child(
                          S.documentList()
                            .title("Pedidos nuevos (sin procesar)")
                            .filter('_type == "order" && fulfillmentStatus == "no_procesado"')
                            .defaultOrdering([{ field: "createdAt", direction: "desc" }]),
                        ),
                      S.listItem()
                        .title("Procesados")
                        .icon(CheckmarkCircleIcon)
                        .child(
                          S.documentList()
                            .title("Pedidos procesados / enviados")
                            .filter('_type == "order" && fulfillmentStatus in ["procesado", "enviado"]')
                            .defaultOrdering([{ field: "createdAt", direction: "desc" }]),
                        ),
                    ]),
                ),
            ]),
        ),

      S.divider(),

      // ---- CLIENTES (cuentas de la tienda, espejo de Clerk) ----
      S.listItem()
        .title("Clientes")
        .icon(UsersIcon)
        .child(
          S.list()
            .title("Clientes")
            .items([
              S.listItem()
                .title("Todos")
                .icon(UsersIcon)
                .child(
                  S.documentList()
                    .title("Todos los clientes")
                    .filter('_type == "customer"')
                    .defaultOrdering([{ field: "registeredAt", direction: "desc" }]),
                ),
              S.divider(),
              S.listItem()
                .title("En revisión")
                .icon(ClockIcon)
                .child(
                  S.documentList()
                    .title("Mayoristas en revisión")
                    .filter('_type == "customer" && estado == "en_revision"')
                    .defaultOrdering([{ field: "registeredAt", direction: "desc" }]),
                ),
              S.listItem()
                .title("Mayoristas")
                .icon(CheckmarkCircleIcon)
                .child(
                  S.documentList()
                    .title("Mayoristas aprobados")
                    .filter('_type == "customer" && estado == "mayorista"')
                    .defaultOrdering([{ field: "empresa", direction: "asc" }]),
                ),
            ]),
        ),

      S.divider(),

      // ---- CONTENIDO DEL SITIO ----
      S.listItem()
        .title("Contenido del sitio")
        .icon(HomeIcon)
        .child(
          S.list()
            .title("Contenido del sitio")
            .items([
              // Dos banners fijos, editables como una pantalla cada uno. Sin
              // "crear documento" ni elegir placement: el destino lo define el
              // _id (hero-home / hero-home-promo). Ver sanity/schemas/hero.ts.
              S.listItem()
                .id("hero-home")
                .title("Banner principal de la home")
                .icon(HomeIcon)
                .child(
                  S.document()
                    .schemaType("hero")
                    .documentId("hero-home")
                    .title("Banner principal de la home"),
                ),
              S.listItem()
                .id("hero-home-promo")
                .title("Banner de promo de la home")
                .icon(BoltIcon)
                .child(
                  S.document()
                    .schemaType("hero")
                    .documentId("hero-home-promo")
                    .title("Banner de promo de la home"),
                ),
              S.documentTypeListItem("blogPost").title("Blog").icon(DocumentsIcon),
              S.documentTypeListItem("client").title("Marcas con las que trabajamos").icon(StarIcon),
              S.documentTypeListItem("testimonial").title("Testimonios de clientes").icon(CommentIcon),
            ]),
        ),
    ]);
