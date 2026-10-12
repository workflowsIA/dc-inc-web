/**
 * Tarifa de Andreani a DOMICILIO por zona × tramo de peso aforado (ARS, CON
 * IVA, valor declarado $30.000 → incluye $726 de seguro).
 *
 * GENERADO por `npm run andreani:tabla` (scripts/andreani-tabla.ts) contra la
 * API real. No editar a mano: si Andreani cambia precios, se vuelve a correr
 * el script y se deploya.
 *
 * Con la API prendida (ANDREANI_API=on) el precio sale de la API en vivo y
 * esta tabla es solo el RESPALDO para cuando Andreani no responde.
 */
export const ANDREANI_TABLA = {
  relevado: "2026-10-12",
  contrato: "400043741",
  /** Tope de peso aforado de cada tramo, en kg. El último es el tope de paquetería. */
  tramosKg: [1, 2, 3, 5, 10, 15, 20, 35, 50],
  /** Precio por tramo (mismo orden que tramosKg). Zonas: ver bandForCp(). */
  zonas: {
    AMBA: [12148.53, 12537.96, 13128.56, 16732.55, 21878.66, 31011.51, 37115.15, 50080.96, 70803.23],
    B2: [17367.53, 18221.75, 19096.53, 22900.05, 28796.45, 38317.51, 40269.19, 55221.45, 78163.79],
    B3: [19220.22, 20473.25, 21460.61, 28608.93, 37406.98, 54196.92, 67907.86, 97779.42, 139315.73],
    B4: [27353.08, 31474.25, 33011.67, 55394.53, 87520.51, 127170.99, 147826.41, 220317.97, 314701.41],
  },
};
