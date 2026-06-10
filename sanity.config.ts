import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./sanity/schemas";

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
  basePath: "/studio",
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
