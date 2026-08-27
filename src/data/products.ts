/**
 * Mock data port of wireframes/assets/data.js
 * Replaced by Sanity queries once the migration runs (see scripts/migrate-wix-to-sanity.ts).
 * Same shape, typed.
 */

import type { PresentationPricing } from "@/lib/queries";

export type Badge = "best" | "new" | "promo" | "deco";
export type StockLevel = "ok" | "low" | "out";

export interface Product {
  id: string;
  sku: string;
  cat: string;
  /** primer subtipo (compat) — ver `subs` para todos */
  sub: string;
  /** subtipos del producto (un producto puede tener varios, ej. "Cognac" y "Whisky") */
  subs?: string[];
  name: string;
  /** orden manual en el catálogo (menor primero); vacío = orden por defecto */
  sortOrder?: number;
  /** precio público (visitante) */
  pub: number;
  /** precio mayorista (logueado) */
  may: number;
  /** precio público anterior si está en promo */
  oldPub?: number;
  /** oferta activa (campo Sanity isOnSale) */
  onSale?: boolean;
  /** precio de oferta (público) — pisa al precio normal mientras la oferta esté vigente */
  salePrice?: number;
  /** inicio de la oferta (ISO) — opcional */
  saleStart?: string;
  /** fin de la oferta (ISO) — opcional */
  saleEnd?: string;
  bulto: number;
  pallet: number;
  deli: string;
  stock: StockLevel;
  badges: Badge[];
  deco: boolean;
  /** familia de tarifa de decorado (src/lib/deco.ts); undefined = sin cotización en la ficha */
  decoFamily?: string;
  specs: Record<string, string>;
  /** opciones de presentación (ej: "24un en Cajas", "2025un en Pallet") */
  presentations?: string[];
  /** precio real por presentación (caja/pallet) — descuento por volumen; lo puebla el sync.
   *  priceWholesale sólo viaja al browser para usuarios mayoristas (ver toLegacyProduct). */
  presentationPricing?: PresentationPricing[];
  /** descripción (texto limpio, puede traer saltos de línea) */
  description?: string;
  /** key del packshot en /public/img/{img}.png (legacy mock) */
  img?: string;
  /** URL absoluta del packshot (Sanity CDN) — usar si está */
  imageUrl?: string;
}

const IMG_MAP: Record<string, string> = {
  "bot-am-355": "bottle-beer",
  "bot-am-500": "bottle-beer",
  "bot-gin-700": "bottle-spirit",
  "lata-473": "can",
  "lata-354": "can",
  "copa-pinta": "pint",
  "copa-chopp": "pint",
  "copa-vino": "glass-belgian",
  "copa-gin": "glass-gin",
  "copa-whisky": "glass-tumbler",
  "copa-fernet": "glass-tumbler",
  "copa-esp": "glass-ipa",
  "caja-24": "box",
  "botellon-19": "growler",
};

const CAT_IMG: Record<string, string | undefined> = {
  Botellas: "bottle-beer",
  Latas: "can",
  Copas: "pint",
  Cajas: "box",
  Botellones: "growler",
  Tapas: undefined,
};

