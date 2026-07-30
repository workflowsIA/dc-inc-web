"use client";
import Link from "next/link";
import { User } from "lucide-react";
import { useAuth, UserButton } from "@clerk/nextjs";

/**
 * Estado de sesión del header, resuelto en el CLIENTE.
 *
 * Antes el Header hacía `await auth()` en el servidor. Como el Header vive en el
 * layout raíz, esa sola llamada dinámica convertía TODAS las rutas del sitio en
 * dinámicas y anulaba los `export const revalidate` de la home, el catálogo, las
 * categorías y las fichas — o sea, nada se cacheaba en el CDN.
 *
 * Nota: Clerk 7.x de este repo no exporta <SignedIn>/<SignedOut> desde
 * "@clerk/nextjs", así que usamos useAuth() directamente.
 */
export default function HeaderAuth() {
  const { isLoaded, isSignedIn } = useAuth();

  // Placeholder del mismo tamaño para no mover el layout al hidratar.
  if (!isLoaded) {
    return <span className="icon-btn" aria-hidden="true" />;
  }

  return isSignedIn ? (
    <UserButton userProfileMode="navigation" userProfileUrl="/mi-cuenta" />
  ) : (
    <Link className="icon-btn" href="/cuenta" aria-label="Ingresar" prefetch={false}>
      <User />
    </Link>
  );
}
