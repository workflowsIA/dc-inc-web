import { createClient } from "next-sanity";
import imageUrlBuilder from "@sanity/image-url";

// projectId y dataset son públicos. Fallback hardcodeado para que el sitio
// renderice aunque falten las env vars en el entorno de deploy (ej: Vercel).
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "4sov2yyo";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion: process.env.SANITY_API_VERSION ?? "2026-01-01",
  useCdn: process.env.NODE_ENV === "production",
});

export const sanityWriteClient = createClient({
  projectId,
  dataset,
  apiVersion: process.env.SANITY_API_VERSION ?? "2026-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

const builder = imageUrlBuilder(sanityClient);
export function urlForImage(source: unknown) {
  return builder.image(source as never);
}