export const PRODUCTS: Product[] = [
  { id: "bot-am-355", sku: "BOT-AM-355", cat: "Botellas", sub: "Cerveza", name: "Botella ámbar 355 ml — boca corona", pub: 480, may: 392, bulto: 24, pallet: 1680, deli: "24-48 hs", stock: "ok", badges: ["best"], deco: true, specs: { Material: "Vidrio ámbar", Capacidad: "355 ml", Altura: "226 mm", "Boca interna": "26 mm — corona", Peso: "180 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "bot-am-500", sku: "BOT-AM-500", cat: "Botellas", sub: "Cerveza", name: "Botella ámbar 500 ml — boca corona", pub: 560, may: 455, bulto: 20, pallet: 1320, deli: "24-48 hs", stock: "ok", badges: [], deco: true, specs: { Material: "Vidrio ámbar", Capacidad: "500 ml", Altura: "258 mm", "Boca interna": "26 mm — corona", Peso: "310 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "bot-gin-700", sku: "BOT-GIN-700", cat: "Botellas", sub: "Gin", name: "Botella gin 700 ml — boca rosca", pub: 1180, may: 980, bulto: 12, pallet: 840, deli: "24-48 hs", stock: "low", badges: ["deco"], deco: true, specs: { Material: "Vidrio flint", Capacidad: "700 ml", Altura: "285 mm", "Boca interna": "28 mm — rosca GPI", Peso: "620 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "lata-473", sku: "LAT-473", cat: "Latas", sub: "Cerveza", name: "Lata aluminio 473 ml — sleek", pub: 295, may: 238, bulto: 48, pallet: 8000, deli: "24-48 hs", stock: "ok", badges: ["best"], deco: true, specs: { Material: "Aluminio", Capacidad: "473 ml", Altura: "168 mm", "Boca interna": "202 — fondo", Peso: "14 g", Fabricación: "Importado", Origen: "Brasil" } },
  { id: "lata-354", sku: "LAT-354", cat: "Latas", sub: "Cerveza", name: "Lata aluminio 354 ml — estándar", pub: 255, may: 205, bulto: 48, pallet: 9200, deli: "24-48 hs", stock: "ok", badges: ["new"], deco: true, specs: { Material: "Aluminio", Capacidad: "354 ml", Altura: "122 mm", "Boca interna": "202 — fondo", Peso: "12 g", Fabricación: "Importado", Origen: "Brasil" } },
  { id: "copa-pinta", sku: "CRI-PIN-568", cat: "Copas", sub: "Pinta", name: "Vaso pinta cervecera 568 ml", pub: 1420, may: 1190, bulto: 24, pallet: 1100, deli: "24-48 hs", stock: "ok", badges: ["best"], deco: true, specs: { Material: "Vidrio sódico-cálcico", Capacidad: "568 ml", Altura: "150 mm", "Boca interna": "88 mm", Peso: "420 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "copa-chopp", sku: "CRI-CHO-500", cat: "Copas", sub: "Chopp", name: "Chopp pinta con asa 500 ml", pub: 1980, may: 1640, bulto: 12, pallet: 720, deli: "24-48 hs", stock: "low", badges: ["deco"], deco: true, specs: { Material: "Vidrio prensado", Capacidad: "500 ml", Altura: "145 mm", "Boca interna": "82 mm", Peso: "560 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "copa-vino", sku: "CRI-VIN-450", cat: "Copas", sub: "Vino", name: "Copa vino tinto cristal 450 ml", pub: 1650, may: 1380, bulto: 24, pallet: 960, deli: "24-48 hs", stock: "ok", badges: [], deco: true, specs: { Material: "Cristal sin plomo", Capacidad: "450 ml", Altura: "215 mm", "Boca interna": "66 mm", Peso: "180 g", Fabricación: "Importado", Origen: "Italia" } },
  { id: "copa-gin", sku: "CRI-GIN-600", cat: "Copas", sub: "Coctel", name: "Copa balón gin tonic 600 ml", pub: 2240, may: 1870, oldPub: 2580, bulto: 12, pallet: 600, deli: "24-48 hs", stock: "ok", badges: ["promo"], deco: true, specs: { Material: "Cristal sin plomo", Capacidad: "600 ml", Altura: "210 mm", "Boca interna": "105 mm", Peso: "290 g", Fabricación: "Importado", Origen: "Italia" } },
  { id: "copa-whisky", sku: "CRI-WHI-300", cat: "Copas", sub: "Whisky", name: "Vaso whisky on the rocks 300 ml", pub: 980, may: 810, bulto: 24, pallet: 1400, deli: "24-48 hs", stock: "ok", badges: [], deco: true, specs: { Material: "Vidrio prensado", Capacidad: "300 ml", Altura: "92 mm", "Boca interna": "82 mm", Peso: "340 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "copa-fernet", sku: "CRI-FER-500", cat: "Copas", sub: "Fernet", name: "Vaso fernet largo 500 ml", pub: 1120, may: 930, bulto: 24, pallet: 1300, deli: "24-48 hs", stock: "ok", badges: ["best"], deco: true, specs: { Material: "Vidrio sódico-cálcico", Capacidad: "500 ml", Altura: "168 mm", "Boca interna": "72 mm", Peso: "360 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "copa-esp", sku: "CRI-ESP-220", cat: "Copas", sub: "Espumante", name: "Copa flute espumante 220 ml", pub: 1380, may: 1150, bulto: 24, pallet: 1000, deli: "24-48 hs", stock: "low", badges: [], deco: true, specs: { Material: "Cristal sin plomo", Capacidad: "220 ml", Altura: "235 mm", "Boca interna": "52 mm", Peso: "150 g", Fabricación: "Importado", Origen: "Italia" } },
  { id: "caja-24", sku: "CAJ-24-MC", cat: "Cajas", sub: "Cartón", name: "Caja cartón microcorrugado x24 botellas", pub: 680, may: 540, bulto: 25, pallet: 600, deli: "24-48 hs", stock: "ok", badges: [], deco: true, specs: { Material: "Cartón microcorrugado", Capacidad: "24 botellas 355 ml", Altura: "260 mm", "Boca interna": "—", Peso: "310 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "botellon-19", sku: "BTL-19L", cat: "Botellones", sub: "Agua", name: "Botellón retornable 19 L — policarbonato", pub: 8900, may: 7600, bulto: 1, pallet: 60, deli: "5-7 días", stock: "ok", badges: [], deco: false, specs: { Material: "Policarbonato", Capacidad: "19 L", Altura: "490 mm", "Boca interna": "55 mm", Peso: "750 g", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "tapa-corona", sku: "TAP-COR-1K", cat: "Tapas", sub: "Corona", name: "Tapa corona pry-off x1000 — dorada", pub: 9800, may: 8200, bulto: 10, pallet: 200, deli: "24-48 hs", stock: "ok", badges: ["best"], deco: true, specs: { Material: "Hojalata", Capacidad: "1000 u", Altura: "6 mm", "Boca interna": "26 mm corona", Peso: "2,1 kg", Fabricación: "Nacional", Origen: "Argentina" } },
  { id: "tapa-rosca", sku: "TAP-ROS-500", cat: "Tapas", sub: "Rosca", name: "Tapa rosca aluminio 28 mm x500", pub: 6400, may: 5300, bulto: 10, pallet: 240, deli: "24-48 hs", stock: "low", badges: [], deco: false, specs: { Material: "Aluminio", Capacidad: "500 u", Altura: "18 mm", "Boca interna": "28 mm GPI", Peso: "1,4 kg", Fabricación: "Importado", Origen: "Brasil" } },
].map((p) => ({ ...p, img: IMG_MAP[p.id] })) as Product[];

export const CATS = ["Botellas", "Cajas", "Latas", "Vasos", "Botellones", "Copas", "Taster", "Promo-Pack", "Estuches", "Válvulas", "Tapas"];
export const GLASS = ["Pinta", "Chopp", "Vino", "Whisky", "Coctel", "Fernet", "Espumante", "Gin", "Cerveza", "Agua"];

export interface Combo {
  id: string;
  name: string;
  desc: string;
  items: string;
  from: number;
  badge: string;
}

/** PLACEHOLDER — combos genéricos hasta que Marce defina los reales */
export const COMBOS: Combo[] = [
  { id: "combo-ipa", name: "Combo IPA artesanal", desc: "Botella 500 ml + tapa corona + caja x24 + decorado 1 color", items: "3 SKUs", from: 1490, badge: "Decorado bonificado" },
  { id: "combo-gin", name: "Combo destilería gin", desc: "Botella gin 700 ml + tapa rosca + estuche + serigrafía 2 colores", items: "3 SKUs", from: 2380, badge: "Más vendido" },
  { id: "combo-bar", name: "Combo apertura de bar", desc: "Pinta + chopp + copa gin + vaso fernet — set inicial", items: "4 SKUs", from: 5980, badge: "Promo del mes" },
];

/** PLACEHOLDER — Marce tiene que mandar los logos reales de clientes */
export const BRANDS = ["Patagonia", "Andes", "Tres Toneles", "Berlina", "Antares", "Juguetes Perdidos", "Strange", "Bröeders", "Cabesas", "Gambrinus", "Kraken", "Bestia"];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function categoryImage(cat: string): string | undefined {
  return CAT_IMG[cat];
}
