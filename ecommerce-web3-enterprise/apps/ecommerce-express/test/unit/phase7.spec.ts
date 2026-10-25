// phase7.spec.ts (Jest) => reglas PURAS de la Fase 7 (Analytics, Admin & Integrations) + compensación de la saga MCP.
// Sin bases de datos ni red: "jest.mock" (se eleva al inicio) reemplaza la configuración y los servicios con efectos.
jest.mock("../../src/config/app.config", () => ({
  appConfig: { AUDIT_RETENTION_DAYS: 365, LOW_STOCK_THRESHOLD: 5, API_BASE_URL: "http://api.test", N8N_WEBHOOK_URL: "http://n8n.test/webhook", FRONTEND_URL: "http://shop.test" },
  isProduction: false,
}));
// "requireActual" => conserva las funciones puras reales (forecast) y reemplaza solo el servicio con efectos
jest.mock("../../src/module/inventory/service/inventory.service", () => ({
  ...jest.requireActual("../../src/module/inventory/service/inventory.service"),
  inventoryService: {
    reserve: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    move: jest.fn(async () => {
      throw new Error("Stock insuficiente");
    }),
    deleteStockMovementById: jest.fn(async () => undefined),
  },
}));
jest.mock("../../src/module/notification/service/notification.service", () => ({ notificationService: { notify: jest.fn(async () => undefined) } }));

import crypto from "node:crypto";
import { describeRequest } from "../../src/module/audit-log/service/audit.service";
import { signPayload } from "../../src/module/webhook/handler/webhook.handler";
import { isAllowedUrl } from "../../src/module/webhook/service/webhook.service";
import { nextPurchase, rfmScore } from "../../src/module/crm/service/crm.service";
import { extractVariables, renderTemplate } from "../../src/module/email/util/template.util";
import { mergeSeries } from "../../src/module/analytics/service/analytics.service";
import { kpi } from "../../src/module/dashboard/service/dashboard.service";
import { SagaOrchestrator, validateStep, type SagaJournal } from "../../src/module/mcp-server/saga/mcp.saga";
import { forecast, inventoryService } from "../../src/module/inventory/service/inventory.service";
import type { SagaStepDto } from "../../src/module/mcp-server/dto/mcp.dto";

const DAY = 24 * 60 * 60 * 1000;

describe("audit: describeRequest", () => {
  it("normaliza IDs y extrae el módulo", () => {
    expect(describeRequest("PATCH", "/api/v1/product/0b8f8a3e-1d2c-4b5a-9e8f-123456789abc?x=1")).toEqual({
      module: "product",
      action: "PATCH /api/v1/product/:id",
      resourceId: "0b8f8a3e-1d2c-4b5a-9e8f-123456789abc",
    });
  });
});

describe("inventory: forecast", () => {
  it("sin ventas no estima días de cobertura", () => {
    expect(forecast(10, 0)).toEqual({ avgDailySales: 0, daysOfCover: null, reorderQuantity: 0 });
  });
  it("30 unidades en 30 días => 1/día; con 5 disponibles sugiere 9 para 14 días", () => {
    expect(forecast(5, 30)).toEqual({ avgDailySales: 1, daysOfCover: 5, reorderQuantity: 9 });
  });
});

describe("webhook: firma y anti-SSRF", () => {
  it("firma HMAC-SHA256 de '<t>.<cuerpo>' verificable por el receptor", () => {
    const expected = crypto.createHmac("sha256", "secreto").update('1700000000.{"a":1}').digest("hex");
    expect(signPayload("secreto", 1_700_000_000, '{"a":1}')).toBe(expected);
  });
  it("en producción exige https y host público", () => {
    expect(isAllowedUrl("https://hooks.example.com/x", true)).toBe(true);
    expect(isAllowedUrl("http://hooks.example.com/x", true)).toBe(false);
    expect(isAllowedUrl("https://192.168.1.10/x", true)).toBe(false);
    expect(isAllowedUrl("http://localhost:3000/x", false)).toBe(true);
    expect(isAllowedUrl("ftp://example.com", false)).toBe(false);
  });
});

describe("crm: scoring y próxima compra", () => {
  const now = Date.UTC(2026, 9, 5);
  it("RFM máximo para un cliente reciente, frecuente y de alto valor", () => {
    expect(rfmScore({ orders: 5, ltvCents: 200_000_000, lastOrderAt: new Date(now - 2 * DAY) }, now)).toBe(100);
  });
  it("RFM 0 sin compras", () => {
    expect(rfmScore({ orders: 0, ltvCents: 0, lastOrderAt: null }, now)).toBe(0);
  });
  it("próxima compra = última + intervalo medio", () => {
    const first = new Date(now - 20 * DAY);
    const last = new Date(now - 10 * DAY);
    expect(nextPurchase({ orders: 2, firstOrderAt: first, lastOrderAt: last })?.getTime()).toBe(now);
    expect(nextPurchase({ orders: 1, firstOrderAt: last, lastOrderAt: last })).toBeNull();
  });
});

describe("email: plantillas dinámicas", () => {
  it("detecta variables sin repetir y escapa HTML en el render", () => {
    expect(extractVariables("Hola {{ firstName }}", "<p>{{firstName}} {{ code }}</p>")).toEqual(["firstName", "code"]);
    expect(renderTemplate("<p>{{ name }}{{ missing }}</p>", { name: "<b>Ana</b>" }, true)).toBe("<p>&lt;b&gt;Ana&lt;/b&gt;</p>");
    expect(renderTemplate("Hola {{ name }}", { name: "<b>Ana</b>" }, false)).toBe("Hola <b>Ana</b>");
  });
});

describe("analytics y dashboard", () => {
  it("une ventas y comportamiento por período con conversión", () => {
    const series = mergeSeries([{ period: "2026-10-01", orders: 2, revenueCents: 1000 }], [{ period: "2026-10-01", sessions: 10, counts: { purchase: 2, page_view: 30 } }, { period: "2026-10-02", sessions: 4, counts: {} }]);
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({ aovCents: 500, conversionRate: 0.2, pageViews: 30 });
    expect(series[1]).toMatchObject({ revenueCents: 0, sessions: 4 });
  });
  it("kpi calcula la variación contra el período anterior", () => {
    expect(kpi(120, 100)).toEqual({ value: 120, previous: 100, change: 0.2 });
    expect(kpi(5, 0).change).toBe(0);
  });
});

describe("mcp: saga orquestada", () => {
  const variantId = "0b8f8a3e-1d2c-4b5a-9e8f-123456789abc";
  const journal: SagaJournal = { saveStep: jest.fn(async () => undefined) };
  const pending = (name: string, input: Record<string, unknown>): SagaStepDto => ({ name, input, output: null, status: "PENDING", error: null, startedAt: null, finishedAt: null });

  it("valida la entrada de cada paso con su schema", () => {
    expect(validateStep("inventory.reserve", { variantId, quantity: 0 }).ok).toBe(false);
    expect(validateStep("inventory.reserve", { variantId, quantity: 2 }).ok).toBe(true);
  });

  it("si un paso falla compensa los anteriores en orden inverso", async () => {
    const steps = [pending("inventory.reserve", { variantId, quantity: 2 }), pending("inventory.adjust", { variantId, delta: -1, reason: "venta mayorista" })];
    const outcome = await new SagaOrchestrator().run(steps, { transactionId: "t1", actorId: "admin" }, journal);
    expect(outcome).toBe("COMPENSATED");
    expect(inventoryService.release).toHaveBeenCalledWith(variantId, 2);
    expect(steps.map((step) => step.status)).toEqual(["COMPENSATED", "FAILED"]);
  });
});
