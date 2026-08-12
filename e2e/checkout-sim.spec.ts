import { test, expect } from "@playwright/test";
import { addFirstProductToCart, gotoCheckout } from "./helpers";

/**
 * Flujo simulado (NEXT_PUBLIC_CHECKOUT_SIM=1): banco de pruebas del funnel de
 * compra sin cobrar. Cubre camino feliz y cancelación.
 *
 * Requiere que el entorno bajo test tenga NEXT_PUBLIC_CHECKOUT_SIM=1.
 */
test.describe("Checkout — flujo simulado", () => {
  test("camino feliz: comprar → pagar simulado → gracias aprobado → carrito vacío", async ({
    page,
  }) => {
    await addFirstProductToCart(page);
    await gotoCheckout(page);

    await page.getByRole("button", { name: /comprar ahora/i }).click();
    await expect(page).toHaveURL(/\/checkout\/pago/);

    await page.getByRole("button", { name: /pagar ahora/i }).click();
    await expect(page).toHaveURL(/\/checkout\/gracias/);
    await expect(page.getByRole("heading", { name: /gracias por tu compra/i })).toBeVisible();

    // El carrito se vacía sólo con pago confirmado.
    await page.goto("/carrito");
    await expect(page.getByRole("heading", { name: /tu carrito está vacío/i })).toBeVisible();
  });

  test("cancelar el pago: no se compra y el carrito queda intacto", async ({ page }) => {
    await addFirstProductToCart(page);
    await gotoCheckout(page);

    await page.getByRole("button", { name: /comprar ahora/i }).click();
    await expect(page).toHaveURL(/\/checkout\/pago/);

    await page.getByRole("button", { name: /cancelar pago/i }).click();
    await expect(page).toHaveURL(/\/checkout\/gracias/);
    await expect(page.getByRole("heading", { name: /no se completó el pago/i })).toBeVisible();

    // Carrito intacto (no se vació): sigue mostrando el pedido.
    await page.goto("/carrito");
    await expect(page.getByRole("heading", { name: /tu pedido/i })).toBeVisible();
  });

  test("volver atrás desde el pago: sin orden fantasma pagada, carrito intacto", async ({
    page,
  }) => {
    await addFirstProductToCart(page);
    await gotoCheckout(page);

    await page.getByRole("button", { name: /comprar ahora/i }).click();
    await expect(page).toHaveURL(/\/checkout\/pago/);

    await page.goBack();
    // Carrito sigue con el pedido; no se confirmó ningún pago.
    await page.goto("/carrito");
    await expect(page.getByRole("heading", { name: /tu pedido/i })).toBeVisible();
  });
});
