import { expect, test } from '@playwright/test';
import { ANGULAR_SCREENS, login } from '../utils/e2e-session';
// [E2E teclado y foco]: en cada pantalla Angular el primer Tab llega a «Saltar al contenido», el enlace lleva el foco a <main> y hay un único <h1> | [A11y]: WCAG 2.4.1 (bypass blocks), 2.4.7 (foco visible), 1.3.1 (encabezados)

test.beforeEach(async ({ page }) => login(page));

for (const path of ANGULAR_SCREENS) {
  test(`teclado en ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /saltar al contenido|skip to content/i });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    await expect(page.locator('h1')).toHaveCount(1);
    // Ningún botón ni enlace sin nombre accesible
    for (const el of await page.locator('button, a[href]').all()) {
      const name = (await el.getAttribute('aria-label')) ?? (await el.innerText());
      expect(name.trim(), await el.evaluate((n) => n.outerHTML.slice(0, 80))).not.toBe('');
    }
  });
}
