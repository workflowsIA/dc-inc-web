import type { Metadata } from "next";
import FiltersPanel from "@/components/blocks/FiltersPanel";
import FilterSection from "@/components/blocks/FilterSection";
import Link from "next/link";
import { X } from "lucide-react";
import ProductCard from "@/components/blocks/ProductCard";
import type { Product } from "@/data/products";
import { getCategories, getFilterGroups, getProducts, toLegacyProduct } from "@/lib/sanity-data";
import type { SanityFilterGroup } from "@/lib/queries";
import { resolveDisplayPrice } from "@/lib/pricing";
import { ars } from "@/lib/format";
import { matchesSearch, searchScore, searchTokens } from "@/lib/search";

export const revalidate = 60;

const CATALOG_DESC =
  "Catálogo mayorista de DC Inc: botellas, latas, cajas, copas, vasos, tapas y botellones para bebidas. Stock real, factura A/B/E y envíos a todo el país.";

export const metadata: Metadata = {
  title: "Catálogo de packaging y cristalería",
  description: CATALOG_DESC,
  alternates: { canonical: "/productos" },
  openGraph: {
    title: "Catálogo de packaging y cristalería · DC Inc",
    description: CATALOG_DESC,
    url: "/productos",
    type: "website",
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

const PER_PAGE = 24;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

/** Precio sobre el que filtra el rango: el que el usuario realmente ve. */
function filterPrice(p: Product): number {
  return resolveDisplayPrice(p, false).display;
}

/** Redondea a un número "de góndola" cercano (1.000, 2.500, 5.000…). */
function redondoLindo(x: number): number {
  if (x <= 0) return 0;
  const base = Math.pow(10, Math.floor(Math.log10(x)));
  const cand = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * base);
  return cand.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
}

const asArray = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];

