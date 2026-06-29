import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Rutas que requieren login. NO incluimos /admin: ahí vive el Studio de Sanity,
 * que tiene su propio login. Las páginas web sueltas de /admin (pedidos /
 * aprobaciones / clientes) se protegen server-side con isAdmin() en cada page.
 */
const isProtectedRoute = createRouteMatcher(["/mi-cuenta(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
