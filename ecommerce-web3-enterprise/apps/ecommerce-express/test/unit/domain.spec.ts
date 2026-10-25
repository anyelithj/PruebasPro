// domain.spec.ts (Jest + ts-jest) => pruebas unitarias de las REGLAS DE DOMINIO puras de las fases 1-4.
// Sin base de datos ni red: prueban las funciones puras de los "model" (pirámide de tests: base ancha y rápida).
// Patrón AAA (Arrange-Act-Assert) en cada caso; "describe" agrupa por módulo, "it" describe el comportamiento.
import { evaluateCoupon, type CouponRules } from "../../src/module/coupon/model/coupon.model";
import { computeTotals } from "../../src/module/checkout/model/checkout.model";
import { canBeCancelled, canTransitionOrder, generateOrderNumber } from "../../src/module/order/model/order.model";
import { nextTier, planFifoConsumption, pointsForAmount, tierFor } from "../../src/module/loyalty/model/loyalty.model";
import { canTransitionShipment, quoteAll } from "../../src/module/shipping/model/shipping.model";
import { LexiconSentimentAnalyzer, moderate } from "../../src/module/review/model/review.model";
import { buildBreadcrumb, buildCategoryTree, collectDescendantIds } from "../../src/module/category/model/category.model";
import { computeCufe, escapeXml } from "../../src/module/invoice/model/invoice.model";
import { refundableCents } from "../../src/module/payment/model/payment.model";
import { canRequestRefund } from "../../src/module/refund/model/refund.model";
import { computePriceRange } from "../../src/module/product/model/product.model";

// Cupón base reutilizable: cada test sobreescribe solo lo que necesita (spread)
const baseCoupon: CouponRules = {
  type: "PERCENTAGE",
  value: 10,
  minOrderCents: 0,
  maxDiscountCents: null,
  usageLimit: null,
  usedCount: 0,
  usagePerUser: 1,
  startsAt: new Date("2026-01-01"),
  endsAt: null,
  isActive: true,
};
const NOW = new Date("2026-06-01T12:00:00Z"); // Fecha fija: tests deterministas

describe("Coupon (Strategy por tipo de descuento)", () => {
  it("aplica porcentaje con tope máximo", () => {
    const result = evaluateCoupon({ ...baseCoupon, maxDiscountCents: 5_000 }, 100_000, 0, NOW);
    expect(result).toEqual({ valid: true, discountCents: 5_000, freeShipping: false });
  });

  it("el monto fijo nunca supera el subtotal", () => {
    const result = evaluateCoupon({ ...baseCoupon, type: "FIXED_AMOUNT", value: 50_000 }, 20_000, 0, NOW);
    expect(result).toMatchObject({ valid: true, discountCents: 20_000 });
  });

  it("rechaza por límite por usuario, vencimiento y mínimo de compra", () => {
    expect(evaluateCoupon(baseCoupon, 10_000, 1, NOW)).toEqual({ valid: false, reason: "USER_LIMIT_REACHED" });
    expect(evaluateCoupon({ ...baseCoupon, endsAt: new Date("2026-02-01") }, 10_000, 0, NOW)).toEqual({ valid: false, reason: "EXPIRED" });
    expect(evaluateCoupon({ ...baseCoupon, minOrderCents: 50_000 }, 10_000, 0, NOW)).toEqual({ valid: false, reason: "MIN_ORDER_NOT_MET" });
  });
});

describe("Checkout (totales)", () => {
  it("calcula IVA sobre subtotal menos descuento y suma el envío sin IVA", () => {
    const totals = computeTotals({ subtotalCents: 100_000, discountCents: 10_000, shippingCents: 12_000, taxRate: 0.19 });
    expect(totals).toEqual({ subtotalCents: 100_000, discountCents: 10_000, shippingCents: 12_000, taxCents: 17_100, totalCents: 119_100 });
  });
});