/**
 * Catálogo.
 *
 * Los filtros salen de los GRUPOS cargados en Sanity (Bebida, Modelo, Tipo de
 * pieza…): si Marce crea un grupo nuevo, aparece solo como un bloque más, sin
 * tocar código. Un grupo se muestra únicamente si alguna de sus subcategorías
 * aplica a la categoría que se está mirando — por eso "Modelo" no aparece en
 * Botellas.
 *
 * Reglas de combinación: dentro de un mismo grupo los valores SUMAN (cerveza o
 * vino), entre grupos RESTRINGEN (cerveza Y pinta). Es lo que espera cualquiera
 * que haya usado un filtro de e-commerce.
 *
 * Todos los bloques arrancan plegados (pedido de Marce): el contador de la
 * cabecera y los chips de arriba de la grilla son los que cuentan el estado.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  const minParam = typeof sp.min === "string" ? sp.min : undefined;
  const maxParam = typeof sp.max === "string" ? sp.max : undefined;
  const pageParam = typeof sp.page === "string" ? sp.page : undefined;

  let products: Product[] = [];
  try {
    products = (await getProducts()).map((p) => toLegacyProduct(p, false));
  } catch (e) {
    console.error("[catalog] Sanity fetch failed:", (e as Error).message);
  }

  let groups: SanityFilterGroup[] = [];
  try {
    groups = await getFilterGroups();
  } catch (e) {
    console.error("[catalog] grupos de filtro:", (e as Error).message);
  }

  // Orden de las categorías: campo "Orden" de Sanity. Solo las que tienen algo.
  let catOrder = new Map<string, number>();
  try {
    catOrder = new Map(
      (await getCategories()).map((c) => [c.name, typeof c.order === "number" ? c.order : 999]),
    );
  } catch (e) {
    console.error("[catalog] categories fetch failed:", (e as Error).message);
  }
  const cats = [...new Set(products.map((p) => p.cat).filter(Boolean))].sort(
    (a, b) => (catOrder.get(a) ?? 999) - (catOrder.get(b) ?? 999) || a.localeCompare(b, "es"),
  );

  const subsOf = (p: Product) => (p.subs && p.subs.length ? p.subs : p.sub ? [p.sub] : []);

  // --- Selección por grupo, leída del querystring (?bebida=Cerveza&bebida=Vino)
  const selPorGrupo = new Map<string, Set<string>>();
  for (const g of groups) {
    const vals = asArray(sp[g.slug]).map(norm);
    if (vals.length) selPorGrupo.set(g.slug, new Set(vals));
  }
  // Compatibilidad con los links viejos (?sub=Cerveza): filtra contra cualquier
  // grupo, sin importar a cuál pertenezca.
  const legacySubs = new Set(asArray(sp.sub).map(norm));

  // --- Precio
  const allPrices = products.map(filterPrice).filter((n) => n > 0);
  const priceFloor = allPrices.length ? Math.floor(Math.min(...allPrices)) : 0;
  const priceCeil = allPrices.length ? Math.ceil(Math.max(...allPrices)) : 0;
  const minNum = minParam ? Number(minParam) : null;
  const maxNum = maxParam ? Number(maxParam) : null;
  const hasMin = minNum != null && !Number.isNaN(minNum);
  const hasMax = maxNum != null && !Number.isNaN(maxNum);

  const tokens = q ? searchTokens(q) : [];

  /** Filtra el catálogo. `omitir` permite excluir un grupo del filtro para poder
   *  contar cuántos productos quedarían al marcar cada una de SUS opciones (es
   *  el conteo que se muestra al lado de cada casilla). */
  const filtrar = (omitir?: string) =>
    products.filter((p) => {
      if (cat && p.cat !== cat) return false;
      if (tokens.length) {
        const hay = `${p.name} ${p.sku} ${p.cat} ${subsOf(p).join(" ")}`;
        if (!matchesSearch(hay, tokens)) return false;
      }
      if (hasMin || hasMax) {
        const pr = filterPrice(p);
        if (hasMin && pr < minNum!) return false;
        if (hasMax && pr > maxNum!) return false;
      }
      const mios = subsOf(p).map(norm);
      for (const [slug, sel] of selPorGrupo) {
        if (slug === omitir) continue;
        if (!mios.some((s) => sel.has(s))) return false; // AND entre grupos
      }
      if (legacySubs.size && !mios.some((s) => legacySubs.has(s))) return false;
      return true;
    });

  let filtered = filtrar();
  if (tokens.length) {
    filtered = filtered
      .map((p, i) => ({ p, i, s: searchScore(p.name, tokens) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.p);
  }

  // --- Qué bloques mostrar y con qué opciones.
  // Una subcategoría entra si aplica a la categoría mirada (parents vacío = todas)
  // y si le queda al menos un producto con los demás filtros puestos.
  const bloques = groups
    .map((g) => {
      const universo = filtrar(g.slug);
      const conteo = new Map<string, number>();
      for (const p of universo) for (const s of subsOf(p)) conteo.set(norm(s), (conteo.get(norm(s)) ?? 0) + 1);
      const sel = selPorGrupo.get(g.slug) ?? new Set<string>();
      const opciones = g.subcats
        .filter((s) => !cat || !s.parents?.length || s.parents.includes(cat))
        .map((s) => ({ name: s.name, n: conteo.get(norm(s.name)) ?? 0, on: sel.has(norm(s.name)) }))
        .filter((o) => o.n > 0 || o.on)
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "es"));
      return { group: g, opciones, aplicados: sel.size };
    })
    .filter((b) => b.opciones.length > 0);

  const totalSubFiltros = [...selPorGrupo.values()].reduce((a, s) => a + s.size, 0) + legacySubs.size;
  const hasFilter = !!(q || cat || totalSubFiltros > 0 || hasMin || hasMax);
  const activeFilterCount = (cat ? 1 : 0) + totalSubFiltros + (hasMin ? 1 : 0) + (hasMax ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(pageParam || "1", 10) || 1), totalPages);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /** Arma la URL del catálogo respetando todo lo que ya está puesto. */
  const buildUrl = (opts?: {
    cat?: string | null;
    grupo?: { slug: string; valores: string[] };
    dropQ?: boolean;
    dropPrice?: boolean;
    dropLegacy?: boolean;
    page?: number;
  }) => {
    const p = new URLSearchParams();
    if (q && !opts?.dropQ) p.set("q", q);
    const catFinal = opts?.cat !== undefined ? opts.cat : cat;
    if (catFinal) p.set("cat", catFinal);
    for (const g of groups) {
      const valores =
        opts?.grupo && opts.grupo.slug === g.slug
          ? opts.grupo.valores
          : asArray(sp[g.slug]);
      for (const v of valores) p.append(g.slug, v);
    }
    if (!opts?.dropLegacy) for (const v of asArray(sp.sub)) p.append("sub", v);
    if (hasMin && !opts?.dropPrice) p.set("min", String(minNum));
    if (hasMax && !opts?.dropPrice) p.set("max", String(maxNum));
    if (opts?.page && opts.page > 1) p.set("page", String(opts.page));
    const qs = p.toString();
    return qs ? `/productos?${qs}` : "/productos";
  };

  /** Marca o desmarca una opción dentro de su grupo. */
  const urlToggle = (slug: string, name: string) => {
    const actuales = asArray(sp[slug]);
    const estaba = actuales.some((v) => norm(v) === norm(name));
    const valores = estaba ? actuales.filter((v) => norm(v) !== norm(name)) : [...actuales, name];
    return buildUrl({ grupo: { slug, valores } });
  };

  // Tramos de precio armados a partir del catálogo real, para no obligar a
  // escribir dos números. Los inputs manuales siguen abajo.
  const tramos: { label: string; min?: number; max?: number }[] = [];
  if (priceCeil > priceFloor && allPrices.length > 8) {
    const ord = [...allPrices].sort((a, b) => a - b);
    const cortes = [0.25, 0.5, 0.75]
      .map((p) => redondoLindo(ord[Math.floor(ord.length * p)]))
      .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);
    let prev = 0;
    for (const c of cortes) {
      tramos.push({ label: prev === 0 ? `Hasta ${ars(c)}` : `${ars(prev)} – ${ars(c)}`, min: prev || undefined, max: c });
      prev = c;
    }
    if (prev > 0) tramos.push({ label: `Más de ${ars(prev)}`, min: prev });
  }
  const urlTramo = (t: { min?: number; max?: number }) => {
    const base = buildUrl({ dropPrice: true });
    const p = new URLSearchParams(base.split("?")[1] ?? "");
    if (t.min) p.set("min", String(t.min));
    if (t.max) p.set("max", String(t.max));
    const qs = p.toString();
    return qs ? `/productos?${qs}` : "/productos";
  };
  const tramoActivo = (t: { min?: number; max?: number }) =>
    (t.min ?? null) === (hasMin ? minNum : null) && (t.max ?? null) === (hasMax ? maxNum : null);

  return (
    <div className="wrap" style={{ padding: "32px 24px 80px" }}>
      <div className="section-head">
        <div>
          <span className="eyebrow">
            Catálogo · {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
            {hasFilter ? " (filtrado)" : ""}
          </span>
          <h1 className="h-lg" style={{ marginTop: "12px" }}>
            {q ? `Resultados para "${q}"` : "Todo nuestro packaging y cristalería"}
          </h1>
        </div>
        <Link prefetch={false} className="btn btn-ghost" href="/">
          ← Volver al inicio
        </Link>
      </div>

      <div className="catalog-layout">
        {/* SIDEBAR FILTROS */}
        <aside className="catalog-aside">
          <FiltersPanel activeCount={activeFilterCount}>
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: "var(--r-lg)",
                padding: "6px 20px",
                background: "#fff",
              }}
            >
              {hasFilter && (
                <Link
                  prefetch={false}
                  href="/productos"
                  className="btn btn-ghost btn-sm"
                  style={{ margin: "14px 0", width: "100%" }}
                >
                  Limpiar filtros
                </Link>
              )}

              <FilterSection title="Categoría" applied={cat ? 1 : 0} total={cats.length}>
                <ul className="fsec-list">
                  {cats.map((c) => {
                    const on = c === cat;
                    return (
                      <li key={c}>
                        <Link
                          prefetch={false}
                          href={buildUrl({ cat: on ? null : c })}
                          className={"fopt" + (on ? " fopt-on" : "")}
                          aria-pressed={on}
                        >
                          <span aria-hidden="true" className="fopt-box">{on ? "✓" : ""}</span>
                          {c}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </FilterSection>

              {bloques.map(({ group, opciones, aplicados }) => (
                <FilterSection
                  key={group._id}
                  title={group.name}
                  applied={aplicados}
                  total={opciones.length}
                >
                  <ul className="fsec-list">
                    {opciones.map((o) => (
                      <li key={o.name}>
                        <Link
                          prefetch={false}
                          href={urlToggle(group.slug, o.name)}
                          className={"fopt" + (o.on ? " fopt-on" : "")}
                          aria-pressed={o.on}
                        >
                          <span aria-hidden="true" className="fopt-box">{o.on ? "✓" : ""}</span>
                          {o.name}
                          <span className="fopt-n">{o.n}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </FilterSection>
              ))}

              {priceCeil > 0 && (
                <FilterSection title="Precio (IVA incl.)" applied={(hasMin ? 1 : 0) + (hasMax ? 1 : 0)}>
                  {tramos.length > 0 && (
                    <ul className="fsec-list" style={{ marginBottom: "12px" }}>
                      {tramos.map((t) => {
                        const on = tramoActivo(t);
                        return (
                          <li key={t.label}>
                            <Link
                              prefetch={false}
                              href={on ? buildUrl({ dropPrice: true }) : urlTramo(t)}
                              className={"fopt" + (on ? " fopt-on" : "")}
                              aria-pressed={on}
                            >
                              <span aria-hidden="true" className="fopt-box">{on ? "✓" : ""}</span>
                              {t.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <form method="get" action="/productos" style={{ display: "grid", gap: "10px" }}>
                    {q && <input type="hidden" name="q" value={q} />}
                    {cat && <input type="hidden" name="cat" value={cat} />}
                    {groups.flatMap((g) =>
                      asArray(sp[g.slug]).map((v, i) => (
                        <input key={`${g.slug}-${i}`} type="hidden" name={g.slug} value={v} />
                      )),
                    )}
                    {asArray(sp.sub).map((v, i) => (
                      <input key={`sub-${i}`} type="hidden" name="sub" value={v} />
                    ))}
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="number"
                        name="min"
                        inputMode="numeric"
                        placeholder={String(priceFloor)}
                        defaultValue={hasMin ? String(minNum) : ""}
                        min={0}
                        aria-label="Precio mínimo"
                        style={{
                          width: "100%", minWidth: 0, padding: "8px 10px",
                          border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", fontSize: "16px",
                        }}
                      />
                      <input
                        type="number"
                        name="max"
                        inputMode="numeric"
                        placeholder={String(priceCeil)}
                        defaultValue={hasMax ? String(maxNum) : ""}
                        min={0}
                        aria-label="Precio máximo"
                        style={{
                          width: "100%", minWidth: 0, padding: "8px 10px",
                          border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", fontSize: "16px",
                        }}
                      />
                    </div>
                    <button type="submit" className="btn btn-ghost btn-sm" style={{ width: "100%" }}>
                      Aplicar precio
                    </button>
                  </form>
                </FilterSection>
              )}
            </div>
          </FiltersPanel>
        </aside>

        {/* CONTENIDO */}
        <div>
          {hasFilter && (
            <div className="chips" style={{ marginBottom: "20px" }}>
              {q && (
                <Link prefetch={false} className="chip on" href={buildUrl({ dropQ: true })}>
                  “{q}” <span className="chip-x"><X /></span>
                </Link>
              )}
              {cat && (
                <Link prefetch={false} className="chip on" href={buildUrl({ cat: null })}>
                  {cat} <span className="chip-x"><X /></span>
                </Link>
              )}
              {groups.flatMap((g) =>
                asArray(sp[g.slug]).map((v) => (
                  <Link prefetch={false} key={`${g.slug}-${v}`} className="chip on" href={urlToggle(g.slug, v)}>
                    {v} <span className="chip-x"><X /></span>
                  </Link>
                )),
              )}
              {asArray(sp.sub).length > 0 && (
                <Link prefetch={false} className="chip on" href={buildUrl({ dropLegacy: true })}>
                  {asArray(sp.sub).join(", ")} <span className="chip-x"><X /></span>
                </Link>
              )}
              {(hasMin || hasMax) && (
                <Link prefetch={false} className="chip on" href={buildUrl({ dropPrice: true })}>
                  {hasMin ? ars(minNum!) : ars(priceFloor)} – {hasMax ? ars(maxNum!) : ars(priceCeil)}{" "}
                  <span className="chip-x"><X /></span>
                </Link>
              )}
              <Link prefetch={false} className="chip" href="/productos">
                Limpiar todo
              </Link>
            </div>
          )}

          {filtered.length > 0 ? (
            <>
              <div className="grid grid-3">
                {paged.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: "flex", gap: "8px", alignItems: "center",
                    justifyContent: "center", flexWrap: "wrap", marginTop: "40px",
                  }}
                >
                  {page > 1 && (
                    <Link prefetch={false} className="btn btn-ghost btn-sm" href={buildUrl({ page: page - 1 })}>
                      ← Anterior
                    </Link>
                  )}
                  <span className="mono" style={{ fontSize: "13px", color: "var(--muted)" }}>
                    Página {page} de {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link prefetch={false} className="btn btn-ghost btn-sm" href={buildUrl({ page: page + 1 })}>
                      Siguiente →
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                padding: "48px 24px", textAlign: "center", color: "var(--muted)",
                border: "1px dashed var(--line-2)", borderRadius: "var(--r-lg)",
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: "8px" }}>
                No encontramos productos con ese filtro.
              </p>
              <Link prefetch={false} href="/productos" className="btn btn-ghost btn-sm" style={{ marginTop: "8px" }}>
                Ver todo el catálogo
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
