import { test as setup, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import fs from "node:fs";

/**
 * Loguea un usuario de prueba y guarda la sesión para el resto de los specs.
 *
 * REQUISITO: un usuario de test en Clerk con email + password (rol cliente
 * final, NO mayorista — el checkout online se prueba con cliente final).
 * Cargá en .env.local:
 *   E2E_TEST_EMAIL=...        (el email del usuario de test)
 *   E2E_TEST_PASSWORD=...     (su password)
 *
 * Si tu sign-in es 100% custom y este helper no matchea, usá el fallback
 * manual del README (login a mano una vez → guardar storageState).
 */
const authFile = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Faltan E2E_TEST_EMAIL / E2E_TEST_PASSWORD en .env.local (usuario de test de Clerk).",
    );
  }

  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: { strategy: "password", identifier: email, password },
  });

  // Verificamos que la sesión quedó activa entrando a una ruta que exige login.
  await page.goto("/checkout");
  await expect(page).not.toHaveURL(/sign-in/);

  fs.mkdirSync("e2e/.auth", { recursive: true });
  await page.context().storageState({ path: authFile });
});
