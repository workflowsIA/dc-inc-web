# E2E del checkout (Playwright) — Fase 1 del plan de robustez

Red de seguridad del funnel de compra **antes** de tocar el flujo de pago vivo.
Cubre el flujo **simulado** (sin cobrar) y el flujo **Nave con rutas mockeadas**
(determinístico, sin depender del gateway real).

## Qué prueba hoy

- `checkout-sim.spec.ts` — camino feliz (pago simulado → gracias → carrito vacío),
  cancelar (carrito intacto) y volver atrás (sin orden fantasma).
- `nave.spec.ts` — polling confirma el pago (mock) → gracias + carrito vacío; y
  el estado "confirmando" cuando aún no confirma (no rompe, no vacía el carrito).

## Setup (una vez)

```
cd ~/Documents/Claude/Projects/DC\ INC/dc-inc-web
npm i -D @playwright/test @clerk/testing dotenv
npx playwright install chromium
```

Agregá a `package.json` → `scripts`:

```
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

En `.env.local` (o exportadas en la shell del test):

```
E2E_BASE_URL=http://localhost:3000        # o la URL de un preview de Vercel
E2E_TEST_EMAIL=<usuario de test Clerk>     # rol CLIENTE FINAL (no mayorista)
E2E_TEST_PASSWORD=<su password>
# Clerk (ya deberían estar en .env.local):
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY
```

El entorno bajo test tiene que tener los flags del checkout que quieras probar:
`NEXT_PUBLIC_CHECKOUT_SIM=1` (para `checkout-sim`) y `NEXT_PUBLIC_NAVE_ENABLED=1`
(para `nave`). Si alguno está apagado, saltá ese spec.

Creá el **usuario de test** en Clerk (Dashboard → Users → Create) con email +
password, rol cliente final.

## Correr

```
# 1) Levantá el server en otra terminal:
npm run dev
# 2) En otra terminal:
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Si el login automático no matchea (fallback manual)

`auth.setup.ts` usa el helper `clerk.signIn` de `@clerk/testing` (estrategia
password). Si tu sign-in es 100% custom y no engancha:

1. Logueate a mano una vez en un browser de Playwright:
   `npx playwright open $E2E_BASE_URL` → iniciá sesión.
2. Guardá el storageState y apuntá los specs a ese archivo, **o** reemplazá el
   cuerpo de `auth.setup.ts` por un login por UI con tus selectores.

## Pendientes de esta suite (cuando avancemos la robustez)

- **Mayorista → WhatsApp**: requiere un segundo usuario de test con rol
  `wholesale` (el checkout le oculta el pago online). Falta setear ese proyecto.
- **Sin stock (409)**: hoy `/api/orders` no devuelve 409 `out_of_stock` — ese
  chequeo todavía no existe en el server (el checkout lo maneja pero nunca se
  dispara). Se testea cuando se implemente en el ciclo de vida de la orden.
- **Webhook idempotente**: se testea a nivel API cuando el webhook de Nave esté
  activo (hoy el confirm real va por polling).
- **Timeout del polling**: `MAX_POLLS` es ~5 min; para testearlo sin esperar
  conviene hacerlo configurable por env en `gracias/page.tsx`.
