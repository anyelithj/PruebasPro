import { expect, test } from '@playwright/test';
import { login } from '../utils/e2e-session';
// [E2E funcional · Games (Sprints 8.8–8.11)]: un juego de cada familia de punta a punta a través del shell Next.js — vocabulario (clasificación con teclado), comprensión (dictado parcial), fluidez con el agente (tabú) y panel de métricas | [Patrón]: User Journey Test | [Tecnología]: Playwright
// [Requisitos]: NestJS + FastAPI arriba; usuario en E2E_EMAIL / E2E_PASSWORD (el agente usa el LLM local: el turno puede tardar)

test.beforeEach(async ({ page }) => login(page));

test('hub: catálogo por familias con licencia del contenido y enlaces con preferencias', async ({ page }) => {
  await page.goto('/juegos');
  await expect(page.getByRole('heading', { level: 1, name: 'Juegos y actividades' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vocabulario y memoria' })).toBeVisible();
  await expect(page.getByText(/CC BY 4\.0/)).toBeVisible();
  await expect(page.locator('a[href^="/juegos/memory"]')).toHaveAttribute('href', /lang=/);
});

test('vocabulario: clasificación rápida sin arrastrar (alternativa por teclado)', async ({ page }) => {
  await page.goto('/juegos/clasificar?lang=en');
  await page.getByRole('button', { name: 'Empezar' }).click();
  const firstWord = page.locator('ul[aria-label="Clasificación rápida"] button').first();
  await firstWord.click(); // Elegir palabra (aria-pressed)
  await expect(firstWord).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^→ / }).first().click(); // Enviarla al primer grupo
  await expect(page.locator('section[aria-label] li.badge').first()).toContainText(/[✓✗]/);
});

test('comprensión: dictado parcial oculta la palabra y corrige', async ({ page }) => {
  await page.goto('/juegos/dictado?lang=en');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByText('_____')).toBeVisible();
  await page.getByLabel('Escribe la palabra que falta').fill('bus');
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Correcto|No es correcto/ })).toBeVisible();
});

test('fluidez: tabú con el agente responde un turno', async ({ page }) => {
  test.setTimeout(180_000); // LLM local
  await page.goto('/juegos/tabu?lang=en');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByText('No puedes decir')).toBeVisible();
  await page.getByLabel('Tu respuesta').fill('You use it when you are thirsty in the morning');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('ol[aria-live] li')).toHaveCount(3, { timeout: 150_000 }); // instrucciones + tú + agente
});

test('métricas: panel de fluidez con turnos sostenidos', async ({ page }) => {
  await page.goto('/juegos/progreso');
  await expect(page.getByRole('heading', { level: 1, name: /Métricas de fluidez/ })).toBeVisible();
});
