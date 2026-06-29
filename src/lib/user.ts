import { auth, currentUser } from "@clerk/nextjs/server";

export type UserRole = "visitor" | "pending" | "wholesale" | "admin";

/** Devuelve el role del usuario actual. visitor = no logueado. */
export async function getUserRole(): Promise<UserRole> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return "visitor";
  // 1) Camino rápido: el role viaja en el session token (si se configuró el
  //    claim `metadata` en Clerk).
  const claimRole = (sessionClaims?.metadata as { role?: UserRole } | undefined)?.role;
  if (claimRole) return claimRole;
  // 2) Fallback robusto: leer el publicMetadata real del usuario. Así el rol se
  //    refleja aunque el session token no traiga el claim (evita que el catálogo
  //    siga mostrando precios cliente final tras aprobar un mayorista).
  const user = await currentUser();
  const pubRole = (user?.publicMetadata as { role?: UserRole } | undefined)?.role;
  return pubRole ?? "pending";
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
