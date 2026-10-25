import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./playwright/global-setup";

// [Playwright E2E config] — scope SOLO a specs E2E (*.spec.ts).
// Los tests de Jest usan sufijo *.test.tsx y NO deben correr aquí.
const PORT = 9000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./__tests__",
  // [clave]: solo .spec.ts → excluye los .test.tsx de Jest (unit/integration)
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // [auth]: loguea como ADMIN una vez y reusa la sesión (cookies) en todos los tests
  globalSetup: "./playwright/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // [webServer]: build + start (prod) → sin Turbopack HMR → estable, sin panics de arranque-frío.
  // Reusa server existente en local; en CI siempre build limpio.
  webServer: {
    command: "pnpm build && pnpm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
