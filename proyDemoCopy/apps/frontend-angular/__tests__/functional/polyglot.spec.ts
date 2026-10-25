import { expect, test } from '@playwright/test';
import { login } from '../utils/e2e-session';
// [E2E funcional · Poliglota (Sprints 10.5–10.8, 10.14)]: abrir desde Recursos, elegir tema e idiomas, reordenar columnas con teclado y escuchar un término | [Patrón]: User Journey Test | [Tecnología]: Playwright
// [Requisitos]: NestJS arriba (cinco temas semilla); usuario en E2E_EMAIL / E2E_PASSWORD

test.beforeEach(async ({ page }) => login(page));

test('Recursos ofrece Poliglota junto a los siete idiomas', async ({ page }) => {
  await page.goto('/resources');
  await page.getByRole('link', { name: /Poliglota/ }).click();
  await expect(page).toHaveURL(/\/poliglota$/);
  await expect(page.getByRole('heading', { level: 1, name: /Poliglota/ })).toBeVisible();
});

test('tema Familia: español al final, reordenar y quitar idiomas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); // Tabla (en móviles se ven tarjetas)
  await page.goto('/poliglota');
  await page.getByRole('button', { name: /Familia/ }).click();
  const headers = page.locator('thead th[lang]');
  await expect(headers.last()).toHaveAttribute('lang', 'es');
  await page.getByRole('button', { name: 'Subir Español' }).click();
  await expect(headers.nth(-2)).toHaveAttribute('lang', 'es');
  await page.getByLabel('Alemán').uncheck();
  await expect(page.locator('thead th[lang="de"]')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: /mother/ })).toBeVisible();
  await page.getByRole('button', { name: /Escuchar «mother» en Inglés/ }).click();
});
