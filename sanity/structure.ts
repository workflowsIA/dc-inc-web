import type { StructureResolver } from "sanity/structure";

/**
 * Estructura custom del Studio — agrupa el contenido y agrega vistas
 * "inteligentes" (filtradas) para encontrar rápido lo que falta cargar.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("DC Inc")
    .items([
      // ---- CATÁLOGO ----
      S.listItem()
        .title("📦 Catálogo")
        .child(
          S.list()
            .title("Catálogo")
            .items([
              S.documentTypeListItem("product").title("Todos los productos"),
              S.divider(),
              S.listItem()
                .title("⚠️ Sin foto")
                .child(
                  S.documentList()
                    .title("Productos sin foto")
                    .filter('_type == "product" && !defined(images) && !defined(legacyImageUrl)'),
                ),
              S.listItem()
                .title("⚠️ Categoría: Otros")
                .child(
                  S.documentList()
                    .title("Sin categorizar bien")
                    .filter('_type == "product" && category->name == "Otros"'),
                ),
              S.listItem()
                .title("⚠️ Cristalería sin subtipo")
                .child(
                  S.documentList()
                    .title("Copas/vasos sin subtipo")
                    .filter('_type == "product" && category->name == "Copas y vasos" && !defined(subtype)'),
                ),
              S.listItem()
                .title("⭐ Destacados (con badge)")
                .child(
                  S.documentList()
                    .title("Productos destacados")
                    .filter('_type == "product" && count(badges) > 0'),
                ),
              S.divider(),
              S.documentTypeListItem("category").title("Categorías"),
              S.documentTypeListItem("subtype").title("Subtipos"),
            ]),
        ),

      // ---- MARKETING ----
      S.listItem()
        .title("📣 Marketing")
        .child(
          S.list()
            .title("Marketing")
            .items([
              S.documentTypeListItem("combo").title("Combos"),
              S.documentTypeListItem("hero").title("Hero / Banners"),
              S.documentTypeListItem("brand").title("Marcas / Clientes"),
            ]),
        ),

      // ---- BLOG ----
      S.listItem()
        .title("📝 Blog")
        .child(S.documentTypeList("blogPost").title("Artículos")),
    ]);
