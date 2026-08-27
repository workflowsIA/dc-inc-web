import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { media } from "sanity-plugin-media";
import { DocumentSheetIcon } from "@sanity/icons";
import { schemaTypes } from "./sanity/schemas";
import { structure } from "./sanity/structure";
import { Dashboard } from "./sanity/Dashboard";
import { CsvUpdate } from "./sanity/tools/CsvUpdate";
import { dcTheme } from "./sanity/theme";

// Nota: el studio standalone (sanity deploy → dc-inc.sanity.studio) se buildea
// con Vite, que solo inyecta vars con prefijo SANITY_STUDIO_. Las NEXT_PUBLIC_
// no existen en ese bundle. Por eso usamos fallback con el projectId hardcodeado
// (es público, ya está en sanity.cli.ts). Así funciona embebido en Next y standalone.
const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  "4sov2yyo";
const dataset =
  process.env.SANITY_STUDIO_DATASET ??
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  "production";

export default defineConfig({
  name: "default",
  title: "DC Inc",
  projectId,
  dataset,
  basePath: "/admin",
  // Tema de marca DC (amber + charcoal). Ver sanity/theme.ts.
  theme: dcTheme,
  // structureTool: navegación custom del catálogo. media: biblioteca de imágenes
  // (el "banco de imágenes" estilo Wix) — agrega el ítem "Media" al navbar para
  // ver/subir/administrar todas las fotos y copiar su URL (para el CSV).
  plugins: [structureTool({ structure }), media()],
  schema: { types: schemaTypes },
  // Los banners son singletons (hero-home / hero-home-promo): se editan desde
  // "Contenido del sitio". Sacamos "hero" del botón de crear documento y le
  // quitamos borrar/duplicar/despublicar para que no queden banners huérfanos
  // que nadie sabe si están en uso. Para desactivarlo está el switch "Mostrar
  // este banner" adentro del documento.
  document: {
    newDocumentOptions: (prev) =>
      prev.filter((t) => t.templateId !== "hero" && t.templateId !== "decoPricing"),
    actions: (prev, { schemaType }) =>
      schemaType === "hero" || schemaType === "decoPricing"
        ? prev.filter((a) => !["delete", "duplicate", "unpublish"].includes(String(a.action)))
        : prev,
  },
  // Deshabilitamos "Releases" y "Scheduled Publishing/Drafts" (programación de
  // publicaciones) — no las usamos y solo agregan ruido para Marce.
  releases: { enabled: false },
  scheduledPublishing: { enabled: false },
  tools: (prev) => [
    { name: "dashboard", title: "Dashboard", component: Dashboard },
    { name: "csv-update", title: "Actualizar por CSV", icon: DocumentSheetIcon, component: CsvUpdate },
    // Filtramos cualquier tool de "scheduled drafts/publishing" del navbar.
    ...prev.filter((t) => !/schedul/i.test(t.name) && !/schedul/i.test(String(t.title ?? ""))),
  ],
});
