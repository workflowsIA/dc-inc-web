import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Levanta CLERK_*, NEXT_PUBLIC_CHECKOUT_SIM, etc. desde .env.local para que
// el global-setup de Clerk y los tests tengan las claves.
loadEnv({ path: ".env.local" });

/**
 * Config de Playwright para la suite E2E del checkout (Fase 1 del plan de
 * robustez). Corre contra un server ya levantado (dev o preview de Vercel);
 * seteá E2E_BASE_URL. Requiere NEXT_PUBLIC_CHECKOUT_SIM=1 en ese entorno para
 * los tests del flujo simulado.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false, // el carrito/orden comparten estado de sesión
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // 1) Autentica una vez y guarda la sesión en e2e/.auth/user.json.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // 2) Los specs corren ya logueados (reusan la sesión).
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
