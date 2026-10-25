// rf01-05.spec.ts (Jest) => funciones PURAS de los RF 01-05: hojas de cálculo CSV/XLSX (RF-04.3), jerarquía de roles
// (RF-03.1), descuento por look completo (RF-05.5), la fila de importación de productos y los KPIs del vendedor. Sin base de datos ni red.
// "jest.mock" (se eleva al inicio) => no se cargan Prisma, Redis ni la caché reales (leen el entorno al importarse)
jest.mock("../../src/config/database.config", () => ({ prisma: {} }));
jest.mock("../../src/config/redis.config", () => ({ redis: {}, RedisKeys: {} }));
jest.mock("../../src/shared/interceptor/cache.interceptor", () => ({ cached: jest.fn(), invalidatePattern: jest.fn() }));

import { parseCsv, parseSpreadsheet, toCsv, toXlsx } from "../../src/shared/util/spreadsheet.util";
import { expandRoleHierarchy } from "../../src/shared/middleware/rbac.middleware";
import { RoleEntity } from "../../src/module/role/model/role.model";
import { lookDiscount } from "../../src/module/collection/model/collection.model";
import { ImportRowSchema } from "../../src/module/product/schema/product.schema";
import { DashboardService } from "../../src/module/dashboard/service/dashboard.service"; // Usa los mocks de arriba

describe("spreadsheet.util (RF-04.3)", () => {
  const headers = ["slug", "name", "price"];
  const rows = [
    { slug: "camiseta", name: 'Camiseta "Génesis", edición; 1', price: 79900 },
    { slug: "tenis", name: "=HYPERLINK(\"x\")", price: 259900.5 }, // Fórmula maliciosa: debe quedar como texto
  ];

  it("CSV: ida y vuelta con comillas, comas, tildes y neutraliza fórmulas", () => {
    const parsed = parseCsv(toCsv(headers, rows).toString("utf8"));
    expect(parsed).toEqual([
      { slug: "camiseta", name: 'Camiseta "Génesis", edición; 1', price: "79900" },
      { slug: "tenis", name: '=HYPERLINK("x")', price: "259900.5" },
    ]);
  });

  it("CSV con separador ';' (Excel en español) y saltos CRLF", () => {
    expect(parseCsv("slug;name\r\na;Uno\r\n\r\nb;Dos")).toEqual([{ slug: "a", name: "Uno" }, { slug: "b", name: "Dos" }]);
  });

  it("XLSX: el archivo generado es un ZIP válido que se vuelve a leer igual", () => {
    const buffer = toXlsx(headers, rows);
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(parseSpreadsheet(buffer)).toEqual(parseCsv(toCsv(headers, rows).toString("utf8")));
  });
});

describe("expandRoleHierarchy (RF-03.1)", () => {
  const all = [
    { id: "1", name: "ADMIN", parentId: null },
    { id: "2", name: "SUPERVISOR", parentId: "3" },
    { id: "3", name: "VENDOR", parentId: null },
    { id: "4", name: "LOOP_A", parentId: "5" },
    { id: "5", name: "LOOP_B", parentId: "4" }, // Ciclo corrupto: no debe colgar
  ];
  it("incluye los ancestros y corta ciclos", () => {
    expect(expandRoleHierarchy(["SUPERVISOR"], all).sort()).toEqual(["SUPERVISOR", "VENDOR"]);
    expect(expandRoleHierarchy(["LOOP_A"], all).sort()).toEqual(["LOOP_A", "LOOP_B"]);
    expect(expandRoleHierarchy(["DESCONOCIDO"], all)).toEqual([]);
  });

  it("RoleEntity.createsCycleWith detecta padre = sí mismo o descendiente", () => {
    const role = new RoleEntity({ id: "3", name: "VENDOR", description: null, parentId: null, parentName: null, permissions: [], createdAt: new Date() });
    expect(role.createsCycleWith("3", [])).toBe(true);
    expect(role.createsCycleWith("2", ["3"])).toBe(true); // SUPERVISOR desciende de VENDOR
    expect(role.createsCycleWith("1", [])).toBe(false);
  });
});

describe("lookDiscount (RF-05.5)", () => {
  const look = { id: "c1", name: "Look urbano", percent: 10, productIds: ["p1", "p2"] };
  it("descuenta solo juegos completos y no reutiliza unidades entre looks", () => {
    const items = [
      { productId: "p1", unitPriceCents: 10_000, quantity: 3 },
      { productId: "p2", unitPriceCents: 5_000, quantity: 2 },
    ];
    const other = { id: "c2", name: "Otro", percent: 5, productIds: ["p1", "p2"] };
    const result = lookDiscount(items, [other, look]);
    // 2 juegos x (10.000 + 5.000) x 10 % = 3.000; el look del 5 % ya no tiene unidades de p2
    expect(result).toEqual({ discountCents: 3_000, applied: [{ collectionId: "c1", name: "Look urbano", sets: 2, discountCents: 3_000 }] });
  });

  it("sin el look completo no hay descuento", () => {
    expect(lookDiscount([{ productId: "p1", unitPriceCents: 10_000, quantity: 1 }], [look]).discountCents).toBe(0);
  });
});

describe("ImportRowSchema (RF-04.3)", () => {
  it("convierte textos de la hoja: precio, atributos, insignias, celdas vacías", () => {
    const row = ImportRowSchema.parse({
      name: "Camiseta", description: "Algodón orgánico peruano", status: "raro", currency: "cop", badges: "new | sale",
      sku: "cam-001", variantName: "Talla M", attributes: "color=Rojo; talla=M", price: "79900", compareAtPrice: "", stock: "", isActive: "no",
    });
    expect(row).toMatchObject({ status: "DRAFT", currency: "COP", badges: ["NEW", "SALE"], sku: "CAM-001", attributes: { color: "Rojo", talla: "M" }, price: 79900, compareAtPrice: null, stock: undefined, isActive: false });
  });
});

describe("DashboardService.listVendorKPIs (panel del vendedor)", () => {
  it("compara el período actual contra el anterior y consulta SIEMPRE con el id del vendedor", async () => {
    const sales = jest.fn().mockResolvedValueOnce({ revenueCents: 300, units: 6, orders: 3 }).mockResolvedValueOnce({ revenueCents: 200, units: 6, orders: 4 });
    const repo = {
      vendorSales: sales,
      countVendorProducts: jest.fn().mockResolvedValue({ DRAFT: 1, ACTIVE: 2, ARCHIVED: 0 }),
      countVendorActiveOrders: jest.fn().mockResolvedValue(5),
      countVendorLowStock: jest.fn().mockResolvedValue(1),
      vendorTopProducts: jest.fn().mockResolvedValue([]),
    };
    const service = new DashboardService(repo as never); // "as never" => fake parcial del repository (solo lo usado)
    const result = await service.listVendorKPIs("vendor-1", { from: new Date("2026-10-01"), to: new Date("2026-10-11"), realtime: false });

    expect(result.kpis.revenueCents).toEqual({ value: 300, previous: 200, change: 0.5 });
    expect(result.kpis.orders.change).toBe(-0.25);
    expect(result.operations).toEqual({ activeOrders: 5, lowStock: 1 });
    // Período anterior = mismos 10 días justo antes del actual
    expect(sales).toHaveBeenNthCalledWith(2, "vendor-1", new Date("2026-09-21"), new Date("2026-10-01"));
    for (const fn of Object.values(repo)) expect(fn.mock.calls.every((call: unknown[]) => call[0] === "vendor-1")).toBe(true);
  });
});