describe("Order (máquina de estados)", () => {
  it("permite solo transiciones válidas", () => {
    expect(canTransitionOrder("CONFIRMED", "PREPARING")).toBe(true);
    expect(canTransitionOrder("CONFIRMED", "DELIVERED")).toBe(false);
    expect(canTransitionOrder("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("solo se cancela antes del envío", () => {
    expect(canBeCancelled("PACKED")).toBe(true);
    expect(canBeCancelled("SHIPPED")).toBe(false);
  });

  it("genera números de orden legibles y únicos", () => {
    const number = generateOrderNumber(NOW);
    expect(number).toMatch(/^ORD-20260601-[A-HJ-NP-Z2-9]{6}$/);
    expect(generateOrderNumber(NOW)).not.toBe(number);
  });
});

describe("Loyalty (niveles y consumo FIFO)", () => {
  it("asigna nivel por puntos históricos y calcula el siguiente", () => {
    expect(tierFor(0)).toBe("BRONZE");
    expect(tierFor(5_000)).toBe("GOLD");
    expect(nextTier(4_000)).toEqual({ tier: "GOLD", pointsNeeded: 1_000 });
    expect(nextTier(25_000)).toBeNull();
  });

  it("consume primero los lotes más antiguos y reporta lo cubierto", () => {
    const plan = planFifoConsumption([{ id: "a", remaining: 30 }, { id: "b", remaining: 50 }], 60);
    expect(plan).toEqual({ consumptions: [{ id: "a", take: 30 }, { id: "b", take: 30 }], covered: 60 });
  });

  it("gana 1 punto por cada $1.000 COP", () => {
    expect(pointsForAmount(10_000_000, 100_000)).toBe(100); // $100.000 => 100 puntos
  });
});

describe("Shipping (Strategy por transportadora)", () => {
  it("cotiza Servientrega en Colombia con envío estándar gratis sobre el umbral", () => {
    const rates = quoteAll({ country: "CO", state: "Antioquia", city: "Medellín", postalCode: "050001" }, 1_500, 40_000_000);
    // RF-10.1 transportadoras configuradas + RF-08.2 recogida en tienda; estándar gratis sobre el umbral
    expect(rates.map((rate) => rate.code)).toEqual(expect.arrayContaining(["SERVIENTREGA_STANDARD", "COORDINADORA_EXPRESS", "DEPRISA_STANDARD", "PICKUP_STORE"]));
    expect(rates.find((rate) => rate.code === "SERVIENTREGA_STANDARD")?.costCents).toBe(0);
  });

  it("cotiza DHL fuera de Colombia y valida transiciones del envío", () => {
    expect(quoteAll({ country: "US", state: "FL", city: "Miami", postalCode: "33101" }, 500, 0)[0]?.code).toBe("DHL_EXPRESS");
    expect(canTransitionShipment("PENDING", "DELIVERED")).toBe(false);
    expect(canTransitionShipment("IN_TRANSIT", "DELIVERED")).toBe(true);
  });
});

describe("Review (sentimiento y moderación)", () => {
  const analyzer = new LexiconSentimentAnalyzer();

  it("detecta sentimiento positivo, negativo y negaciones", () => {
    expect(analyzer.score("Excelente calidad, lo recomiendo")).toBeGreaterThan(0.5);
    expect(analyzer.score("Pésimo, llegó roto")).toBeLessThan(-0.5);
    expect(analyzer.score("No me gusta")).toBeLessThan(0);
  });

  it("envía a revisión reseñas con enlaces o datos de contacto", () => {
    expect(moderate("Compra aquí https://spam.example", 0.5).status).toBe("PENDING");
    expect(moderate("Escríbeme a ana@mail.com", 0.5).status).toBe("PENDING");
    expect(moderate("Muy buena camiseta", 0.6)).toEqual({ status: "APPROVED", note: null });
  });
});

describe("Category (Composite)", () => {
  const flat = [
    { id: "root", name: "Ropa", slug: "ropa", description: null, imageUrl: null, parentId: null, position: 0, isActive: true, productCount: 0 },
    { id: "child", name: "Camisetas", slug: "camisetas", description: null, imageUrl: null, parentId: "root", position: 0, isActive: true, productCount: 3 },
    { id: "leaf", name: "Básicas", slug: "basicas", description: null, imageUrl: null, parentId: "child", position: 0, isActive: true, productCount: 1 },
  ];

  it("arma el árbol, la rama descendiente y el breadcrumb", () => {
    expect(buildCategoryTree(flat)[0]?.children[0]?.children[0]?.id).toBe("leaf");
    expect([...collectDescendantIds(flat, "root")].sort()).toEqual(["child", "leaf", "root"]);
    expect(buildBreadcrumb(flat, "leaf").map((node) => node.slug)).toEqual(["ropa", "camisetas", "basicas"]);
  });
});

describe("Invoice (DIAN)", () => {
  it("calcula un CUFE SHA-384 determinista y escapa XML", () => {
    const input = {
      number: "SETP990000001",
      issuedAt: NOW,
      subtotalCents: 100_000,
      ivaCents: 19_000,
      totalCents: 119_000,
      sellerNit: "900000000",
      buyerDocument: "222222222222",
      technicalKey: "clave",
      environment: "2" as const,
    };
    expect(computeCufe(input)).toMatch(/^[a-f0-9]{96}$/); // SHA-384 = 96 caracteres hex
    expect(computeCufe(input)).toBe(computeCufe(input));
    expect(escapeXml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});

describe("Payment / Refund / Product", () => {
  it("calcula el saldo reembolsable y la ventana de devolución", () => {
    expect(refundableCents({ status: "PARTIALLY_REFUNDED", amountCents: 100, refundedCents: 30 })).toBe(70);
    expect(refundableCents({ status: "PENDING", amountCents: 100, refundedCents: 0 })).toBe(0);
    expect(canRequestRefund({ status: "DELIVERED", deliveredAt: new Date("2026-05-20") }, NOW)).toBe(true);
    expect(canRequestRefund({ status: "DELIVERED", deliveredAt: new Date("2026-03-01") }, NOW)).toBe(false);
  });

  it("desnormaliza el rango de precio solo con variantes activas", () => {
    expect(computePriceRange([{ priceCents: 500, isActive: true }, { priceCents: 100, isActive: false }, { priceCents: 900, isActive: true }])).toEqual({
      minPriceCents: 500,
      maxPriceCents: 900,
    });
  });
});
