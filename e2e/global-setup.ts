import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Global setup: genera el Testing Token de Clerk (evita el bot-protection y el
 * rate-limit de Clerk durante los tests). Lee las claves del entorno:
 *   CLERK_PUBLISHABLE_KEY (o NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) + CLERK_SECRET_KEY.
 * Con la instancia en modo development (caso actual de DC Inc) alcanza.
 */
export default async function globalSetup() {
  await clerkSetup();
}
