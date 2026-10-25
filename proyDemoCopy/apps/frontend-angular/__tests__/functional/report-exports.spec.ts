import { expect, test } from '@playwright/test';
import { login } from '../utils/e2e-session';
// [E2E funcional · Reports (Fase 6.4)]: el ADMIN pide un PDF desde <aula-exportar> en /admin/reports (Next.js) y lo ve en /reportes/exportaciones (Angular) hasta «Listo» | [Patrón]: User Journey Test | [Tecnología]: Playwright
// [Requisitos]: NestJS con Bull + MinIO arriba; usuario ADMIN en E2E_EMAIL / E2E_PASSWORD

test.beforeEach(async ({ page }) => login(page));

test('exportar PDF desde Next.js y seguirlo en la pantalla Angular', async ({ page }) => {
  await page.goto('/admin/reports');
  // Angular Element dentro de la página de Next.js
  await page.locator('aula-exportar').getByRole('button', { name: 'Exportar PDF' }).click();
  await expect(page.locator('aula-exportar').getByRole('status')).toContainText('Exportación solicitada');

  await page.goto('/reportes/exportaciones');
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toContainText('PDF');
  // El estado llega en vivo por SSE (/api/events) sin recargar
  await expect(firstRow).toContainText('Listo', { timeout: 60_000 });
  await expect(firstRow.getByRole('link', { name: /Descargar/ })).toHaveAttribute('href', /\/api\/reports\/export\/.+\/download$/);
});
