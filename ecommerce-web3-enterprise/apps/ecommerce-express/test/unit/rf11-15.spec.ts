// rf11-15.spec.ts (Jest) => funciones PURAS de los RF 11-15: promociones (2x1, escalonado, combinación con prioridad,
// fechas de Black Friday), alcance de cupones, recolección de devoluciones, niveles/logros de fidelidad y emociones.
import { applyPromotions, seasonalDates, type PromotionLine, type PromotionRule } from "../../src/module/coupon/model/promotion.model";
import { eligibleSubtotal, evaluateCoupon, type CouponRules } from "../../src/module/coupon/model/coupon.model";
import { nextBusinessDay } from "../../src/module/refund/model/refund.model";
import { maskName, newAchievements, TIER_BENEFITS, tierFor } from "../../src/module/loyalty/model/loyalty.model";
import { LexiconSentimentAnalyzer } from "../../src/module/review/model/review.model";

const line = (variantId: string, price: number, quantity: number, extra: Partial<PromotionLine> = {}): PromotionLine => ({
  variantId, productId: `p-${variantId}`, categoryId: "cat", brandId: "brand", collectionIds: [], unitPriceCents: price, quantity, ...extra,
});
const rule = (overrides: Partial<PromotionRule>): PromotionRule => ({
  id: "r", name: "Regla", type: "PERCENT_OFF", buyQuantity: null, payQuantity: null, percent: null, tiers: null,
  productIds: [], categoryIds: [], brandIds: [], collectionIds: [], priority: 0, stackable: false, ...overrides,
});

describe("RF-13 promociones automáticas", () => {
  it("3x2 regala la unidad más barata de cada grupo de 3", () => {
    const result = applyPromotions([line("a", 300, 2), line("b", 100, 1)], [rule({ id: "3x2", type: "BUY_X_PAY_Y", buyQuantity: 3, payQuantity: 2 })]);
    expect(result.discountCents).toBe(100);
  });

  it("escalonado: aplica el tramo más alto alcanzado", () => {
    const tiers = [{ minQty: 2, percent: 10 }, { minQty: 4, percent: 20 }];
    expect(applyPromotions([line("a", 1000, 4)], [rule({ type: "TIERED", tiers })]).discountCents).toBe(800);
    expect(applyPromotions([line("a", 1000, 3)], [rule({ type: "TIERED", tiers })]).discountCents).toBe(300);
  });

  it("prioridad + combinabilidad: una no combinable no descuenta unidades ya descontadas", () => {
    const lines = [line("a", 1000, 2)];
    const exclusive = rule({ id: "x", type: "PERCENT_OFF", percent: 50, priority: 10 });
    const other = rule({ id: "y", type: "PERCENT_OFF", percent: 10, priority: 1 });
    const result = applyPromotions(lines, [other, exclusive]);
    expect(result.applied.map((entry) => entry.promotionId)).toEqual(["x"]);
    expect(result.discountCents).toBe(1000);
    // Dos combinables se suman sobre las mismas unidades
    const stacked = applyPromotions(lines, [rule({ id: "s1", percent: 10, stackable: true }), rule({ id: "s2", percent: 5, stackable: true })]);
    expect(stacked.discountCents).toBe(300);
  });

  it("respeta el alcance por marca", () => {
    const result = applyPromotions([line("a", 1000, 1, { brandId: "nike" }), line("b", 1000, 1, { brandId: "otra" })], [rule({ percent: 20, brandIds: ["nike"] })]);
    expect(result.discountCents).toBe(200);
  });

  it("Black Friday 2026 = 27 de noviembre y Cyber Monday = 30 de noviembre (hora Colombia)", () => {
    const { blackFriday, cyberMonday } = seasonalDates(2026);
    expect(blackFriday.startsAt.toISOString()).toBe("2026-11-27T05:00:00.000Z");
    expect(cyberMonday.startsAt.toISOString()).toBe("2026-11-30T05:00:00.000Z");
  });
});

describe("RF-13.2 alcance de cupones", () => {
  const base: CouponRules = { type: "PERCENTAGE", value: 10, minOrderCents: 0, maxDiscountCents: null, usageLimit: null, usedCount: 0, usagePerUser: 1, startsAt: new Date(0), endsAt: null, isActive: true };

  it("descuenta solo sobre los productos de la categoría", () => {
    const rules = { ...base, categoryIds: ["shoes"] };
    const eligible = eligibleSubtotal(rules, [{ productId: "1", categoryId: "shoes", brandId: null, unitPriceCents: 1000, quantity: 1 }, { productId: "2", categoryId: "shirts", brandId: null, unitPriceCents: 5000, quantity: 1 }]);
    const result = evaluateCoupon(rules, 6000, 0, new Date(), { userId: "u", tier: null, eligibleSubtotalCents: eligible });
    expect(result).toEqual({ valid: true, discountCents: 100, freeShipping: false });
  });

  it("cupón personal y por segmento", () => {
    expect(evaluateCoupon({ ...base, userIds: ["otro"] }, 1000, 0, new Date(), { userId: "u", tier: null })).toEqual({ valid: false, reason: "NOT_ELIGIBLE" });
    expect(evaluateCoupon({ ...base, segments: ["GOLD"] }, 1000, 0, new Date(), { userId: "u", tier: "GOLD" }).valid).toBe(true);
  });
});

describe("RF-12 / RF-14 / RF-15 reglas puras", () => {
  it("la recolección salta el fin de semana", () => {
    expect(nextBusinessDay(new Date("2026-10-09T15:00:00Z")).toISOString()).toBe("2026-10-12T14:00:00.000Z"); // Viernes -> lunes
  });

  it("nivel Diamante entre Oro y Platino, con sus beneficios", () => {
    expect(tierFor(12_000)).toBe("DIAMOND");
    expect(TIER_BENEFITS.DIAMOND).toMatchObject({ freeShipping: true, preSale: true, personalShopper: false });
  });

  it("logros nuevos y nombre enmascarado del ranking", () => {
    const fresh = newAchievements({ orders: 5, reviews: 1, photoReviews: 0, referrals: 0, shares: 0, tier: "SILVER" }, new Set(["FIRST_ORDER"]));
    expect(fresh.map((entry) => entry.code)).toEqual(["FIVE_ORDERS", "FIRST_REVIEW"]);
    expect(maskName("Carlos", "Cliente")).toBe("Carlos C.");
  });

  it("emociones y etiqueta mixta", () => {
    const analyzer = new LexiconSentimentAnalyzer();
    const mixed = analyzer.analyze("Excelente calidad pero el envío llegó tarde y fue malo");
    expect(mixed.label).toBe("MIXED");
    expect(mixed.emotions.frustration).toBeGreaterThan(0);
    expect(analyzer.analyze("Me encanta, estoy feliz").label).toBe("POSITIVE");
  });
});
