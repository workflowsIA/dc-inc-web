/**
 * Chequeo del parser de CSV del Studio (`npm run csv:check`).
 *
 * No necesita bundler ni dependencias: node stripea los tipos del .ts.
 * Los casos 2 y 7 son los que rompían antes (reporte de Marce del 12-sep-2026:
 * "tira SKU no encontrado, tomaba de otras columnas el contenido como si fuera sku").
 */
import { parseCsv } from "../sanity/tools/csv-parse.ts";

let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FALLA ${name}${extra ? `\n        ${extra}` : ""}`);
  }
}
function group(name) {
  console.log(`\n${name}`);
}

/* 1 · Básico */
group("1 · CSV simple");
{
  const p = parseCsv("SKU,Nombre\nB750,Bordolesa\nL473,Lata");
  check("2 filas", p.rows.length === 2);
  check("headers normalizados", JSON.stringify(p.headers) === '["sku","nombre"]');
  check("valores", p.rows[1].nombre === "Lata");
}

/* 2 · Descripción multilínea — EL BUG */
group("2 · Celda con salto de línea adentro de comillas (el bug de Marce)");
{
  const csv =
    'SKU,Nombre,Descripción\n' +
    'B750,Bordolesa,"Botella de 750 ml.\nIdeal para cerveza artesanal."\n' +
    'L473,Lata 473,"Lata de aluminio"\n';
  const p = parseCsv(csv);
  check("no se parte en 4 filas", p.rows.length === 2, `dio ${p.rows.length}`);
  check("el SKU de la fila 2 es L473", p.rows[1].sku === "L473", `dio "${p.rows[1]?.sku}"`);
  check(
    "la descripción conserva el salto",
    p.rows[0].descripcion === "Botella de 750 ml.\nIdeal para cerveza artesanal.",
    JSON.stringify(p.rows[0].descripcion),
  );
  check("el nombre de la fila 1 no se perdió", p.rows[0].nombre === "Bordolesa");
}

/* 3 · Comillas escapadas */
group("3 · Comillas escapadas y comas adentro del texto");
{
  const p = parseCsv('SKU,Nombre\nX1,"Vaso ""Seelze"", importado"\n');
  check("comilla doble → una sola", p.rows[0].nombre === 'Vaso "Seelze", importado', p.rows[0].nombre);
}

/* 4 · Separador ; (Excel en español) */
group("4 · Separador ;");
{
  const p = parseCsv("SKU;Nombre;Descripción\nB750;Bordolesa;Verde, 750 ml\n");
  check("detecta ;", p.separator === ";");
  check("la coma del texto no separa", p.rows[0].descripcion === "Verde, 750 ml");
}

/* 5 · Pulgadas sin comillas */
group("5 · Comilla suelta en texto sin comillas (medidas en pulgadas)");
{
  const p = parseCsv('SKU,Nombre\nC12,Copa 5" alta\nC13,Copa chica\n');
  check("no desbalancea el archivo", p.rows.length === 2, `dio ${p.rows.length}`);
  check("guarda la comilla literal", p.rows[0].nombre === 'Copa 5" alta', p.rows[0].nombre);
}

/* 6 · CRLF, BOM y filas vacías al final */
group("6 · CRLF + BOM + líneas en blanco");
{
  const p = parseCsv('﻿SKU,Nombre\r\nB750,Bordolesa\r\n\r\n');
  check("1 fila", p.rows.length === 1, `dio ${p.rows.length}`);
  check("BOM fuera del header", p.headers[0] === "sku", p.headers[0]);
}

/* 7 · Round-trip con el escritor del export */
group("7 · Round-trip export → import");
{
  // Mismo csvCell que usa CsvUpdate.tsx para escribir el archivo.
  const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const headers = ["SKU", "Nombre", "Descripción"];
  const data = [
    ["B750", "Bordolesa", "Línea 1\nLínea 2, con coma"],
    ["L473", 'Lata 473 "premium"', "Simple"],
  ];
  const text =
    "﻿" +
    [headers, ...data].map((r) => r.map(csvCell).join(",")).join("\n");
  const p = parseCsv(text);
  check("vuelven las 2 filas", p.rows.length === 2, `dio ${p.rows.length}`);
  check("SKU fila 2 intacto", p.rows[1].sku === "L473", p.rows[1]?.sku);
  check("descripción idéntica", p.rows[0].descripcion === data[0][2]);
  check("nombre con comillas idéntico", p.rows[1].nombre === data[1][1], p.rows[1]?.nombre);
}

/* 8 · Número de línea para los mensajes de error */
group("8 · Números de línea");
{
  const p = parseCsv('SKU,Nombre\nA,"uno\ndos"\nB,tres\n');
  check("la fila B es la línea 4", p.lines[1] === 4, `dio ${p.lines[1]}`);
}

/* 9 · Fila con más celdas que la cabecera → aviso */
group("9 · Aviso de fila desalineada");
{
  const p = parseCsv("SKU,Nombre\nA,uno,sobra\n");
  check("avisa", p.warnings.some((w) => w.includes("más celdas")), JSON.stringify(p.warnings));
}

console.log(failed === 0 ? "\nTodo OK\n" : `\n${failed} chequeo(s) fallaron\n`);
process.exit(failed === 0 ? 0 : 1);
