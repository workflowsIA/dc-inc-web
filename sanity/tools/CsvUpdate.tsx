import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "sanity";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Inline,
  Spinner,
  Stack,
  Text,
  useToast,
} from "@sanity/ui";
import {
  CheckmarkCircleIcon,
  DownloadIcon,
  DocumentSheetIcon,
  UploadIcon,
  WarningOutlineIcon,
} from "@sanity/icons";
import { COLUMNS, norm } from "./csv-columns";
import {
  buildPlan,
  display,
  type MatchedColumn,
  type Plan,
  type ProductDoc,
  type RefMaps,
} from "./csv-logic";

const AMBER = "#E8B53D";

/* ---------------- Query de estado actual ---------------- */

const PRODUCT_FIELDS = `
  _id, sku, name, description, deliveryTime, unitsPerPallet,
  isOnSale, salePrice, saleStartDate, saleEndDate, pricePublicOld,
  badges, decoAvailable, presentations, seoTitle, seoDescription, specs,
  "categoryName": category->name, "categoryId": category._ref,
  "subtypeName": subtype->name, "subtypeId": subtype._ref
`;

interface LoadedData {
  products: ProductDoc[];
  bySku: Map<string, ProductDoc[]>;
  refs: RefMaps;
  categories: { _id: string; name: string }[];
  subtypes: { _id: string; name: string }[];
}

/* ---------------- Escritura de CSV (export / plantilla) ---------------- */

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return "﻿" + lines.join("\n"); // BOM para que Excel abra bien los acentos
}
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Valor de una columna para el CSV de export (re-importable). */
function exportCell(field: string, doc: ProductDoc): string {
  const col = COLUMNS.find((c) => c.field === field)!;
  if (col.kind === "ref") {
    return String((col.refType === "subtype" ? doc.subtypeName : doc.categoryName) ?? "");
  }
  const v = doc[field];
  if (v === undefined || v === null) return "";
  if (col.kind === "boolean") return v ? "Sí" : "No";
  if (col.kind === "date") return String(v).slice(0, 10);
  if (col.kind === "stringArray") return ((v as string[]) ?? []).join("; ");
  if (col.kind === "badges") {
    const map: Record<string, string> = {
      best: "Más vendido",
      new: "Nuevo",
      promo: "Promo del mes",
      deco: "Decorado bonificado",
    };
    return ((v as string[]) ?? []).map((x) => map[x] ?? x).join("; ");
  }
  if (col.kind === "specs")
    return ((v as { key: string; value: string }[]) ?? [])
      .map((s) => `${s.key}: ${s.value}`)
      .join("; ");
  return String(v);
}

/* ---------------- Componente ---------------- */

