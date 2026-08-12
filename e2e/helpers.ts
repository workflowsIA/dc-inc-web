import { type Page, expect } from "@playwright/test";

/**
 * Agrega el primer producto del catálogo al carrito usando el botón ícono de
 * la card (`.pcard-add`, aria-label "Agregar … al carrito"). Sirve como semilla
 * genérica del carrito sin depender de un SKU puntual.
 */
export async function addFirstProductToCart(page: Page) {
  await page.goto("/productos");
  const addBtn = page.locator("button.pcard-add").first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  // Feedback visual del botón (Plus → Check) para asegurar que el add corrió.
  await page.waitForTimeout(300);
}

/** Va al checkout (el carrito persiste en localStorage `dc_cart_v2`). */
export async function gotoCheckout(page: Page) {
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: /revisá y confirmá/i })).toBeVisible();
}
