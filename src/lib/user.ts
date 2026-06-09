import { auth, currentUser } from "@clerk/nextjs/server";

export type UserRole = "visitor" | "pending" | "wholesale" | "admin";

/** Devuelve el role del usuario actual. visitor = no logueado. */
export async function getUserRole(): Promise<UserRole> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return "visitor";
  const role = (sessionClaims?.metadata as { role?: UserRole } | undefined)?.role;
  // Si el usuario está logueado pero no tiene role asignado → pending por default
  return role ?? "pending";
}

/** True si el usuario es mayorista aprobado (ve precio wholesale). */
export async function isWholesale(): Promise<boolean> {
  const role = await getUserRole();
  return role === "wholesale" || role === "admin";
}

/** True si el usuario es admin (puede aprobar mayoristas). */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === "admin";
}

/** Datos completos del usuario (Clerk currentUser). */
export async function getUser() {
  return await currentUser();
}
