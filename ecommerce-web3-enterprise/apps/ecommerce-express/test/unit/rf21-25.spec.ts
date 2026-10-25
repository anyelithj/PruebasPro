// rf21-25.spec.ts (Jest) => funciones PURAS de los RF 21-25: diseñador y clics de correo (21.5/21.6), prueba A/B (21.4),
// inteligencia de clientes (22.x), compras y valorización (23.x), auditoría QR (23.7) y analítica (24.x).
import { renderBlocks, signLink, trackLinks, verifyLink, withUtm } from "../../src/module/email/util/blocks.util";
import { chooseWinner, splitAudience } from "../../src/module/marketing/model/ab-test.model";
import { cohortMatrix, detectAnomalies, nextBestAction, parseCustomerCsv, projectedClv, type CustomerSignals } from "../../src/module/crm/model/insight.model";
import { daysUntilBirthday } from "../../src/module/crm/service/insight.service";
import { averageValuation, canTransition, fifoValuation, payableState, poNumber, supplierScore } from "../../src/module/supplier/model/procurement.model";
import { discrepancies, parseCode } from "../../src/module/inventory/service/audit.service";
import { attribute, breaches, mergeCredit } from "../../src/module/analytics/model/attribution.model";
import { toCsv } from "../../src/module/analytics/service/advanced.service";

describe("RF-21 correo y marketing", () => {
  it("bloques -> HTML escapando texto pero conservando variables", () => {
    const html = renderBlocks([{ type: "heading", text: "Hola {{ firstName }} <b>", align: "left" }, { type: "button", label: "Comprar", href: "https://tienda.co", color: "#000000" }]);
    expect(html).toContain("Hola {{ firstName }} &lt;b&gt;");
    expect(html).toContain('href="https://tienda.co"');
  });

  it("enlaces firmados con UTM: solo la firma correcta redirige", () => {
    const html = trackLinks('<a href="https://tienda.co/p?x=1">ver</a>', "log1", "camp1", "https://api", "secreto-de-prueba-123");
    const target = withUtm("https://tienda.co/p?x=1", "camp1");
    expect(target).toContain("utm_campaign=camp1");
    expect(html).toContain(encodeURIComponent(target));
    expect(verifyLink("secreto-de-prueba-123", "log1", target, signLink("secreto-de-prueba-123", "log1", target))).toBe(true);
    expect(verifyLink("secreto-de-prueba-123", "log1", "https://malo.com", signLink("secreto-de-prueba-123", "log1", target))).toBe(false);
  });

  it("A/B: grupos iguales sin repetir y gana la mejor tasa", () => {
    const { groupA, groupB } = splitAudience(Array.from({ length: 100 }, (_, i) => i), 20, () => 0.5);
    expect(groupA).toHaveLength(10);
    expect(groupB).toHaveLength(10);
    expect(new Set([...groupA, ...groupB]).size).toBe(20);
    expect(chooseWinner({ A: { sent: 10, opened: 2, clicked: 1 }, B: { sent: 10, opened: 5, clicked: 0 } }, "OPEN")).toBe("B");
    expect(chooseWinner({ A: { sent: 10, opened: 2, clicked: 1 }, B: { sent: 10, opened: 5, clicked: 0 } }, "CLICK")).toBe("A");
  });
});

describe("RF-22 CRM", () => {
  const base: CustomerSignals = { segment: "REGULAR", orders: 3, churnRisk: "LOW", activeCartItems: 0, expiringPoints: 0, birthdayInDays: null, wishlistOnSale: 0, marketingOptIn: true };
  it("siguiente mejor acción por prioridad", () => {
    expect(nextBestAction({ ...base, churnRisk: "HIGH", activeCartItems: 2 })).toBe("WINBACK_COUPON");
    expect(nextBestAction({ ...base, activeCartItems: 2 })).toBe("CART_REMINDER");
    expect(nextBestAction({ ...base, orders: 1 })).toBe("SECOND_PURCHASE");
    expect(nextBestAction({ ...base, marketingOptIn: false })).toBe("MARKETING_CONSENT");
  });

  it("anomalías: pico de gasto, devoluciones y pagos fallidos", () => {
    expect(detectAnomalies({ monthlySpendCents: [100, 120, 110, 105, 2000], orders: 10, refunds: 1, failedPayments7d: 0 })).toEqual(["SPEND_SPIKE"]);
    expect(detectAnomalies({ monthlySpendCents: [0], orders: 4, refunds: 2, failedPayments7d: 3 })).toEqual(["HIGH_REFUND_RATE", "PAYMENT_FAILURES"]);
  });

  it("CSV con comillas, etiquetas y errores por línea", () => {
    const { rows, errors } = parseCustomerCsv('email,firstName,lastName,phone,tags\nana@x.co,"Ana, María",Pérez,300,vip|bogota\nmal,Juan,,,');
    expect(rows[0]).toMatchObject({ email: "ana@x.co", firstName: "Ana, María", tags: ["vip", "bogota"] });
    expect(errors).toHaveLength(1);
  });

  it("cohortes, CLV y cumpleaños", () => {
    const matrix = cohortMatrix([{ cohort: "2026-01", offset: 0, customers: 10 }, { cohort: "2026-01", offset: 2, customers: 3 }], new Map([["2026-01", 10]]));
    expect(matrix[0]?.retention).toEqual([1, 0, 0.3]);
    expect(projectedClv(1, 50_000, new Date(), new Date())).toBe(50_000);
    expect(daysUntilBirthday(new Date("2000-03-10T00:00:00Z"), new Date(2026, 2, 8))).toBe(2);
  });
});

