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
} from "@sanity/icons";

/**
 * Estructura custom del Studio — pensada para que Marce encuentre todo rápido.
 * Cuatro grupos top-level claros:
 *   1) Catálogo: productos, categorías, subtipos, combos, marcas (de producto).
 *   2) Ventas: pedidos (Nuevos / Procesados / todos).
 *   3) Clientes: clientes de la vidriera ("confían en nosotros").
 *   4) Contenido del sitio: Home/Hero y Blog.
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

      // ---- CLIENTES ----
      S.listItem()
        .title("Clientes")
        .icon(UsersIcon)
        .child(
          S.list()
            .title("Clientes")
            .items([
              S.documentTypeListItem("client").title("Clientes").icon(UsersIcon),
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
              S.documentTypeListItem("hero").title("Home / Hero").icon(HomeIcon),
              S.documentTypeListItem("blogPost").title("Blog").icon(DocumentsIcon),
            ]),
        ),
    ]);
