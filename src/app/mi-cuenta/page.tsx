import { UserButton } from "@clerk/nextjs";
import { getUser, getUserRole, isAdmin } from "@/lib/user";
import Link from "next/link";

export default async function MiCuentaPage() {
  const user = await getUser();
  const role = await getUserRole();
  const admin = await isAdmin();

  if (!user) return null; // el middleware ya redirige; safety

  const empresa =
    (user.publicMetadata?.empresa as string | undefined) ?? "Pendiente";

  return (
    <div className="wrap" style={{ padding: "48px 24px 80px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "32px",
        }}
      >
        <div>
          <span className="eyebrow">Mi cuenta</span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            Hola, {user.firstName ?? user.username ?? "mayorista"}
          </h1>
          <p className="lead" style={{ marginTop: "8px" }}>
            {empresa} · <RoleBadge role={role} />
          </p>
        </div>
        <UserButton />
      </div>

      {role === "pending" && (
        <div
          style={{
            padding: "20px 24px",
            background: "var(--warn-bg)",
            border: "1px solid var(--warn)",
            borderRadius: "var(--r)",
            marginBottom: "32px",
          }}
        >
          <strong>Tu cuenta está en revisión.</strong> En cuanto DC Inc apruebe
          tu registro vas a ver precios mayoristas en todo el catálogo. Si
          pasaron más de 24 h hábiles escribinos por WhatsApp.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
        }}
      >
        <Tile href="/productos" title="Ver catálogo" body="Explorá los 300 SKUs disponibles." />
        <Tile href="/carrito" title="Mi pedido en curso" body="Retomá donde lo dejaste." />
        <Tile href="/personaliza" title="Cotizar decorado" body="Serigrafía, calcos, grabado." />
      </div>

      {admin && (
        <div style={{ marginTop: "40px" }}>
          <h3 className="h-md" style={{ fontSize: "18px", marginBottom: "12px" }}>
            Panel admin
          </h3>
          <Tile
            href="/admin/aprobaciones"
            title="Aprobar mayoristas"
            body="Usuarios pendientes de aprobación."
          />
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    visitor: { label: "Visitante", cls: "badge" },
    pending: { label: "En revisión", cls: "badge badge-low" },
    wholesale: { label: "Mayorista aprobado", cls: "badge badge-best" },
    admin: { label: "Admin", cls: "badge badge-deco" },
  };
  const m = map[role] ?? map.visitor;
  return <span className={m.cls}>{m.label}</span>;
}

function Tile({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "20px",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <h4 className="h-md" style={{ fontSize: "16px", marginBottom: "6px" }}>
        {title}
      </h4>
      <p style={{ fontSize: "14px", color: "var(--muted)" }}>{body}</p>
    </Link>
  );
}
