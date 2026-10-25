// coupon.dto.ts => contratos de salida del módulo Coupon.
import type { CouponRejection } from "../model/coupon.model";

export interface CouponDto {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING";
  value: number;
  minOrderCents: number;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usagePerUser: number;
  usedCount: number;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
  userIds: string[];
  segments: Array<"BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "PLATINUM">;
  origin: string; // MANUAL | WELCOME | BIRTHDAY | STORE_CREDIT
}

// CouponMetricsDto => "listar cupones activos con métricas"
export interface CouponWithMetricsDto extends CouponDto {
  redemptions: number;
  totalDiscountCents: number; // Costo acumulado del cupón para el negocio
}

// CouponValidationDto => respuesta de POST /coupon/validate (unión discriminada por "valid")
export type CouponValidationDto =
  | { valid: true; couponId: string; code: string; discountCents: number; freeShipping: boolean }
  | { valid: false; code: string; reason: CouponRejection; message: string };
