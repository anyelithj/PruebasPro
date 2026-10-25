import { test, expect } from "@playwright/test";
// [Functional E2E · Admin crear/editar usuario · campo Sección por rol] (corrección 2026-06-01)
// REQUISITOS para ejecutar:
//   1. App levantada (frontend en http://localhost:9000 + backend en :4000).
//   2. Sesión ADMIN activa: configurar `storageState` en playwright.config.ts (las rutas /admin/* son protegidas
//      y redirigen a /login sin cookie de acceso). Hoy playwright.config.ts está vacío → configurar antes de correr.
//   3. baseURL = http://localhost:9000 en playwright.config.ts.

test.describe("Admin · campo Sección visible solo para Estudiante", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/users/new");
    // si redirige a /login, falta storageState de admin (ver requisitos arriba)
    await expect(page.getByRole("heading", { name: "Nuevo usuario" })).toBeVisible();
  });

  test("Sección visible por defecto (rol Estudiante)", async ({ page }) => {
    await expect(page.getByLabel("Rol *")).toHaveValue("USER");
    await expect(page.getByLabel("Sección")).toBeVisible();
  });

  test("oculta Sección al elegir Docente o Administrador", async ({ page }) => {
    await page.getByLabel("Rol *").selectOption("TEACHER");
    await expect(page.getByLabel("Sección")).toHaveCount(0);
    await page.getByLabel("Rol *").selectOption("ADMIN");
    await expect(page.getByLabel("Sección")).toHaveCount(0);
  });

  test("reaparece Sección al volver a Estudiante", async ({ page }) => {
    await page.getByLabel("Rol *").selectOption("TEACHER");
    await expect(page.getByLabel("Sección")).toHaveCount(0);
    await page.getByLabel("Rol *").selectOption("USER");
    await expect(page.getByLabel("Sección")).toBeVisible();
  });
});
