/**
 * Chequeo de las COLUMNAS POR GRUPO del CSV del Studio (`npm run csv:grupos`).
 *
 * Verifica las reglas que más fácil se rompen sin darse cuenta:
 *  - cada columna manda solo sobre su grupo y no pisa las de los otros;
 *  - celda vacía saca las de ese grupo (y NO las de los demás);
 *  - una columna que no viene en el archivo deja su grupo intacto;
 *  - una subcategoría que no existe se reporta para crearla, no se traga;
 *  - si el archivo trae columnas de grupo, la columna vieja "Subtipos" se ignora;
 *  - un destacado desconocido avisa pero no tira abajo la fila.
 *
 * No necesita red ni Sanity: node stripea los tipos del .ts.
 */
// Node stripea los tipos del .ts, pero NO resuelve los import sin extensión que
// usa el repo ("./csv-columns"). Copiamos los módulos a un temporal agregándole
// la extensión a cada import y corremos eso. Mismo truco que csv:check.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const tmp = mkdtempSync(join(tmpdir(), "dccsv-"));
for (const f of ["csv-parse", "csv-columns", "csv-logic", "wix-adapter"]) {
  const src = readFileSync(new URL(`../sanity/tools/${f}.ts`, import.meta.url), "utf8");
  writeFileSync(join(tmp, `${f}.ts`), src.replace(/(from\s+")(\.\/[\w-]+)(")/g, "$1$2.ts$3"));
}
const { buildPlan } = await import(pathToFileURL(join(tmp, "csv-logic.ts")).href);
const { buildColumns } = await import(pathToFileURL(join(tmp, "csv-columns.ts")).href);

let failed = 0;
const check = (name, cond, extra) => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.log(`  FALLA ${name}${extra ? `\n        ${extra}` : ""}`);
  }
};
const group = (n) => console.log(`\n${n}`);

/* --- Datos de mentira, con la forma real --- */
const G_BEBIDA = "g-bebida";
const G_MODELO = "g-modelo";
const groups = [
  { _id: G_BEBIDA, name: "Bebida", slug: "bebida", order: 1 },
  { _id: G_MODELO, name: "Modelo", slug: "modelo", order: 2 },
];
const columns = buildColumns(groups, true);

const SUB = {
  cerveza: "s-cerveza",
  vino: "s-vino",
  pinta: "s-pinta",
  copa: "s-copa",
};
const refs = {
  category: new Map([["botellas", "cat-botellas"]]),
  subtype: new Map(Object.entries(SUB)),
  subcatByGroup: new Map([
    [G_BEBIDA, new Map([["cerveza", SUB.cerveza], ["vino", SUB.vino]])],
    [G_MODELO, new Map([["pinta", SUB.pinta], ["copa", SUB.copa]])],
  ]),
  groupBySubcat: new Map([
    [SUB.cerveza, G_BEBIDA],
    [SUB.vino, G_BEBIDA],
    [SUB.pinta, G_MODELO],
    [SUB.copa, G_MODELO],
  ]),
  nombrePorId: new Map([
    [SUB.cerveza, "Cerveza"],
    [SUB.vino, "Vino"],
    [SUB.pinta, "Pinta"],
    [SUB.copa, "Copa"],
  ]),
};

/** Un producto que hoy tiene Cerveza (bebida) + Pinta (modelo). */
const productos = () =>
  new Map([
    [
      "b750",
      [
        {
          _id: "p1",
          sku: "B750",
          name: "Bordolesa",
          categoryId: "cat-botellas",
          subtypeIds: [SUB.cerveza, SUB.pinta],
          subtypeNames: ["Cerveza", "Pinta"],
        },
      ],
    ],
  ]);

const plan = (csv) => buildPlan(csv, productos(), refs, { columns }).plan;
const cambioSubs = (p) => p.rows[0].changes.find((c) => c.field === "subtypes");
const idsDe = (c) => (c ? c.nextValue.map((r) => r._ref).sort() : null);

