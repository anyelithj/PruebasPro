// coupon.schema.ts => validación Zod del módulo Coupon.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { queryBoolean } from "../../../shared/pipe/transform.pipe";

// Código normalizado: sin espacios y en MAYÚSCULAS ("bienvenida10" == "BIENVENIDA10")
const CouponCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, { message: "Código: 3-30 caracteres A-Z, 0-9, _ o -" });

const CouponFields = z.object({
  code: CouponCode,
  description: z.string().trim().max(300).optional(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  value: z.number().int().min(0),
  minOrderCents: z.number().int().min(0).default(0),
  maxDiscountCents: z.number().int().min(1).nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  usagePerUser: z.number().int().min(1).default(1),
  startsAt: z.coerce.date().default(() => new Date()), // Función: la fecha se calcula en cada request, no al cargar el módulo
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  // RF-13.2 alcance: vacío = sin restricción
  productIds: z.array(z.string().uuid()).max(200).default([]),
  categoryIds: z.array(z.string().uuid()).max(100).default([]),
  brandIds: z.array(z.string().uuid()).max(100).default([]),
  userIds: z.array(z.string().uuid()).max(500).default([]),
  segments: z.array(z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"])).max(5).default([]),
});

// checkRules => reglas cruzadas (porcentaje 1..100, vigencia coherente). "superRefine" agrega issues sin
// cambiar el tipo de salida del schema (conserva los .default() en el tipo inferido)
function checkRules(
  coupon: { type?: string | undefined; value?: number | undefined; startsAt?: Date | undefined; endsAt?: Date | null | undefined },
  ctx: z.RefinementCtx
): void {
  if (coupon.type === "PERCENTAGE" && coupon.value !== undefined && (coupon.value < 1 || coupon.value > 100)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El porcentaje debe estar entre 1 y 100", path: ["value"] });
  }
  if (coupon.endsAt && coupon.startsAt && coupon.endsAt <= coupon.startsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endsAt debe ser posterior a startsAt", path: ["endsAt"] });
  }
}

// CreateCouponSchema => POST /api/v1/coupon ("crear cupón con descuento y vigencia")
export const CreateCouponSchema = CouponFields.superRefine(checkRules);

// UpdateCouponSchema => PATCH parcial ("modificar reglas y/o vigencia"); el código es inmutable (ya se comunicó a clientes)
export const UpdateCouponSchema = CouponFields.omit({ code: true, minOrderCents: true, usagePerUser: true, startsAt: true, isActive: true, productIds: true, categoryIds: true, brandIds: true, userIds: true, segments: true })
  .partial()
  .extend({
    minOrderCents: z.number().int().min(0).optional(),
    usagePerUser: z.number().int().min(1).optional(),
    startsAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
    productIds: z.array(z.string().uuid()).max(200).optional(),
    categoryIds: z.array(z.string().uuid()).max(100).optional(),
    brandIds: z.array(z.string().uuid()).max(100).optional(),
    userIds: z.array(z.string().uuid()).max(500).optional(),
    segments: z.array(z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"])).max(5).optional(),
  })
  .superRefine(checkRules);

// ValidateCouponSchema => POST /api/v1/coupon/validate ("validar código y calcular descuento aplicable")
export const ValidateCouponSchema = z.object({
  code: CouponCode,
  subtotalCents: z.number().int().min(0),
  // RF-13.2 líneas del carrito (opcional): con ellas el descuento se calcula sobre los productos del alcance
  items: z.array(z.object({ productId: z.string().uuid(), unitPriceCents: z.number().int().min(0), quantity: z.number().int().min(1) })).max(100).optional(),
});

export const ListCouponsQuerySchema = PaginationQuerySchema.extend({ active: queryBoolean });

export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponInput = z.infer<typeof UpdateCouponSchema>;
