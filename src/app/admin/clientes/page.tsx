import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/user";
import { sanityClient } from "@/lib/sanity";
import { ordersByUserStatsQuery } from "@/lib/queries";
import { ars } from "@/lib/format";

export const dynamic = "force-dynamic";

type Role = "visitor" | "pending" | "wholesale" | "admin";

const ROLE_LABEL: Record<Role, string> = {
  visitor: "Visitante",
  pending: "En revisión",
  wholesale: "Mayorista",
  admin: "Admin",
};

const ROLE_COLOR: Record<Role, string> = {
  visitor: "#6b7280",
  pending: "var(--amber-deep)",
  wholesale: "#15803d",
  admin: "#1d4ed8",
};

type OrderStat = { clerkUserId?: string; total?: number; paymentStatus?: string };

/**
 * /admin/clientes — vista única de clientes finales. Los datos de la cuenta
 * viven en Clerk (login); acá los traemos y los cruzamos con los pedidos de
 * Sanity para mostrar #pedidos y total comprado por cada uno.
 */
export default async function ClientesPage() {
  if (!(await isAdmin())) redirect("/mi-cuenta");

  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: 200 });

  const orderStats = await sanityClient.fetch<OrderStat[]>(ordersByUserStatsQuery);

  // Agregamos pedidos por usuario.
  const statsByUser = new Map<string, { count: number; paid: number; spent: number }>();
  for (const o of orderStats) {
    if (!o.clerkUserId) continue;
    const cur = statsByUser.get(o.clerkUserId) ?? { count: 0, paid: 0, spent: 0 };
    cur.count += 1;
    if (o.paymentStatus === "pagado") {
      cur.paid += 1;
      cur.spent += typeof o.total === "number" ? o.total : 0;
    }
    statsByUser.set(o.clerkUserId, cur);
  }

  const rows = users
    .map((u) => {
      const role = ((u.publicMetadata?.role as string | undefined) ?? "pending") as Role;
      const md = (u.unsafeMetadata ?? {}) as Record<string, string>;
      const stats = statsByUser.get(u.id) ?? { count: 0, paid: 0, spent: 0 };
      return {
        id: u.id,
        nombre: [u.firstName, u.lastName].filter(Boolean).join(" ") || md.contacto || "—",
        empresa: md.empresa || "—",
        email: u.emailAddresses[0]?.emailAddress ?? "—",
        cuit: md.cuit || "—",
        telefono: md.telefono || "—",
        role,
        createdAt: u.createdAt,
        ...stats,
      };
    })
    // Mayoristas y pendientes primero, después por más pedidos.
    .sort((a, b) => {
      const rank: Record<Role, number> = { pending: 0, wholesale: 1, admin: 2, visitor: 3 };
      if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role];
      return b.count - a.count;
    });

  const totals = {
    clientes: rows.length,
    mayoristas: rows.filter((r) => r.role === "wholesale").length,
    pendientes: rows.filter((r) => r.role === "pending").length,
  };

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      {/* Sub-nav del panel admin */}
      <nav style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <Link className="btn btn-ghost btn-sm" href="/admin/pedidos">Pedidos</Link>
        <Link className="btn btn-ghost btn-sm" href="/admin/aprobaciones">Aprobaciones</Link>
        <span className="btn btn-primary btn-sm">Clientes</span>
      </nav>

      <span className="eyebrow">Admin · Clientes</span>
      <h1 className="h-lg" style={{ marginTop: "12px" }}>
        Clientes
      </h1>
      <p className="lead" style={{ marginTop: "8px" }}>
        {totals.clientes} cuenta{totals.clientes === 1 ? "" : "s"} · {totals.mayoristas} mayorista
        {totals.mayoristas === 1 ? "" : "s"} · {totals.pendientes} en revisión.
      </p>

      <div style={{ marginTop: "28px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "760px" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
              <th style={{ padding: "8px 10px" }}>Cliente</th>
              <th style={{ padding: "8px 10px" }}>Contacto</th>
              <th style={{ padding: "8px 10px" }}>Rol</th>
              <th style={{ padding: "8px 10px", textAlign: "right" }}>Pedidos</th>
              <th style={{ padding: "8px 10px", textAlign: "right" }}>Comprado</th>
              <th style={{ padding: "8px 10px" }}>Alta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "10px" }}>
                  <div style={{ fontWeight: 700 }}>{r.empresa}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>{r.nombre}</div>
                </td>
                <td style={{ padding: "10px" }}>
                  <div>{r.email}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {r.telefono !== "—" ? r.telefono : ""}
                    {r.cuit !== "—" ? `${r.telefono !== "—" ? " · " : ""}CUIT ${r.cuit}` : ""}
                  </div>
                </td>
                <td style={{ padding: "10px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: ROLE_COLOR[r.role],
                    }}
                  >
                    {ROLE_LABEL[r.role]}
                  </span>
                </td>
                <td style={{ padding: "10px", textAlign: "right" }}>
                  {r.count > 0 ? (
                    <span>
                      {r.count}
                      {r.paid > 0 ? <span style={{ color: "var(--muted)" }}> ({r.paid} pag.)</span> : null}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>
                  {r.spent > 0 ? ars(r.spent) : <span style={{ color: "var(--muted)", fontWeight: 400 }}>—</span>}
                </td>
                <td style={{ padding: "10px", color: "var(--muted)", fontSize: "13px" }}>
                  {new Date(r.createdAt).toLocaleDateString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some((r) => r.role === "pending") && (
        <p style={{ marginTop: "20px", fontSize: "13px", color: "var(--muted)" }}>
          Para aprobar mayoristas en revisión, andá a{" "}
          <Link href="/admin/aprobaciones" style={{ textDecoration: "underline" }}>
            Aprobaciones
          </Link>
          .
        </p>
      )}
    </div>
  );
}
