import { expect, test } from '@playwright/test';
import { ANGULAR_SCREENS, login } from '../utils/e2e-session';
// [E2E responsive]: ninguna pantalla Angular desborda horizontalmente en móvil, tablet ni escritorio (tablas con scroll propio) | [UX]: WCAG 1.4.10 (reflow)

const SIZES = [
  { name: 'móvil', width: 375, height: 740 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'escritorio', width: 1440, height: 900 },
];

test.beforeEach(async ({ page }) => login(page));

for (const size of SIZES) {
  for (const path of [...ANGULAR_SCREENS, '/reportes/exportaciones']) {
    test(`${path} sin scroll horizontal en ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(path);
      await page.locator('h1').waitFor();
      // `scrollWidth > clientWidth` del documento = desborde horizontal de la página
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
