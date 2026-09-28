"use client";
import { useEffect } from "react";
import { trackPixel } from "@/lib/meta-pixel";

/** ViewContent del Meta Pixel al abrir una ficha de producto. */
export default function TrackViewContent({
  sku,
  name,
  price,
}: {
  sku: string;
  name: string;
  price?: number;
}) {
  useEffect(() => {
    if (!sku) return;
    trackPixel("ViewContent", {
      content_type: "product",
      content_ids: [sku],
      content_name: name,
      ...(price && price > 0 ? { value: price, currency: "ARS" } : {}),
    });
  }, [sku, name, price]);
  return null;
}
