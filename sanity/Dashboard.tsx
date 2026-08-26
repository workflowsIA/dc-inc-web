import { useEffect, useMemo, useState } from "react";
import { useClient } from "sanity";
import { useIntentLink } from "sanity/router";
import {
  Badge,
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  Spinner,
  Stack,
  Text,
} from "@sanity/ui";
import {
  BillIcon,
  ClockIcon,
  CloseCircleIcon,
  ImageIcon,
  PackageIcon,
  TagIcon,
  TrendUpwardIcon,
  TrolleyIcon,
} from "@sanity/icons";

/**
 * Dashboard del Studio — espeja el panel de ventas de Wix.
 *
 * Tres bloques:
 *   1. KPIs de ventas (período seleccionable 7/30/90 días).
 *   2. Salud del catálogo (calidad de datos accionable).
 *   3. Últimos pedidos (tabla linkeable al doc del pedido).
 *
 * Degrada con 0 pedidos: muestra ceros / "—" en los KPIs y un empty state
 * amable en la tabla, nunca NaN ni un crash.
 */

const AMBER = "#E8B53D";

type PeriodDays = 7 | 30 | 90;

interface OrderRow {
  _id: string;
  orderNumber?: string;
  createdAt?: string;
  customerName?: string;
  customerCompany?: string;
  total?: number;
  paymentStatus?: "no_pagado" | "pagado" | "expirado" | "cancelado" | "devuelto";
  fulfillmentStatus?: "no_procesado" | "procesado" | "enviado";
  isTest?: boolean;
}

interface Metrics {
  // Ventas (dependen del período)
  ventas: number;
  pedidos: number;
  pendientes: number;
  /** pedidos del período que NO cuentan (impagos, expirados, cancelados, devueltos, pruebas) */
  descartados: number;
  // Catálogo (no dependen del período)
  productos: number;
  sinStock: number;
  enOferta: number;
  sinFoto: number;
  // Tabla
  ultimosPedidos: OrderRow[];
}

/**
 * Qué cuenta como VENTA: solo pedidos con paymentStatus == "pagado" y que no
 * estén marcados como prueba. Los impagos / expirados / cancelados / devueltos
 * quedan afuera (antes se sumaba TODO lo creado, incluidos carritos que nunca
 * se pagaron y pruebas internas → las métricas daban cualquier cosa).
 */
const VENTA_REAL = `_type == "order" && paymentStatus == "pagado" && isTest != true`;

function buildQuery() {
  return `{
    "ventas": coalesce(
      math::sum(*[${VENTA_REAL} && createdAt >= $since].total),
      0
    ),
    "pedidos": count(*[${VENTA_REAL} && createdAt >= $since]),
    "descartados": count(*[_type == "order" && createdAt >= $since && !(paymentStatus == "pagado" && isTest != true)]),
    "pendientes": count(*[${VENTA_REAL} && fulfillmentStatus == "no_procesado"]),
    "productos": count(*[_type == "product"]),
    "sinStock": count(*[_type == "product" && stockLevel == "out"]),
    "enOferta": count(*[_type == "product" && isOnSale == true]),
    "sinFoto": count(*[_type == "product" && !defined(images) && !defined(legacyImageUrl)]),
    "ultimosPedidos": *[_type == "order"] | order(createdAt desc)[0...8]{
      _id, orderNumber, createdAt, customerName, customerCompany,
      total, paymentStatus, fulfillmentStatus, isTest
    }
  }`;
}

const PESOS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function formatPesos(n: number) {
  return PESOS.format(Math.round(n || 0));
}

