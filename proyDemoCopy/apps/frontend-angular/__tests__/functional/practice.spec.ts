import { expect, test } from '@playwright/test';
import { login } from '../utils/e2e-session';
// [E2E funcional · Practice (Sprints 8.12–8.15)]: elegir una actividad publicada, resolver el primer ítem, ver la corrección DEBAJO del ejercicio (respuesta correcta y consejo) y llegar al resumen | [Patrón]: User Journey Test | [Tecnología]: Playwright
// [Requisitos]: al menos una actividad publicada (seed de la Fase 8: «Presente simple: mi rutina»)

test.beforeEach(async ({ page }) => login(page));

test('resolver, corregir y ver retroalimentación', async ({ page }) => {
  await page.goto('/practica');
  await page.getByRole('link', { name: /Presente simple: mi rutina/ }).click();
  await expect(page.getByText(/Ejercicio 1 de \d+/)).toBeVisible();
  await page.getByText('drink', { exact: true }).click(); // Opción incorrecta a propósito
  await page.getByRole('button', { name: 'Comprobar' }).click();
  const panel = page.getByRole('status').filter({ hasText: /Hay errores|Casi|Correcto/ });
  await expect(panel).toContainText('Respuesta correcta');
  await expect(panel).toContainText('Consejo');
  await expect(panel.locator('del')).toHaveText('drink');
  await expect(panel.locator('ins')).toHaveText('drinks');
});
