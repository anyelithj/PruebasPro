import { defineConfig, devices } from '@playwright/test';
// [Playwright · remoto Angular]: e2e contra el shell Next.js (:9000), que reescribe las pantallas Angular | [Patrón]: Configuration Object | [Principio]: SSOT (baseURL por variable) | [Tecnología]: @playwright/test
// [Requisitos]: Next.js (pnpm dev en apps/frontend-next/), Angular (pnpm start aquí), NestJS y una sesión válida (E2E_EMAIL / E2E_PASSWORD)

export default defineConfig({
  // [Estructura uniforme con Next.js]: Playwright toma __tests__/functional y __tests__/usability; Jest toma unit/ e integration/
  testDir: './__tests__',
  testMatch: ['**/functional/**/*.spec.ts', '**/usability/**/*.spec.ts'], // Globs (no regex): funcionan con separadores de Windows y POSIX
  retries: process.env['CI'] ? 2 : 0, // Reintentos solo en CI (redes lentas)
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['NEXT_URL'] ?? 'http://localhost:9000',
    trace: 'on-first-retry',
  },
  // [Navegadores + tamaños]: escritorio y móvil (responsive)
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
