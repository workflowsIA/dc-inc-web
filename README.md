# DC Inc — Web mayorista

Sitio nuevo de DC Inc en Next.js 16 (App Router) + Sanity + Clerk + Vercel.

Reemplaza el Wix actual. MVP para go-live **2026-06-20**.

## Stack

- Next.js 16 (App Router, React 19)
- TypeScript estricto
- Tailwind CSS v4 + design system custom (CSS variables) portado de los wireframes de Claude Design
- Sanity (CMS del catálogo, hero/banners, combos, marcas, blog)
- Clerk (auth + flag de aprobación mayorista en `publicMetadata.role`)
- Zustand (estado del carrito persistido en localStorage)
- Vercel (deploy)

## Decisiones cerradas (no volver atrás)

- **Sin Mercado Pago en el MVP.** Todo cierre se hace por WhatsApp.
- **Login mayorista con 2 listas de precios.** Visitante ve `pricePublic`, mayorista logueado y aprobado ve `priceWholesale`.
- **Integración Monday parcial real** (ver `decisiones/d-003` en el vault): lectura stock + escritura de catálogo + push de OT al cerrar pedido.

## Setup local

```bash
cp .env.local.example .env.local
# Rellená project ID + tokens (Sanity, Clerk, Monday) — pedírselos a Fede

npm install
npm run dev        # http://localhost:3000
npm run sanity:dev # studio standalone en http://localhost:3333
npm run build      # verifica compilación
```

> **Nota:** el bootstrap del proyecto se hizo en Cowork pero el `npm install`
> de Sanity y Clerk no terminó por una limitación del sandbox.
> Hay que correr `npm install` localmente para resolver esas deps.

## Estructura

```
src/
├── app/                       # rutas
│   ├── page.tsx               # home (porteada de wireframes/home.html — opción A)
│   ├── productos/             # catálogo
│   │   ├── page.tsx
│   │   └── [id]/page.tsx      # ficha de producto
│   ├── carrito/               # carrito + handoff WhatsApp
│   ├── cuenta/                # login / registro (Clerk)
│   ├── mi-cuenta/             # área logueada
│   ├── personaliza/           # decorado / serigrafía
│   ├── nosotros/              # institucional
│   ├── logistica/             # cobertura + transportes
│   ├── faq/                   # preguntas frecuentes
│   └── blog/                  # blog + artículos GEO mes 2
├── components/
│   ├── site/                  # Header, Footer, CartCount
│   └── blocks/                # ProductCard, etc.
├── data/products.ts           # mock data — reemplazada por Sanity al correr migración
├── lib/                       # cn, format, whatsapp, cart-store, sanity
└── styles/ds.css              # design system portado de los wireframes

sanity/schemas/                # schemas del CMS
scripts/migrate-wix-to-sanity.ts # importa los 300 SKUs del feed Wix
```

## Migración del catálogo

```bash
# 1. Las categorías base hay que crearlas a mano una vez en /studio
# 2. Configurar SANITY_API_WRITE_TOKEN en .env.local
# 3. Dry run primero
npm run migrate:wix -- --dry-run
# 4. Run real
npm run migrate:wix
```

Lee `feed.tsv` del wix-export (path en `WIX_FEED_PATH` o el default
`/Users/fede/Documents/Claude/Projects/DC INC/wix-export/feed.tsv`).

## Placeholders en uso

Ver el documento vivo en el vault de Obsidian:
`vault/10 Negocio/Clientes/DC Inc/entregables/placeholders-y-pedidos-web-mvp.md`

Cosas marcadas con `// PLACEHOLDER` en el código:
- regla de descuento por volumen (`src/lib/whatsapp.ts`)
- CUIT en el footer (`src/components/site/Footer.tsx`)
- combos del home (`src/data/products.ts`)
- logos clientes vidriera (`src/data/products.ts`)
- precio mayorista = -18% del público (script de migración)

## Deploy

- Repo destino: `workflowsIA/dc-inc-web` (org pendiente de creación)
- Vercel: proyecto `dc-inc-web` apuntando al repo
- Dominio staging: `dcinc-staging.vercel.app`
- Cutover DNS de `dcinc.com.ar` el 2026-06-20