export function Dashboard() {
  const client = useClient({ apiVersion: "2024-01-01" });
  const [period, setPeriod] = useState<PeriodDays>(30);
  // `result` carga el período al que pertenecen las métricas, así derivamos
  // `loading` sin tener que llamar setState sincrónicamente dentro del efecto.
  const [result, setResult] = useState<{ period: PeriodDays; m: Metrics } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - period);
    return d.toISOString();
  }, [period]);

  useEffect(() => {
    let alive = true;
    client
      .fetch<Metrics>(buildQuery(), { since: sinceISO })
      .then((r) => {
        if (!alive) return;
        setErr(null);
        setResult({ period, m: r });
      })
      .catch((e) => {
        if (!alive) return;
        setErr(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, [client, sinceISO, period]);

  const m = result && result.period === period ? result.m : null;
  const loading = m === null && !err;

  const ticket =
    m && m.pedidos > 0 ? formatPesos(m.ventas / m.pedidos) : "—";

  return (
    <Box padding={[4, 4, 5]} style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Encabezado */}
      <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
        <Flex align="center" gap={3}>
          <Box
            style={{
              width: 10,
              height: 30,
              background: AMBER,
              borderRadius: 3,
            }}
          />
          <Stack space={2}>
            <Heading size={3}>Panel DC Inc</Heading>
            <Text size={1} muted>
              Ventas, pedidos y estado del catálogo.
            </Text>
          </Stack>
        </Flex>
        <PeriodSelector value={period} onChange={setPeriod} />
      </Flex>

      {err && (
        <Card tone="critical" padding={4} radius={3} marginTop={4}>
          <Text size={1}>Error cargando métricas: {err}</Text>
        </Card>
      )}

      {loading && !err && (
        <Flex align="center" gap={3} paddingY={5}>
          <Spinner muted />
          <Text size={1} muted>
            Cargando métricas…
          </Text>
        </Flex>
      )}

      {m && !loading && (
        <Stack space={5} marginTop={5}>
          {/* 1. VENTAS */}
          <Stack space={3}>
            <Text size={1} weight="semibold" muted>
              VENTAS · ÚLTIMOS {period} DÍAS · solo pedidos pagados (sin pruebas, cancelados ni devueltos)
            </Text>
            <Grid columns={[1, 2, 4]} gap={3}>
              <Kpi
                icon={<TrendUpwardIcon />}
                label="Ventas"
                value={formatPesos(m.ventas)}
                accent
              />
              <Kpi
                icon={<BillIcon />}
                label="Pedidos pagados"
                value={String(m.pedidos)}
              />
              <Kpi
                icon={<TrolleyIcon />}
                label="Ticket promedio"
                value={ticket}
              />
              <Kpi
                icon={<ClockIcon />}
                label="Pendientes de procesar"
                value={String(m.pendientes)}
                tone={m.pendientes > 0 ? "caution" : "positive"}
              />
            </Grid>
            {m.descartados > 0 && (
              <Text size={1} muted>
                {m.descartados} {m.descartados === 1 ? "pedido" : "pedidos"} del período no{" "}
                {m.descartados === 1 ? "cuenta" : "cuentan"} (sin pagar, expirados, cancelados, devueltos o de prueba).
              </Text>
            )}
          </Stack>

          {/* 2. CATÁLOGO */}
          <Stack space={3}>
            <Text size={1} weight="semibold" muted>
              SALUD DEL CATÁLOGO
            </Text>
            <Grid columns={[1, 2, 4]} gap={3}>
              <Kpi
                icon={<PackageIcon />}
                label="Productos"
                value={String(m.productos)}
              />
              <Kpi
                icon={<CloseCircleIcon />}
                label="Sin stock"
                value={String(m.sinStock)}
                tone={m.sinStock > 0 ? "caution" : "default"}
              />
              <Kpi
                icon={<TagIcon />}
                label="En oferta"
                value={String(m.enOferta)}
              />
              <Kpi
                icon={<ImageIcon />}
                label="Sin foto"
                value={String(m.sinFoto)}
                tone={m.sinFoto > 0 ? "caution" : "positive"}
              />
            </Grid>
          </Stack>

          {/* 3. ÚLTIMOS PEDIDOS */}
          <Stack space={3}>
            <Text size={1} weight="semibold" muted>
              ÚLTIMOS PEDIDOS
            </Text>
            <OrdersTable rows={m.ultimosPedidos} />
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

/* ---------- Selector de período ---------- */

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodDays;
  onChange: (v: PeriodDays) => void;
}) {
  const opts: PeriodDays[] = [7, 30, 90];
  return (
    <Card padding={1} radius={3} border tone="transparent">
      <Flex gap={1}>
        {opts.map((d) => {
          const active = d === value;
          return (
            <Card
              key={d}
              as="button"
              onClick={() => onChange(d)}
              padding={2}
              radius={2}
              tone={active ? "primary" : "default"}
              style={{ cursor: "pointer", minWidth: 52 }}
            >
              <Text
                size={1}
                weight={active ? "semibold" : "regular"}
                align="center"
                muted={!active}
              >
                {d} días
              </Text>
            </Card>
          );
        })}
      </Flex>
    </Card>
  );
}

/* ---------- Tarjeta KPI ---------- */

type KpiTone = "default" | "caution" | "positive";

function Kpi({
  icon,
  label,
  value,
  tone = "default",
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: KpiTone;
  accent?: boolean;
}) {
  const iconColor =
    tone === "caution"
      ? "#B7791F"
      : tone === "positive"
        ? "#16A34A"
        : AMBER;

  return (
    <Card
      padding={4}
      radius={3}
      border
      style={accent ? { borderColor: AMBER } : undefined}
    >
      <Stack space={3}>
        <Flex align="center" justify="space-between">
          <Text size={1} muted>
            {label}
          </Text>
          <Text size={2} style={{ color: iconColor }}>
            {icon}
          </Text>
        </Flex>
        <Heading size={4} style={accent ? { color: AMBER } : undefined}>
          {value}
        </Heading>
      </Stack>
    </Card>
  );
}

/* ---------- Tabla de pedidos ---------- */

function OrdersTable({ rows }: { rows: OrderRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <Card padding={5} radius={3} border tone="transparent">
        <Stack space={3}>
          <Text align="center" size={3} muted>
            <BillIcon />
          </Text>
          <Text align="center" size={1} weight="semibold">
            Todavía no entraron pedidos por la web
          </Text>
          <Text align="center" size={1} muted>
            Cuando se confirme el primer pedido en el checkout, va a aparecer
            acá.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card radius={3} border overflow="hidden">
      {/* Cabecera */}
      <Box
        padding={3}
        style={{ borderBottom: "1px solid var(--card-border-color)" }}
      >
        <Grid columns={6} gap={2}>
          <HeadCell>Pedido</HeadCell>
          <HeadCell>Fecha</HeadCell>
          <HeadCell>Cliente</HeadCell>
          <HeadCell align="right">Total</HeadCell>
          <HeadCell>Pago</HeadCell>
          <HeadCell>Cumplimiento</HeadCell>
        </Grid>
      </Box>
      <Stack>
        {rows.map((r, i) => (
          <OrderRowItem key={r._id} row={r} last={i === rows.length - 1} />
        ))}
      </Stack>
    </Card>
  );
}

function HeadCell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <Text size={0} weight="semibold" muted align={align}>
      {children}
    </Text>
  );
}

function OrderRowItem({ row, last }: { row: OrderRow; last: boolean }) {
  // Link al documento del pedido vía intent de Sanity.
  const { onClick, href } = useIntentLink({
    intent: "edit",
    params: { id: row._id, type: "order" },
  });

  const fecha = row.createdAt
    ? new Date(row.createdAt).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "—";
  const cliente =
    [row.customerName, row.customerCompany].filter(Boolean).join(" · ") || "—";
  const total = typeof row.total === "number" ? formatPesos(row.total) : "—";

  return (
    <Card
      as="a"
      href={href}
      onClick={onClick}
      padding={3}
      radius={0}
      style={{
        textDecoration: "none",
        borderBottom: last ? "none" : "1px solid var(--card-border-color)",
        cursor: "pointer",
      }}
    >
      <Grid columns={6} gap={2}>
        <Text size={1} weight="semibold">
          {row.orderNumber || "—"}
        </Text>
        <Text size={1} muted>
          {fecha}
        </Text>
        <Text size={1} textOverflow="ellipsis">
          {cliente}
        </Text>
        <Text size={1} weight="semibold" align="right">
          {total}
        </Text>
        <Flex gap={1} wrap="wrap">
          {row.isTest && (
            <Badge tone="default" fontSize={0}>
              Prueba
            </Badge>
          )}
          <PaymentBadge status={row.paymentStatus} />
        </Flex>
        <Box>
          <FulfillmentBadge status={row.fulfillmentStatus} />
        </Box>
      </Grid>
    </Card>
  );
}

function PaymentBadge({ status }: { status?: OrderRow["paymentStatus"] }) {
  if (status === "pagado") {
    return (
      <Badge tone="positive" fontSize={0}>
        Pagado
      </Badge>
    );
  }
  if (status === "expirado") {
    return (
      <Badge tone="default" fontSize={0}>
        Expirado
      </Badge>
    );
  }
  if (status === "cancelado") {
    return (
      <Badge tone="critical" fontSize={0}>
        Cancelado
      </Badge>
    );
  }
  if (status === "devuelto") {
    return (
      <Badge tone="critical" fontSize={0}>
        Devuelto
      </Badge>
    );
  }
  return (
    <Badge tone="caution" fontSize={0}>
      No pagado
    </Badge>
  );
}

function FulfillmentBadge({
  status,
}: {
  status?: OrderRow["fulfillmentStatus"];
}) {
  if (status === "enviado") {
    return (
      <Badge tone="positive" fontSize={0}>
        Enviado
      </Badge>
    );
  }
  if (status === "procesado") {
    return (
      <Badge tone="primary" fontSize={0}>
        Procesado
      </Badge>
    );
  }
  return (
    <Badge tone="caution" fontSize={0}>
      No procesado
    </Badge>
  );
}
