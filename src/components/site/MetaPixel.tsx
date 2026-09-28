"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

/**
 * Carga el Meta Pixel en todo el sitio público y dispara PageView en cada
 * navegación (la app es SPA: sin esto, Meta solo vería la primera página).
 * No se carga en /admin (Studio de Sanity y panel interno).
 */
export default function MetaPixel() {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const first = useRef(true);

  useEffect(() => {
    if (isAdmin) return;
    // El PageView de la primera carga lo dispara el snippet de init.
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.("track", "PageView");
    } catch {
      /* noop */
    }
  }, [pathname, isAdmin]);

  if (isAdmin || !META_PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
