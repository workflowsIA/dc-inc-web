import { test, expect } from "@playwright/test";
import { addFirstProductToCart, gotoCheckout } from "./helpers";

/**
 * Flujo Nave con las rutas MOCKEADAS: probamos la máquina de estados de
 * /checkout/gracias (polling → confirmado / en proceso) sin depender del
 * gateway real. Requiere NEXT_PUBLIC_NAVE_ENABLED=1 en el entorno bajo test.
 *
 * Nota: "Pagar con Nave" abre una pestaña nueva (window.open). La mandamos a
 * about:blank vía el mock de /api/nave/checkout, así el popup no navega a Nave.
 */
test.describe("Checkout — flujo Nave (mockeado)", () => {
  test("el polling confirma el pago → gracias aprobado + carrito vacío", async ({ page }) => {
    await page.route("**/api/orders", (route) =>
      route.fulfill({ json: { ok: true, id: "order_test_1", orderNumber: "#TEST-1" } }),
    );
    await page.route("**/api/nave/checkout", (route) =>
      route.fulfill({ json: { ok: true, url: "about:blank", checkoutUrl: "about:blank" } }),
    );
    // Primer poll: pendiente. Segundo en adelante: pagado.
    let polls = 0;
    await page.route("**/api/nave/status", (route) => {
      polls += 1;
      route.fulfill({
        json: polls >= 2 ? { ok: true, paid: true } : { ok: true, paid: false, status: "PENDING" },
      });
    });

    await addFirstProductToCart(page);
    await gotoCheckout(page);
    await page.getByRole("button", { name: /pagar con nave/i }).click();

    await expect(page).toHaveURL(/\/checkout\/gracias/);
    // La página concilia por polling; con el poll #2 devuelve paid.
    await expect(page.getByRole("heading", { name: /gracias por tu compra/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/carrito");
    await expect(page.getByRole("heading", { name: /tu carrito está vacío/i })).toBeVisible();
  });

  test("mientras el pago no confirma, muestra el estado 'confirmando' (no rompe)", async ({
    page,
  }) => {
    await page.route("**/api/orders", (route) =>
      route.fulfill({ json: { ok: true, id: "order_test_2", orderNumber: "#TEST-2" } }),
    );
    await page.route("**/api/nave/checkout", (route) =>
      route.fulfill({ json: { ok: true, url: "about:blank", checkoutUrl: "about:blank" } }),
    );
    await page.route("**/api/nave/status", (route) =>
      route.fulfill({ json: { ok: true, paid: false, status: "PENDING" } }),
    );

    await addFirstProductToCart(page);
    await gotoCheckout(page);
    await page.getByRole("button", { name: /pagar con nave/i }).click();

    await expect(page).toHaveURL(/\/checkout\/gracias/);
    await expect(page.getByRole("heading", { name: /confirmando tu pago/i })).toBeVisible();
    // El carrito NO se vacía hasta confirmar.
    await page.goto("/carrito");
    await expect(page.getByRole("heading", { name: /tu pedido/i })).toBeVisible();
  });
});
