import type { Page } from '@playwright/test';
// [login e2e]: inicia sesión en el shell Next.js (la cookie httpOnly la comparten las pantallas Angular) | [Patrón]: Test Helper | [Principio]: DRY (todas las specs e2e)

export const ANGULAR_SCREENS = ['/tutor', '/redaccion', '/estudio/plan', '/estudio/recomendaciones', '/notificaciones'] as const;

export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('load'); // React hidratado: el envío lo maneja el formulario (no el envío nativo)
  await page.getByLabel(/correo|email/i).fill(process.env['E2E_EMAIL'] ?? 'admin@aula.test');
  await page.getByLabel(/contraseña|password/i).first().fill(process.env['E2E_PASSWORD'] ?? 'Admin123!');
  // [Botón exacto]: el login también tiene OAuth y «Enviar enlace» (magic link) → un regex amplio coincidía con 3 botones
  await page.getByRole('button', { name: /^(iniciar sesión|sign in|log in)$/i }).click();
  await page.waitForURL(/dashboard/);
}