/* 1 */
group("1 · Cada columna manda sobre su grupo");
{
  const p = plan("SKU,Bebida\nB750,Vino\n");
  const c = cambioSubs(p);
  check("cambia bebida", !!c);
  check(
    "queda Vino + Pinta (no se tocó Modelo)",
    JSON.stringify(idsDe(c)) === JSON.stringify([SUB.pinta, SUB.vino].sort()),
    JSON.stringify(idsDe(c)),
  );
}

/* 2 */
group("2 · Celda vacía saca las de ESE grupo");
{
  const p = plan("SKU,Bebida\nB750,\n");
  const c = cambioSubs(p);
  check("hay cambio", !!c);
  check("queda solo Pinta", JSON.stringify(idsDe(c)) === JSON.stringify([SUB.pinta]), JSON.stringify(idsDe(c)));
}

/* 3 */
group("3 · Columna ausente = grupo intacto");
{
  const p = plan("SKU,Nombre\nB750,Bordolesa nueva\n");
  check("no toca subcategorías", !cambioSubs(p));
}

/* 4 */
group("4 · Varias en la misma celda con ;");
{
  const p = plan("SKU,Bebida\nB750,Cerveza; Vino\n");
  const c = cambioSubs(p);
  check(
    "quedan Cerveza + Vino + Pinta",
    JSON.stringify(idsDe(c)) === JSON.stringify([SUB.cerveza, SUB.vino, SUB.pinta].sort()),
    JSON.stringify(idsDe(c)),
  );
}

/* 5 */
group("5 · Subcategoría que no existe");
{
  const p = plan("SKU,Bebida\nB750,Sidra\n");
  check("la fila queda con error", p.rows[0].errors.length === 1, JSON.stringify(p.rows[0].errors));
  check("se reporta para crearla", p.missingSubcats.length === 1, JSON.stringify(p.missingSubcats));
  check("con su grupo", p.missingSubcats[0]?.groupId === G_BEBIDA && p.missingSubcats[0]?.name === "Sidra");
}

/* 6 */
group("6 · Con columnas de grupo, la columna vieja se ignora");
{
  const p = plan("SKU,Bebida,Subtipos\nB750,Vino,Copa\n");
  const c = cambioSubs(p);
  check(
    "gana la columna de grupo",
    JSON.stringify(idsDe(c)) === JSON.stringify([SUB.pinta, SUB.vino].sort()),
    JSON.stringify(idsDe(c)),
  );
}

/* 7 */
group("7 · Destacado desconocido: avisa, no rompe");
{
  const p = plan("SKU,Destacados,Nombre\nB750,Nuevo; Cualquier Cosa,Bordolesa nueva\n");
  check("sin errores", p.rows[0].errors.length === 0, JSON.stringify(p.rows[0].errors));
  check("con aviso", p.rows[0].warnings.length === 1, JSON.stringify(p.rows[0].warnings));
  check("aplica el nombre igual", p.rows[0].changes.some((c) => c.field === "name"));
  const b = p.rows[0].changes.find((c) => c.field === "badges");
  check("aplica el destacado válido", JSON.stringify(b?.nextValue) === JSON.stringify(["new"]), JSON.stringify(b?.nextValue));
}

/* 8 */
group("8 · Las etiquetas nuevas de Marce existen");
{
  const p = plan("SKU,Destacados\nB750,Pre Venta; Liquidación\n");
  const b = p.rows[0].changes.find((c) => c.field === "badges");
  check("sin avisos", p.rows[0].warnings.length === 0, JSON.stringify(p.rows[0].warnings));
  check(
    "quedan preventa + liquidacion",
    JSON.stringify(b?.nextValue) === JSON.stringify(["preventa", "liquidacion"]),
    JSON.stringify(b?.nextValue),
  );
}

console.log(failed === 0 ? "\nTodo OK\n" : `\n${failed} chequeo(s) fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