export function CsvUpdate() {
  const client = useClient({ apiVersion: "2024-01-01" });
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<LoadedData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [applying, setApplying] = useState(false);

  // Fetch puro (sin setState) para poder reusarlo desde el efecto y tras aplicar.
  const fetchData = useCallback(async (): Promise<LoadedData> => {
    const [products, categories, subtypes] = await Promise.all([
      client.fetch<ProductDoc[]>(`*[_type == "product" && defined(sku)]{${PRODUCT_FIELDS}}`),
      client.fetch<{ _id: string; name: string }[]>(`*[_type == "category"]{_id, name}`),
      client.fetch<{ _id: string; name: string }[]>(`*[_type == "subtype"]{_id, name}`),
    ]);
    const bySku = new Map<string, ProductDoc[]>();
    for (const p of products) {
      if (!p.sku) continue;
      const k = norm(p.sku);
      const arr = bySku.get(k) ?? [];
      arr.push(p);
      bySku.set(k, arr);
    }
    const refs: RefMaps = {
      category: new Map(categories.map((c) => [norm(c.name), c._id])),
      subtype: new Map(subtypes.map((s) => [norm(s.name), s._id])),
    };
    return { products, bySku, refs, categories, subtypes };
  }, [client]);

  useEffect(() => {
    let alive = true;
    fetchData()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setLoadErr(String((e as Error)?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, [fetchData]);

  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(f, "utf-8");
  };

  const analysis = useMemo(() => {
    if (!data || !csvText.trim()) return null;
    return buildPlan(csvText, data.bySku, data.refs);
  }, [data, csvText]);

  const plan: Plan | null = analysis?.plan ?? null;

  const applyChanges = async () => {
    if (!plan || plan.toUpdate.length === 0) return;
    setApplying(true);
    try {
      const tx = client.transaction();
      for (const r of plan.toUpdate) {
        const set: Record<string, unknown> = {};
        for (const c of r.changes) set[c.field] = c.nextValue;
        for (const id of r.docIds) tx.patch(id, (p) => p.set(set));
      }
      await tx.commit();
      toast.push({
        status: "success",
        title: "Cambios aplicados",
        description: `${plan.toUpdate.length} producto(s) actualizado(s) · ${plan.totalFieldChanges} campo(s).`,
      });
      setCsvText("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      // refrescar estado tras aplicar
      try {
        setData(await fetchData());
      } catch {
        /* si falla el refresh, no bloqueamos: el apply ya se hizo */
      }
    } catch (e) {
      toast.push({
        status: "error",
        title: "No se pudo aplicar",
        description: String((e as Error)?.message ?? e),
      });
    } finally {
      setApplying(false);
    }
  };

  const exportCurrent = () => {
    if (!data) return;
    const headers = ["SKU", ...COLUMNS.map((c) => c.label)];
    const rows = data.products
      .filter((p) => !p._id.startsWith("drafts."))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .map((p) => [p.sku ?? "", ...COLUMNS.map((c) => exportCell(c.field, p))]);
    downloadText("productos-dc-inc.csv", toCsv(headers, rows));
  };

  const downloadTemplate = () => {
    const headers = ["SKU", ...COLUMNS.map((c) => c.label)];
    const example = [
      "EJEMPLO-SKU-001",
      "Nombre de ejemplo",
      "Descripción de ejemplo",
      "Botellas",
      "",
      "",
      "24-48 hs",
      "24un en Caja; 2025un en Pallet",
      "No",
      "",
      "",
      "",
      "",
      "Más vendido; Nuevo",
      "Sí",
      "Material: Vidrio; Color: Ámbar",
      "",
      "",
    ];
    downloadText("plantilla-actualizar-productos.csv", toCsv(headers, [example]));
  };

  return (
    <Box padding={[4, 4, 5]} style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Encabezado */}
      <Flex align="flex-start" gap={3}>
        <Box style={{ width: 10, height: 30, background: AMBER, borderRadius: 3, marginTop: 4 }} />
        <Stack space={2} flex={1}>
          <Heading size={3}>Actualizar productos por CSV</Heading>
          <Text size={1} muted>
            Editá muchos productos de una. Matchea por <b>SKU</b> y actualiza solo los campos que
            pongas en el archivo. <b>No toca precio base ni stock</b> — esos siguen saliendo de la
            planilla de precios.
          </Text>
        </Stack>
      </Flex>

      {/* Acciones de plantilla / export */}
      <Grid columns={[1, 1, 2]} gap={3} marginTop={4}>
        <Card padding={4} radius={3} border>
          <Stack space={3}>
            <Text size={1} weight="semibold">
              1 · Preparar el archivo
            </Text>
            <Text size={1} muted>
              Descargá los productos actuales, editá lo que necesites en Excel/Sheets y volvé a
              subir el archivo. Dejá vacía una celda para no tocar ese campo.
            </Text>
            <Inline space={2}>
              <Button
                icon={DownloadIcon}
                text="Exportar productos actuales"
                tone="primary"
                mode="ghost"
                onClick={exportCurrent}
                disabled={!data}
              />
              <Button
                icon={DocumentSheetIcon}
                text="Plantilla vacía"
                mode="bleed"
                onClick={downloadTemplate}
              />
            </Inline>
          </Stack>
        </Card>

        <Card padding={4} radius={3} border>
          <Stack space={3}>
            <Text size={1} weight="semibold">
              2 · Subir el CSV
            </Text>
            <Text size={1} muted>
              El archivo tiene que tener una columna <b>SKU</b>. Las demás columnas se reconocen por
              nombre (Nombre, Descripción, Categoría, En oferta, Destacados, etc.).
            </Text>
            <Flex align="center" gap={3}>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => onPickFile(e.currentTarget.files?.[0])}
              />
              <Button
                icon={UploadIcon}
                text={fileName || "Elegir archivo…"}
                tone="primary"
                onClick={() => fileRef.current?.click()}
                disabled={!data}
              />
              {fileName && (
                <Button
                  text="Quitar"
                  mode="bleed"
                  fontSize={1}
                  onClick={() => {
                    setCsvText("");
                    setFileName("");
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
              )}
            </Flex>
          </Stack>
        </Card>
      </Grid>

      {/* Estados de carga / error */}
      {loadErr && (
        <Card tone="critical" padding={4} radius={3} marginTop={4}>
          <Text size={1}>Error cargando el catálogo: {loadErr}</Text>
        </Card>
      )}
      {!data && !loadErr && (
        <Flex align="center" gap={3} paddingY={5}>
          <Spinner muted />
          <Text size={1} muted>
            Cargando catálogo…
          </Text>
        </Flex>
      )}

      {/* Errores de parseo / columnas */}
      {analysis && analysis.error && (
        <Card tone="caution" padding={4} radius={3} marginTop={4}>
          <Text size={1}>{analysis.error}</Text>
        </Card>
      )}

      {/* Preview del plan */}
      {plan && (
        <Stack space={4} marginTop={5}>
          <ColumnsRecognized matched={analysis!.matched} unknown={analysis!.unknownHeaders} />

          <Grid columns={[2, 2, 4]} gap={3}>
            <Stat label="Se actualizan" value={plan.toUpdate.length} tone="positive" />
            <Stat label="Sin cambios" value={plan.unchanged.length} />
            <Stat label="SKU no encontrado" value={plan.notFound.length} tone={plan.notFound.length ? "caution" : "default"} />
            <Stat label="Con errores" value={plan.withErrors.length} tone={plan.withErrors.length ? "critical" : "default"} />
          </Grid>

          {/* Barra de acción */}
          <Card padding={3} radius={3} border tone="transparent">
            <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
              <Text size={1} muted>
                {plan.toUpdate.length > 0
                  ? `Listos para aplicar ${plan.totalFieldChanges} cambio(s) en ${plan.toUpdate.length} producto(s).`
                  : "No hay cambios para aplicar."}
              </Text>
              <Button
                icon={CheckmarkCircleIcon}
                text={applying ? "Aplicando…" : "Aplicar cambios"}
                tone="positive"
                disabled={plan.toUpdate.length === 0 || applying}
                onClick={applyChanges}
              />
            </Flex>
          </Card>

          {/* Detalle: a actualizar */}
          {plan.toUpdate.length > 0 && (
            <Stack space={3}>
              <Text size={1} weight="semibold" muted>
                CAMBIOS A APLICAR
              </Text>
              <Stack space={2}>
                {plan.toUpdate.map((r) => (
                  <Card key={r.sku} padding={3} radius={3} border>
                    <Stack space={3}>
                      <Flex align="center" gap={2} wrap="wrap">
                        <Badge tone="primary" fontSize={0}>
                          {r.sku}
                        </Badge>
                        <Text size={1} weight="semibold">
                          {r.name ?? "(sin nombre)"}
                        </Text>
                      </Flex>
                      {r.changes.map((c) => (
                        <Grid key={c.field} columns={[1, 3]} gap={2}>
                          <Text size={1} weight="semibold">
                            {c.label}
                          </Text>
                          <Box style={{ gridColumn: "span 2" }}>
                            <Flex align="center" gap={2} wrap="wrap">
                              <Text size={1} muted style={{ textDecoration: "line-through" }}>
                                {c.fromText}
                              </Text>
                              <Text size={1}>→</Text>
                              <Text size={1} weight="semibold" style={{ color: "#166534" }}>
                                {c.toText}
                              </Text>
                            </Flex>
                          </Box>
                        </Grid>
                      ))}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Stack>
          )}

          {/* Con errores */}
          {plan.withErrors.length > 0 && (
            <IssueList
              title="FILAS CON ERRORES (no se aplican)"
              tone="critical"
              icon={<WarningOutlineIcon />}
              items={plan.withErrors.map((r) => ({
                sku: r.sku,
                name: r.name,
                lines: r.errors,
              }))}
            />
          )}

          {/* No encontrados */}
          {plan.notFound.length > 0 && (
            <IssueList
              title="SKU NO ENCONTRADOS EN SANITY (se saltean)"
              tone="caution"
              icon={<WarningOutlineIcon />}
              items={plan.notFound.map((r) => ({
                sku: r.sku,
                name: undefined,
                lines: ["No existe un producto con este SKU. Las altas de productos nuevos se hacen por la planilla / script."],
              }))}
            />
          )}
        </Stack>
      )}
    </Box>
  );
}

/* ---------------- Subcomponentes ---------------- */

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "caution" | "critical";
}) {
  const color =
    tone === "positive" ? "#16A34A" : tone === "caution" ? "#B7791F" : tone === "critical" ? "#DC2626" : undefined;
  return (
    <Card padding={4} radius={3} border>
      <Stack space={3}>
        <Text size={1} muted>
          {label}
        </Text>
        <Heading size={4} style={color ? { color } : undefined}>
          {value}
        </Heading>
      </Stack>
    </Card>
  );
}

function ColumnsRecognized({ matched, unknown }: { matched: MatchedColumn[]; unknown: string[] }) {
  return (
    <Card padding={3} radius={3} border tone="transparent">
      <Stack space={3}>
        <Text size={1} weight="semibold" muted>
          COLUMNAS RECONOCIDAS
        </Text>
        <Flex gap={2} wrap="wrap">
          {matched.map((m) => (
            <Badge key={m.col.field} tone="positive" fontSize={0}>
              {m.col.label}
            </Badge>
          ))}
        </Flex>
        {unknown.length > 0 && (
          <Text size={1} muted>
            Ignoradas (no reconocidas): {unknown.join(", ")}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function IssueList({
  title,
  tone,
  icon,
  items,
}: {
  title: string;
  tone: "critical" | "caution";
  icon: React.ReactNode;
  items: { sku: string; name?: string; lines: string[] }[];
}) {
  return (
    <Stack space={3}>
      <Text size={1} weight="semibold" muted>
        {title}
      </Text>
      <Card padding={3} radius={3} border tone={tone}>
        <Stack space={3}>
          {items.map((it, i) => (
            <Flex key={`${it.sku}-${i}`} gap={2} align="flex-start">
              <Text size={1}>{icon}</Text>
              <Stack space={1} flex={1}>
                <Text size={1} weight="semibold">
                  {it.sku}
                  {it.name ? ` · ${it.name}` : ""}
                </Text>
                {it.lines.map((l, j) => (
                  <Text key={j} size={1} muted>
                    {l}
                  </Text>
                ))}
              </Stack>
            </Flex>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

// evita warning de import no usado si display se tree-shakea
void display;
