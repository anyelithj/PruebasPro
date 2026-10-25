// coupon.model.ts => cálculo de descuentos con el patrón STRATEGY (una estrategia por DiscountType).
// OCP: un tipo nuevo ("BUY_X_GET_Y") = una estrategia nueva en el mapa, sin tocar el código que la usa.
// Funciones puras: mismo input => mismo output (testeables sin base de datos).
import type { DiscountType, LoyaltyTier } from "@prisma/client";

export interface CouponRules {
  type: DiscountType;
  value: number;
  minOrderCents: number;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usedCount: number;
  usagePerUser: number;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  // RF-13.2 alcance (opcional en el tipo: cupones antiguos y pruebas sin restricciones siguen funcionando)
  productIds?: string[];
  categoryIds?: string[];
  brandIds?: string[];
  userIds?: string[];
  segments?: LoyaltyTier[];
}

// CouponContext => RF-13.2 datos del comprador y del carrito para evaluar el alcance
export interface CouponContext {
  userId: string;
  tier: LoyaltyTier | null;
  // Subtotal de los productos dentro del alcance del cupón (undefined = sin líneas: se usa el subtotal completo)
  eligibleSubtotalCents?: number | undefined;
}

// isScoped => el cupón limita productos, categorías o marcas
export const isScoped = (rules: Pick<CouponRules, "productIds" | "categoryIds" | "brandIds">) => Boolean(rules.productIds?.length || rules.categoryIds?.length || rules.brandIds?.length);

// eligibleSubtotal => suma de las líneas que caen en el alcance del cupón (función pura)
export function eligibleSubtotal(
  rules: Pick<CouponRules, "productIds" | "categoryIds" | "brandIds">,
  lines: ReadonlyArray<{ productId: string; categoryId: string | null; brandId: string | null; unitPriceCents: number; quantity: number }>
): number {
  return lines
    .filter((line) => !isScoped(rules) || rules.productIds?.includes(line.productId) || (line.categoryId !== null && rules.categoryIds?.includes(line.categoryId)) || (line.brandId !== null && rules.brandIds?.includes(line.brandId)))
    .reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

export interface DiscountResult {
  discountCents: number; // Descuento sobre el subtotal de productos
  freeShipping: boolean; // El envío queda en 0
}

// "type DiscountStrategy" => firma común de todas las estrategias
type DiscountStrategy = (rules: CouponRules, subtotalCents: number) => DiscountResult;

const strategies: Record<DiscountType, DiscountStrategy> = {
  // Porcentaje con tope opcional ("10% hasta $50.000"); Math.floor => nunca se regala una fracción de centavo
  PERCENTAGE: (rules, subtotal) => {
    const raw = Math.floor((subtotal * rules.value) / 100);
    return { discountCents: rules.maxDiscountCents === null ? raw : Math.min(raw, rules.maxDiscountCents), freeShipping: false };
  },
  // Monto fijo, nunca mayor al subtotal (el total no puede ser negativo)
  FIXED_AMOUNT: (rules, subtotal) => ({ discountCents: Math.min(rules.value, subtotal), freeShipping: false }),
  FREE_SHIPPING: () => ({ discountCents: 0, freeShipping: true }),
};

// Motivos de rechazo (códigos estables para i18n en el frontend)
export type CouponRejection = "INACTIVE" | "NOT_STARTED" | "EXPIRED" | "USAGE_LIMIT_REACHED" | "USER_LIMIT_REACHED" | "MIN_ORDER_NOT_MET" | "NOT_ELIGIBLE" | "NO_ELIGIBLE_ITEMS";

// evaluateCoupon => aplica las reglas de elegibilidad y luego la estrategia correspondiente
// Resultado como unión discriminada por "valid" (patrón Result: sin excepciones para un caso de negocio esperado)
export function evaluateCoupon(
  rules: CouponRules,
  subtotalCents: number,
  userRedemptions: number,
  now: Date = new Date(),
  context?: CouponContext
): ({ valid: true } & DiscountResult) | { valid: false; reason: CouponRejection } {
  if (!rules.isActive) return { valid: false, reason: "INACTIVE" };
  if (rules.startsAt > now) return { valid: false, reason: "NOT_STARTED" };
  if (rules.endsAt && rules.endsAt < now) return { valid: false, reason: "EXPIRED" };
  if (rules.usageLimit !== null && rules.usedCount >= rules.usageLimit) return { valid: false, reason: "USAGE_LIMIT_REACHED" };
  if (userRedemptions >= rules.usagePerUser) return { valid: false, reason: "USER_LIMIT_REACHED" };
  if (subtotalCents < rules.minOrderCents) return { valid: false, reason: "MIN_ORDER_NOT_MET" };
  // RF-13.2 cupón personal (clientes) o por segmento (nivel de fidelidad)
  if (context && rules.userIds?.length && !rules.userIds.includes(context.userId)) return { valid: false, reason: "NOT_ELIGIBLE" };
  if (context && rules.segments?.length && (!context.tier || !rules.segments.includes(context.tier))) return { valid: false, reason: "NOT_ELIGIBLE" };
  // Con alcance de productos: el descuento se calcula SOLO sobre las líneas elegibles
  const base = isScoped(rules) && context?.eligibleSubtotalCents !== undefined ? context.eligibleSubtotalCents : subtotalCents;
  if (base <= 0) return { valid: false, reason: "NO_ELIGIBLE_ITEMS" };
  return { valid: true, ...strategies[rules.type](rules, base) };
}

// Mensajes legibles por motivo (la UI puede usarlos directamente o traducir por código)
export const COUPON_REJECTION_MESSAGES: Record<CouponRejection, string> = {
  INACTIVE: "El cupón no está activo",
  NOT_STARTED: "El cupón aún no está vigente",
  EXPIRED: "El cupón expiró",
  USAGE_LIMIT_REACHED: "El cupón alcanzó su límite de usos",
  USER_LIMIT_REACHED: "Ya usaste este cupón el máximo de veces permitido",
  MIN_ORDER_NOT_MET: "El pedido no alcanza el monto mínimo del cupón",
  NOT_ELIGIBLE: "Este cupón no está disponible para tu cuenta",
  NO_ELIGIBLE_ITEMS: "Ningún producto del carrito participa en este cupón",
};
