import { test, expect } from "@playwright/test";

// [Functional E2E · Session Expiry]
// Valida la redirección inmediata a /login cuando la sesión expira o el token es inválido.
// [Arquitectura real]: no hay silent refresh — el proxy (proxy.ts) y los handlers
// redirigen directamente a /login ante ausencia de sesión o respuesta 401.

test.describe("Session Expiry · Autenticación", () => {
  test("debe redirigir a /login cuando un endpoint protegido devuelve 401", async ({ page, baseURL }) => {
    // 1. Simular token inválido: la cookie de acceso existe (el proxy la deja pasar)
    //    pero el JWT es basura → getCurrentUserRole() devuelve null server-side.
    //    [Nota]: page.route("**/api/**") NO sirve aquí — el dashboard es RSC y sus
    //    fetches ocurren en Node (server), fuera del alcance de Playwright.
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: "neuroedu_access",
        value: "invalid-token",
        url: baseURL!,
      },
    ]);

    // 2. Intentar acceder a una ruta protegida del portal
    await page.goto("/dashboard");

    // 3. El sistema debe redirigir inmediatamente a /login (sin intentar refresh)
    await expect(page).toHaveURL(/\/login/);
  });

  test("debe redirigir a /login con query `from` al acceder al portal sin sesión", async ({ page }) => {
    // 1. Sin cookie de acceso, el proxy intercepta la navegación al portal
    await page.context().clearCookies();
    await page.goto("/dashboard");

    // 2. Redirección con `?from=/dashboard` para retornar tras autenticarse
    await expect(page).toHaveURL(/\/login\?from=%2Fdashboard|\/login\?from=\/dashboard/);

    // 3. La vista de login debe estar visible (heading real: "Iniciar sesión")
    await expect(
      page.getByRole("heading", { name: /iniciar sesión/i }),
    ).toBeVisible();
  });
});
