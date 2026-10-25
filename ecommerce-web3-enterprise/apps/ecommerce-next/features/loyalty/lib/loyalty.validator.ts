// loyalty.validator.ts => niveles para la UI (espejo de los umbrales del backend: loyalty.model.ts).
// Nombre y beneficios de cada nivel se traducen: messages/*.json -> loyalty.tiers / loyalty.perks
import type { LoyaltyTier } from "@/entities/user/model/user.types";

export const TIERS: ReadonlyArray<{ tier: LoyaltyTier; minPoints: number }> = [
  { tier: "BRONZE", minPoints: 0 },
  { tier: "SILVER", minPoints: 1_000 },
  { tier: "GOLD", minPoints: 5_000 },
  { tier: "DIAMOND", minPoints: 10_000 }, // RF-14.2
  { tier: "PLATINUM", minPoints: 20_000 },
];
