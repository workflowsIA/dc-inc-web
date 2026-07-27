import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
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
  plugins: [structureTool({ structure })],
  schema: { types: schemaTypes },
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
