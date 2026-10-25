// loyalty.schema.ts => validación Zod del módulo Loyalty.
import { z } from "zod";

// AdjustPointsSchema => PATCH /api/v1/loyalty/:id/point (body: { delta, operation: ADD|SUBTRACT, reason })
export const AdjustPointsSchema = z.object({
  delta: z.number().int().positive().max(1_000_000),
  operation: z.enum(["ADD", "SUBTRACT"]),
  reason: z.string().trim().min(3).max(200),
});

// MintBadgeSchema => POST /api/v1/loyalty/:id/badge/mint (nivel a certificar; por defecto el actual)
export const MintBadgeSchema = z.object({ tier: z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"]).optional() });

// ShareSchema => POST /api/v1/loyalty/me/share (RF-14.1 puntos por compartir un producto en redes)
export const ShareSchema = z.object({ productId: z.string().uuid(), network: z.enum(["facebook", "instagram", "x", "whatsapp", "tiktok", "pinterest"]) });

// PersonalShopperSchema => POST /api/v1/loyalty/me/personal-shopper (RF-14.4 beneficio de Platino)
export const PersonalShopperSchema = z.object({ message: z.string().trim().min(10).max(1000) });

// TransferBadgeSchema => POST /api/v1/loyalty/:id/badge/:badgeId/transfer (RF-14.8 registra una transferencia firmada
// por el dueño en su wallet)
export const TransferBadgeSchema = z.object({
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Dirección de wallet inválida" }),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, { message: "Hash de transacción inválido" }),
});

// MultiplierSchema => POST /api/v1/loyalty/multiplier (RF-14.9 evento con puntos multiplicados)
export const MultiplierSchema = z
  .object({ name: z.string().trim().min(3).max(120), multiplier: z.number().min(1.1).max(10), startsAt: z.coerce.date(), endsAt: z.coerce.date(), isActive: z.boolean().default(true) })
  .refine((value) => value.endsAt > value.startsAt, { message: "El fin debe ser posterior al inicio", path: ["endsAt"] });
export const UpdateMultiplierSchema = z.object({ isActive: z.boolean() });

export const RankingQuerySchema = z.object({ limit: z.coerce.number().int().min(3).max(50).default(10) });

export type AdjustPointsInput = z.infer<typeof AdjustPointsSchema>;
