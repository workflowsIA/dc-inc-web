import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/user";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function approveWholesale(formData: FormData) {
  "use server";
  const userId = formData.get("userId")?.toString();
  if (!userId) return;
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: "wholesale" },
  });
  revalidatePath("/admin/aprobaciones");
}

async function denyWholesale(formData: FormData) {
  "use server";
  const userId = formData.get("userId")?.toString();
  if (!userId) return;
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: "visitor" },
  });
  revalidatePath("/admin/aprobaciones");
}

export default async function AprobacionesPage() {
  if (!(await isAdmin())) redirect("/mi-cuenta");

  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ limit: 100 });

  const pending = users.filter((u) => {
    const role = (u.publicMetadata?.role as string | undefined) ?? "pending";
    return role === "pending";
  });

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <span className="eyebrow">Admin · Aprobaciones</span>
      <h1 className="h-lg" style={{ marginTop: "12px" }}>
        Mayoristas pendientes
      </h1>
      <p className="lead" style={{ marginTop: "8px" }}>
        {pending.length} usuario{pending.length === 1 ? "" : "s"} esperando aprobación.
      </p>

      {pending.length === 0 ? (
        <div
          style={{
            marginTop: "32px",
            padding: "32px",
            background: "var(--bg-2)",
            borderRadius: "var(--r-lg)",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          No hay pendientes. 🎉
        </div>
      ) : (
        <div style={{ marginTop: "32px", display: "grid", gap: "12px" }}>
          {pending.map((u) => {
            const email = u.emailAddresses[0]?.emailAddress ?? "—";
            const empresa =
              (u.publicMetadata?.empresa as string | undefined) ?? "—";
            const cuit = (u.publicMetadata?.cuit as string | undefined) ?? "—";
            return (
              <div
                key={u.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "16px",
                  alignItems: "center",
                  padding: "16px 20px",
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {u.firstName} {u.lastName} · {empresa}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                    {email} · CUIT {cuit} ·{" "}
                    {new Date(u.createdAt).toLocaleDateString("es-AR")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <form action={approveWholesale}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="btn btn-primary btn-sm" type="submit">
                      Aprobar
                    </button>
                  </form>
                  <form action={denyWholesale}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="btn btn-ghost btn-sm" type="submit">
                      Rechazar
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: "40px",
          fontSize: "13px",
          color: "var(--muted)",
        }}
      >
        Para hacerte admin a vos mismo: andá al dashboard de Clerk → tu usuario
        → Public metadata → poné <code>{`{ "role": "admin" }`}</code>.
      </div>
    </div>
  );
}
