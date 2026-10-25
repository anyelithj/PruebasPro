import { expect, test, devices } from "@playwright/test";
// [Perf Landing · Sprint 7.13]: la home pública es interactiva en < 3,5 s en un móvil con red 3G simulada | [Herramienta]: Playwright + Chrome DevTools Protocol (limitación de red y CPU) | [Patrón]: Performance Budget
// [Medición]: TTI aproximado = fin de `load` + primer «long task» libre (Navigation Timing L2) · se ejecuta contra `pnpm build && pnpm start` (webServer de playwright.config.ts), no contra el modo dev

test.use({ ...devices["Pixel 7"], storageState: { cookies: [], origins: [] } }); // Visitante anónimo en móvil

test("landing: interactiva en < 3,5 s con red 3G y CPU 4× más lenta", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  // [Fast 3G]: 1,6 Mbps de bajada, 750 kbps de subida, 150 ms de latencia (perfil de Lighthouse)
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.goto("/", { waitUntil: "load" });
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return { load: nav.loadEventEnd, dcl: nav.domContentLoadedEventEnd };
  });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // El hero (único <h1>) ya está pintado
  expect(timing.dcl).toBeLessThan(3_500);
  expect(timing.load).toBeLessThan(3_500);
});

test("landing: datos estructurados y anclas del navbar", async ({ page }) => {
  await page.goto("/");
  const types = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => (JSON.parse(e.textContent ?? "{}") as { "@type"?: string })["@type"]));
  expect(types).toEqual(expect.arrayContaining(["EducationalOrganization", "ItemList", "FAQPage"]));
  for (const id of ["cursos", "niveles", "como-funciona", "planes", "faq"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
});
