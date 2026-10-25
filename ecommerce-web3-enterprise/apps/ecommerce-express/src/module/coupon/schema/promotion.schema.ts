// promotion.schema.ts => validación Zod de las promociones automáticas (RF-13.4/13.7/13.8/13.9/13.10).
// "superRefine" => reglas cruzadas por tipo (2x1 necesita X e Y; porcentaje necesita "percent"; escalonado, tramos).
import { z } from "zod";

const Ids = z.array(z.string().uuid()).max(200).default([]);

const PromotionFields = z.object({
  name: z.string().trim().min(3).max(120),
  type: z.enum(["BUY_X_PAY_Y", "PERCENT_OFF", "TIERED", "FLASH"]),
  buyQuantity: z.number().int().min(2).max(10).nullable().optional(),
  payQuantity: z.number().int().min(1).max(9).nullable().optional(),
  percent: z.number().int().min(1).max(90).nullable().optional(),
  tiers: z.array(z.object({ minQty: z.number().int().min(2).max(100), percent: z.number().int().min(1).max(90) })).max(5).nullable().optional(),
  productIds: Ids,
  categoryIds: Ids,
  brandIds: Ids,
  collectionIds: Ids,
  priority: z.number().int().min(0).max(1000).default(0),
  stackable: z.boolean().default(false),
  campaign: z.string().trim().max(30).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().default(true),
});

// checkPromotion => cada tipo exige sus campos; la vigencia debe ser coherente
type PromotionCheck = {
  type?: string | undefined;
  buyQuantity?: number | null | undefined;
  payQuantity?: number | null | undefined;
  percent?: number | null | undefined;
  tiers?: unknown[] | null | undefined;
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
};
function checkPromotion(value: PromotionCheck, ctx: z.RefinementCtx): void {
  const issue = (message: string, path: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
  if (value.type === "BUY_X_PAY_Y" && !(value.buyQuantity && value.payQuantity && value.payQuantity < value.buyQuantity)) issue("Define lleva X y paga Y (Y menor que X: 2x1, 3x2, 4x3)", "payQuantity");
  if ((value.type === "PERCENT_OFF" || value.type === "FLASH") && !value.percent) issue("Define el porcentaje", "percent");
  if (value.type === "TIERED" && !value.tiers?.length) issue("Define al menos un tramo { minQty, percent }", "tiers");
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) issue("El fin debe ser posterior al inicio", "endsAt");
}

export const PromotionSchema = PromotionFields.superRefine(checkPromotion);
export const UpdatePromotionSchema = PromotionFields.partial().superRefine(checkPromotion);
export const FlashQuerySchema = z.object({ productId: z.string().uuid().optional() });
export const PromotionHistoryQuerySchema = z.object({ orderId: z.string().uuid().optional() });
export const SeasonalSchema = z.object({ year: z.number().int().min(2024).max(2100).optional() });

export type PromotionInput = z.infer<typeof PromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;
