// rf26-30.spec.ts (Jest) => funciones PURAS de los RF 26-30: búsqueda y etiquetas de medios (26.1), huella del NFT de
// prueba de compra (29.3), claves de idempotencia de la PWA (28.7) y detección de anomalías de auditoría (30.4).
import { normalizeTags, searchExpression } from "../../src/module/media/model/media.model";
import { orderHash } from "../../src/module/order/service/proof-nft.service";
import { idempotencyKey, ownerOf } from "../../src/shared/middleware/idempotency.middleware";
import { detectAnomalies, THRESHOLDS, type AuditEntryLite } from "../../src/module/audit-log/model/anomaly.model";

describe("RF-26 biblioteca de medios", () => {
  it("etiquetas normalizadas: minúsculas, sin vacías ni repetidas", () => {
    expect(normalizeTags([" Verano ", "verano", "", "PROMO"])).toEqual(["verano", "promo"]);
  });

  it("la búsqueda combina carpeta, tipo, etiqueta y texto, sin permitir inyección de sintaxis", () => {
    const expression = searchExpression({ folder: "products", type: "video", tag: "Promo", q: 'zapato") OR (folder:*' });
    expect(expression).toContain("folder:ecommerce-web3/products");
    expect(expression).toContain("resource_type:video");
    expect(expression).toContain('tags="promo"');
    expect(expression).not.toMatch(/"\) OR \(/);
  });
});

describe("RF-29.3 NFT de prueba de compra", () => {
  const order = { orderNumber: "ORD-1", placedAt: new Date("2026-10-01T00:00:00Z"), totalCents: 5000, items: [{ sku: "B", quantity: 1, unitPriceCents: 2000 }, { sku: "A", quantity: 1, unitPriceCents: 3000 }] };
  it("mismo pedido => mismo hash (sin importar el orden de las líneas)", () => {
    expect(orderHash(order)).toBe(orderHash({ ...order, items: [...order.items].reverse() }));
    expect(orderHash(order)).toMatch(/^[a-f0-9]{64}$/);
    expect(orderHash({ ...order, totalCents: 5001 })).not.toBe(orderHash(order));
  });
});

describe("RF-28.7 reintentos sin duplicados", () => {
  it("la clave separa usuario, método y ruta", () => {
    const token = `x.${Buffer.from(JSON.stringify({ sub: "u1" })).toString("base64url")}.y`;
    expect(ownerOf(`Bearer ${token}`)).toBe("u1");
    expect(ownerOf(undefined)).toBe("anon");
    expect(ownerOf("Bearer basura")).toBe("anon");
    expect(idempotencyKey("u1", "POST", "/api/v1/cart", "k")).not.toBe(idempotencyKey("u1", "POST", "/api/v1/review", "k"));
  });
});

describe("RF-30.4 anomalías de auditoría", () => {
  const base: AuditEntryLite = { actorId: null, actorRoles: [], action: "POST /api/v1/auth/login", status: 401, ip: "1.1.1.1", createdAt: new Date("2026-10-01T15:00:00Z") };
  it("fuerza bruta: muchos 401/403 desde la misma IP", () => {
    const anomalies = detectAnomalies(Array.from({ length: THRESHOLDS.bruteForce }, () => base), new Map());
    expect(anomalies.map((a) => a.type)).toEqual(["BRUTE_FORCE"]);
  });

  it("administrador en la madrugada (hora Colombia) y desde una IP nueva", () => {
    // 07:00 UTC = 02:00 en Bogotá
    const admin = { ...base, actorId: "a1", actorRoles: ["ADMIN"], action: "PATCH /api/v1/product/:id", status: 200, ip: "9.9.9.9", createdAt: new Date("2026-10-01T07:00:00Z") };
    const types = detectAnomalies(Array.from({ length: THRESHOLDS.offHoursMin }, () => admin), new Map([["a1", new Set(["2.2.2.2"])]])).map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(["OFF_HOURS_ADMIN", "NEW_IP_ADMIN"]));
  });

  it("actividad normal no genera alertas", () => {
    expect(detectAnomalies([{ ...base, status: 200 }], new Map())).toEqual([]);
  });
});
