import { useEffect, useState } from "react";
import { useClient } from "sanity";

interface CatRow {
  name: string;
  count: number;
}
interface Metrics {
  total: number;
  conFoto: number;
  sinFoto: number;
  otros: number;
  sinSubtipo: number;
  destacados: number;
  conDescripcion: number;
  conPresentacion: number;
  combos: number;
  marcas: number;
  articulos: number;
  porCategoria: CatRow[];
}

const QUERY = `{
  "total": count(*[_type == "product"]),
  "conFoto": count(*[_type == "product" && (defined(images) || defined(legacyImageUrl))]),
  "sinFoto": count(*[_type == "product" && !defined(images) && !defined(legacyImageUrl)]),
  "otros": count(*[_type == "product" && category->name == "Otros"]),
  "sinSubtipo": count(*[_type == "product" && category->name == "Copas y vasos" && !defined(subtype)]),
  "destacados": count(*[_type == "product" && count(badges) > 0]),
  "conDescripcion": count(*[_type == "product" && defined(description)]),
  "conPresentacion": count(*[_type == "product" && count(presentations) > 0]),
  "combos": count(*[_type == "combo"]),
  "marcas": count(*[_type == "brand"]),
  "articulos": count(*[_type == "blogPost"]),
  "porCategoria": *[_type == "category"] | order(order asc) {
    name, "count": count(*[_type == "product" && references(^._id)])
  }
}`;

const AMBER = "#E8B53D";
const CHARCOAL = "#2A2A2C";

export function Dashboard() {
  const client = useClient({ apiVersion: "2024-01-01" });
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    client
      .fetch<Metrics>(QUERY)
      .then((r) => alive && setM(r))
      .catch((e) => alive && setErr(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [client]);

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1000, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span style={{ width: 10, height: 28, background: AMBER, borderRadius: 3, display: "inline-block" }} />
        <h1 style={{ fontSize: 26, fontWeight: 800, color: CHARCOAL, margin: 0 }}>Panel DC Inc</h1>
      </div>
      <p style={{ color: "#6E6E6B", margin: "0 0 28px 22px" }}>
        Estado del catálogo y del contenido del sitio.
      </p>

      {err && (
        <div style={{ background: "#FDECEC", color: "#B42318", padding: 16, borderRadius: 10 }}>
          Error cargando métricas: {err}
        </div>
      )}

      {!m && !err && <p style={{ color: "#6E6E6B" }}>Cargando métricas…</p>}

      {m && (
        <>
          {/* MÉTRICAS PRINCIPALES */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            <Card label="Productos" value={m.total} />
            <Card label="Con foto" value={m.conFoto} sub={`${pct(m.conFoto, m.total)}%`} good={m.sinFoto === 0} />
            <Card label="Con descripción" value={m.conDescripcion} sub={`${pct(m.conDescripcion, m.total)}%`} />
            <Card label="Con presentación" value={m.conPresentacion} sub={`${pct(m.conPresentacion, m.total)}%`} />
            <Card label="Destacados" value={m.destacados} />
            <Card label="Combos" value={m.combos} />
            <Card label="Marcas / clientes" value={m.marcas} />
            <Card label="Artículos blog" value={m.articulos} />
          </div>

          {/* NECESITA ATENCIÓN */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, margin: "32px 0 12px" }}>
            Necesita atención
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <Alert label="Productos sin foto" value={m.sinFoto} />
            <Alert label='Productos en "Otros"' value={m.otros} />
            <Alert label="Cristalería sin subtipo" value={m.sinSubtipo} />
          </div>

          {/* POR CATEGORÍA */}
          <h2 style={{ fontSize: 16, fontWeight: 700, color: CHARCOAL, margin: "32px 0 12px" }}>
            Productos por categoría
          </h2>
          <div style={{ display: "grid", gap: 10, background: "#fff", border: "1px solid #ECECEC", borderRadius: 12, padding: 20 }}>
            {m.porCategoria.map((c) => (
              <Bar key={c.name} name={c.name} count={c.count} max={Math.max(...m.porCategoria.map((x) => x.count), 1)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function Card({ label, value, sub, good }: { label: string; value: number; sub?: string; good?: boolean }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ECECEC", borderRadius: 12, padding: "18px 18px" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: CHARCOAL, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#6E6E6B", marginTop: 6 }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 12, color: good ? "#16A34A" : AMBER, fontWeight: 700, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function Alert({ label, value }: { label: string; value: number }) {
  const ok = value === 0;
  return (
    <div
      style={{
        background: ok ? "#F0FDF4" : "#FFF8EC",
        border: `1px solid ${ok ? "#BBF7D0" : "#F5D98B"}`,
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, color: ok ? "#16A34A" : "#B7791F" }}>{value}</div>
      <div style={{ fontSize: 13, color: CHARCOAL }}>
        {label}
        {ok && <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>✓ todo ok</div>}
      </div>
    </div>
  );
}

function Bar({ name, count, max }: { name: string; count: number; max: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 130, fontSize: 13, color: CHARCOAL, flex: "none" }}>{name}</div>
      <div style={{ flex: 1, background: "#F3F3F1", borderRadius: 6, height: 22, overflow: "hidden" }}>
        <div style={{ width: `${(count / max) * 100}%`, background: AMBER, height: "100%", borderRadius: 6 }} />
      </div>
      <div style={{ width: 44, textAlign: "right", fontSize: 13, fontWeight: 700, color: CHARCOAL, flex: "none" }}>
        {count}
      </div>
    </div>
  );
}
