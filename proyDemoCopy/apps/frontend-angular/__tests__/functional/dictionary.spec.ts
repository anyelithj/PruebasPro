import { expect, test } from '@playwright/test';
import { login } from '../utils/e2e-session';
// [E2E funcional · Diccionario (Sprints 10.2–10.4)]: clic en una palabra de una ficha de gramática → pronunciación, traducción y «Aprender» / «Aprendido»; Esc cierra y devuelve el foco | [Patrón]: User Journey Test | [Tecnología]: Playwright
// [Requisitos]: NestJS + FastAPI arriba (fichas semilla de GrammarModule); usuario en E2E_EMAIL / E2E_PASSWORD

test.beforeEach(async ({ page }) => login(page));

test('palabra pulsable: ventana con traducción, Aprender y Aprendido', async ({ page }) => {
  test.setTimeout(120_000); // LLM local para la traducción en contexto
  await page.goto('/gramatica');
  await page.getByRole('link', { name: /Present Simple/ }).click();
  const word = page.getByRole('button', { name: /Diccionario: «coffee»/ }).first();
  await word.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Traducción')).toBeVisible({ timeout: 90_000 });
  const learn = dialog.getByRole('button', { name: /Aprender/ });
  if (await learn.isVisible()) await learn.click();
  await expect(dialog.getByRole('button', { name: /Aprendido/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(word).toBeFocused();
  await expect(word).toHaveAttribute('aria-label', /Aprendiendo|Aprendido/); // Resaltada en el texto
});
