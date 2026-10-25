import { expect, test } from '@playwright/test';
import { login } from '../utils/e2e-session';
// [E2E funcional · Gramática (Sprints 10.9–10.12)]: ficha con secciones en español, IPA con interruptor UK/US, traducción visible por defecto que se puede ocultar y diccionario en los ejemplos | [Patrón]: User Journey Test | [Tecnología]: Playwright
// [Requisitos]: NestJS arriba (fichas semilla Present Simple, Present Continuous y Present Perfect); usuario en E2E_EMAIL / E2E_PASSWORD

test.beforeEach(async ({ page }) => login(page));

test('lista y ficha de Present Simple con secciones y traducción', async ({ page }) => {
  await page.goto('/gramatica');
  await expect(page.getByRole('heading', { level: 1, name: /Gramática/ })).toBeVisible();
  await page.getByRole('link', { name: /Present Simple/ }).click();
  for (const s of ['Uso', 'Fórmula', 'Negativa', 'Interrogativa']) await expect(page.getByRole('heading', { name: s })).toBeVisible();
  const toggle = page.getByRole('button', { name: /traducción/ });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('switch')).toBeVisible(); // Interruptor UK/US (ficha de inglés)
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
