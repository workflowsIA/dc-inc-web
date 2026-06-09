import { createClient } from "next-sanity";
import imageUrlBuilder from "@sanity/image-url";

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.SANITY_API_VERSION ?? "2026-01-01",
  useCdn: process.env.NODE_ENV === "production",
});

export const sanityWriteClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: process.env.SANITY_API_VERSION ?? "2026-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

const builder = imageUrlBuilder(sanityClient);
export function urlForImage(source: unknown) {
  return builder.image(source as never);
}
