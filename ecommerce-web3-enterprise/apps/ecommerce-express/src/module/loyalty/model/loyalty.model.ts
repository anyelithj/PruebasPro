// loyalty.model.ts => reglas del programa de fidelidad (funciones puras): niveles, puntos por compra y consumo FIFO.
import type { LoyaltyTier } from "@prisma/client";
import type { AchievementCode } from "../../../shared/constants/messages.constants";

// Umbrales de nivel por puntos HISTÓRICOS (lifetimePoints): canjear puntos no hace bajar de nivel
export const TIER_THRESHOLDS: ReadonlyArray<{ tier: LoyaltyTier; minLifetime: number }> = [
  { tier: "PLATINUM", minLifetime: 20_000 },
  { tier: "DIAMOND", minLifetime: 10_000 }, // RF-14.2
  { tier: "GOLD", minLifetime: 5_000 },
  { tier: "SILVER", minLifetime: 1_000 },
  { tier: "BRONZE", minLifetime: 0 },
];

// Orden de los niveles (para comparar "mayor que")
const TIER_ORDER: Record<LoyaltyTier, number> = { BRONZE: 0, SILVER: 1, GOLD: 2, DIAMOND: 3, PLATINUM: 4 };

export const POINTS_VALIDITY_MONTHS = 12;

// tierFor => primer umbral que cumple (la lista va de mayor a menor)
export function tierFor(lifetimePoints: number): LoyaltyTier {
  return TIER_THRESHOLDS.find((threshold) => lifetimePoints >= threshold.minLifetime)?.tier ?? "BRONZE";
}

export function isHigherTier(a: LoyaltyTier, b: LoyaltyTier): boolean {
  return TIER_ORDER[a] > TIER_ORDER[b];
}

// nextTier => cuánto falta para el siguiente nivel (null si ya es PLATINUM)
export function nextTier(lifetimePoints: number): { tier: LoyaltyTier; pointsNeeded: number } | null {
  // Umbrales en orden ascendente; el primero que aún no se alcanza es el siguiente
  const next = [...TIER_THRESHOLDS].reverse().find((threshold) => threshold.minLifetime > lifetimePoints);
  return next ? { tier: next.tier, pointsNeeded: next.minLifetime - lifetimePoints } : null;
}

// maxRedeemablePoints => RF-07.3/08.7 puntos canjeables en una compra: el saldo, sin superar el tope porcentual del
// monto a pagar (el resto se paga con otro medio). Función pura: misma regla en el carrito y en el checkout (DRY)
export function maxRedeemablePoints(balance: number, payableCents: number, pointValueCents: number, maxPercent: number): number {
  return Math.max(0, Math.min(balance, Math.floor((payableCents * maxPercent) / 100 / pointValueCents)));
}

// pointsForAmount => puntos ganados por un monto (redondeo hacia abajo: no se regalan fracciones)
export function pointsForAmount(amountCents: number, centsPerPoint: number): number {
  return Math.floor(amountCents / centsPerPoint);
}

// planFifoConsumption => qué lotes consumir para restar "points" (primero los que vencen antes: FIFO por vencimiento)
export function planFifoConsumption(
  lots: Array<{ id: string; remaining: number }>,
  points: number
): { consumptions: Array<{ id: string; take: number }>; covered: number } {
  const consumptions: Array<{ id: string; take: number }> = [];
  let pending = points;
  for (const lot of lots) {
    if (pending === 0) break;
    const take = Math.min(lot.remaining, pending);
    if (take > 0) consumptions.push({ id: lot.id, take });
    pending -= take;
  }
  return { consumptions, covered: points - pending };
}

// TierBenefits / TIER_BENEFITS => RF-14.4 beneficios exclusivos por nivel (tabla de datos: cambiar un beneficio = una
// línea). Los aplica el checkout (descuento adicional y envío gratis) y el carrito (preventa)
export interface TierBenefits {
  extraDiscountPercent: number; // Descuento adicional sobre los productos
  freeShipping: boolean; // Envío gratis permanente
  preSale: boolean; // Acceso a preventa (productos con preSaleUntil futuro)
  personalShopper: boolean; // Asesoría personalizada
}
export const TIER_BENEFITS: Record<LoyaltyTier, TierBenefits> = {
  BRONZE: { extraDiscountPercent: 0, freeShipping: false, preSale: false, personalShopper: false },
  SILVER: { extraDiscountPercent: 2, freeShipping: false, preSale: false, personalShopper: false },
  GOLD: { extraDiscountPercent: 5, freeShipping: true, preSale: false, personalShopper: false },
  DIAMOND: { extraDiscountPercent: 7, freeShipping: true, preSale: true, personalShopper: false },
  PLATINUM: { extraDiscountPercent: 10, freeShipping: true, preSale: true, personalShopper: true },
};

// ACTION_POINTS => RF-14.1 puntos por acciones (además de las compras)
export const ACTION_POINTS = { SIGNUP: 100, REVIEW_PHOTO: 50, SOCIAL_SHARE: 10, REFERRAL: 500, BIRTHDAY: 200 } as const;
export type PointsAction = keyof typeof ACTION_POINTS;

// AchievementStats / ACHIEVEMENTS => RF-14.9 logros: cada uno es una condición sobre las estadísticas del cliente
// y otorga puntos al desbloquearse (Data-Driven: un logro nuevo = una fila)
export interface AchievementStats {
  orders: number; // Pedidos entregados
  reviews: number;
  photoReviews: number;
  referrals: number;
  shares: number;
  tier: LoyaltyTier;
}
export const ACHIEVEMENTS: ReadonlyArray<{ code: AchievementCode; points: number; unlocked: (stats: AchievementStats) => boolean }> = [
  { code: "FIRST_ORDER", points: 50, unlocked: (s) => s.orders >= 1 },
  { code: "FIVE_ORDERS", points: 150, unlocked: (s) => s.orders >= 5 },
  { code: "TEN_ORDERS", points: 400, unlocked: (s) => s.orders >= 10 },
  { code: "FIRST_REVIEW", points: 30, unlocked: (s) => s.reviews >= 1 },
  { code: "PHOTO_REVIEWER", points: 50, unlocked: (s) => s.photoReviews >= 1 },
  { code: "FIRST_REFERRAL", points: 100, unlocked: (s) => s.referrals >= 1 },
  { code: "SOCIAL_SHARER", points: 20, unlocked: (s) => s.shares >= 3 },
  { code: "GOLD_MEMBER", points: 200, unlocked: (s) => TIER_ORDER[s.tier] >= TIER_ORDER.GOLD },
];

// newAchievements => logros que se cumplen y aún no están desbloqueados (función pura)
export function newAchievements(stats: AchievementStats, unlocked: ReadonlySet<string>): typeof ACHIEVEMENTS {
  return ACHIEVEMENTS.filter((achievement) => !unlocked.has(achievement.code) && achievement.unlocked(stats));
}

// applyMultiplier => RF-14.9 puntos de un evento especial (multiplicador temporal); redondeo hacia abajo
export const applyMultiplier = (points: number, multiplier: number): number => Math.floor(points * Math.max(1, multiplier));

// maskName => RF-14.5 ranking público sin exponer datos personales: "Carlos Cliente" -> "Carlos C."
export function maskName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim().charAt(0).toUpperCase()}.`.trim();
}
