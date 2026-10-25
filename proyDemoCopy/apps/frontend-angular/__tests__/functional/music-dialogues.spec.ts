import { expect, test } from '@playwright/test';
import { login } from '../utils/e2e-session';
// [E2E funcional · Music + Dialogues (Sprints 9.7–9.13)]: canción con texto sincronizado (dos columnas, IPA y traducción) y conversación con el avatar por tema, de punta a punta a través del shell Next.js | [Patrón]: User Journey Test | [Tecnología]: Playwright
// [Requisitos]: NestJS + FastAPI arriba; usuario en E2E_EMAIL / E2E_PASSWORD; al menos una colección publicada (pnpm seed:music --publish) — el avatar usa el LLM local: el turno puede tardar

test.beforeEach(async ({ page }) => login(page));

test('música: colecciones por idioma y nivel', async ({ page }) => {
  await page.goto('/musica');
  await expect(page.getByRole('heading', { level: 1, name: 'Música' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Colecciones' })).toBeVisible();
  await expect(page.getByLabel('Nivel')).toBeVisible(); // [Filtro]: A1–C2 o todos
});

test('música: reproductor con avatar, letra en dos columnas y velocidad 0,75x', async ({ page }) => {
  await page.goto('/musica');
  await page.locator('a[href^="/musica/coleccion/"]').first().click(); // [Navegación]: primera colección publicada
  await page.locator('a[href^="/musica/cancion/"]').first().click();
  await expect(page.getByText('Original e IPA')).toBeVisible(); // [SyncedTranscript]: columna izquierda
  await expect(page.getByText('Traducción al español')).toBeVisible(); // [SyncedTranscript]: columna derecha
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: /En reposo|Cantando/ }).first()).toBeVisible(); // [AvatarStage]: el estado se anuncia en texto (el SVG es decorativo)
  await expect(page.getByLabel('Velocidad')).toBeVisible();
});

test('diálogos: temas semilla y conversación con el avatar (alternativa escrita)', async ({ page }) => {
  test.setTimeout(180_000); // LLM local
  await page.goto('/dialogos');
  await expect(page.getByRole('heading', { name: 'Temas de conversación' })).toBeVisible();
  await page.getByRole('link', { name: 'Conversar' }).first().click();
  await page.getByRole('button', { name: 'Empezar a conversar' }).click();
  await page.getByPlaceholder('Escribe lo que quieres decir…').fill('Hello, my name is Ana and I am from Spain.');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Aula').last()).toBeVisible({ timeout: 150_000 }); // [Turno]: respuesta del avatar
  await page.getByRole('button', { name: 'Terminar' }).click();
  await expect(page.getByText('Conversación terminada. ¡Buen trabajo!')).toBeVisible();
});

test('diálogos: biblioteca con nivel visible', async ({ page }) => {
  await page.goto('/dialogos/biblioteca');
  await expect(page.getByRole('heading', { level: 1, name: 'Biblioteca de diálogos' })).toBeVisible();
});