describe("RF-23 compras e inventario", () => {
  const layers = [
    { quantity: 10, unitCostCents: 100, createdAt: new Date("2026-01-01") },
    { quantity: 10, unitCostCents: 200, createdAt: new Date("2026-02-01") },
  ];
  it("valorización promedio y FIFO", () => {
    expect(averageValuation(layers, 5)).toEqual({ valueCents: 750, unitCostCents: 150, unvaluedUnits: 0 });
    expect(fifoValuation(layers, 15)).toEqual({ valueCents: 2500, unitCostCents: 167, unvaluedUnits: 0 }); // 10x200 + 5x100
    expect(fifoValuation(layers, 25).unvaluedUnits).toBe(5);
  });

  it("estados de la orden, consecutivo, ranking y cuentas por pagar", () => {
    expect(canTransition("DRAFT", "SENT")).toBe(true);
    expect(canTransition("RECEIVED", "CANCELLED")).toBe(false);
    expect(poNumber(2026, 42)).toBe("OC-2026-000042");
    const good = supplierScore({ supplierId: "a", orders: 10, onTime: 10, received: 100, rejected: 0, rating: 5, priceIndex: 0.8 });
    const bad = supplierScore({ supplierId: "b", orders: 10, onTime: 2, received: 50, rejected: 50, rating: 2, priceIndex: 1.2 });
    expect(good).toBe(100);
    expect(bad).toBeLessThan(good);
    const now = new Date("2026-10-10");
    expect(payableState(new Date("2026-10-12"), null, now)).toBe("DUE_SOON");
    expect(payableState(new Date("2026-10-01"), null, now)).toBe("OVERDUE");
    expect(payableState(new Date("2026-10-01"), now, now)).toBe("PAID");
  });

  it("auditoría QR: código y diferencias", () => {
    expect(parseCode("SKU:abc-1")).toBe("ABC-1");
    expect(discrepancies([{ variantId: "v1", sku: "A", counted: 8 }, { variantId: "v2", sku: "B", counted: 3 }], new Map([["v1", 10], ["v2", 3]]))).toEqual([{ variantId: "v1", sku: "A", counted: 8, system: 10, difference: -2 }]);
  });
});

describe("RF-24 analítica", () => {
  const at = new Date("2026-10-10T12:00:00Z");
  const points = [
    { channel: "instagram", at: new Date("2026-10-01T12:00:00Z") },
    { channel: "email", at: new Date("2026-10-05T12:00:00Z") },
    { channel: "google", at: new Date("2026-10-09T12:00:00Z") },
  ];
  it("modelos de atribución", () => {
    expect(attribute(points, 100, "FIRST_CLICK", at)).toEqual({ instagram: 100, email: 0, google: 0 });
    expect(attribute(points, 100, "LAST_CLICK", at)["google"]).toBe(100);
    expect(attribute(points, 90, "LINEAR", at)["email"]).toBeCloseTo(30);
    expect(attribute(points, 100, "POSITION_BASED", at)).toEqual({ instagram: 40, email: 20, google: 40 });
    const decay = attribute(points, 100, "TIME_DECAY", at);
    expect(decay["google"]!).toBeGreaterThan(decay["instagram"]!);
    expect(attribute([], 50, "LINEAR", at)).toEqual({ direct: 50 });
    expect(mergeCredit([{ a: 30 }, { a: 10, b: 60 }])[0]).toEqual({ channel: "b", value: 60, share: 0.6 });
  });

  it("alertas y CSV", () => {
    expect(breaches(5, "LT", 10)).toBe(true);
    expect(breaches(5, "GT", 10)).toBe(false);
    expect(toCsv([{ a: 'x,"y"', b: 2 }])).toBe('a,b\n"x,""y""",2');
  });
});
