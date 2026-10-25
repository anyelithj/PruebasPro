// loyalty.dto.ts => contratos de salida del módulo Loyalty (PointsBalance, LoyaltyTiers, RewardsHistory, NFTBadgeGallery).
import type { BadgeStatus, LoyaltyOperation, LoyaltyTier } from "@prisma/client";
import type { TierBenefits } from "../model/loyalty.model";
import type { AchievementCode } from "../../../shared/constants/messages.constants";

export interface LoyaltyTransactionDto {
  id: string;
  operation: LoyaltyOperation;
  points: number;
  reason: string;
  orderId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// LoyaltyAccountDto => "saldo de puntos y nivel de fidelidad por ID"
export interface LoyaltyAccountDto {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  nextTier: { tier: LoyaltyTier; pointsNeeded: number } | null;
  expiringSoon: number; // Puntos que vencen en los próximos 30 días (urgencia para canjear)
  recentTransactions: LoyaltyTransactionDto[];
  benefits: TierBenefits; // RF-14.4 beneficios del nivel actual
  activeMultiplier: { name: string; multiplier: number; endsAt: Date } | null; // RF-14.9 evento vigente
}

// AchievementDto => RF-14.9 logro con su estado para el usuario
export interface AchievementDto {
  code: AchievementCode;
  name: string;
  points: number;
  unlockedAt: Date | null;
}

// RankingDto => RF-14.5 tabla de posiciones por puntos históricos (nombres enmascarados)
export interface RankingDto {
  top: Array<{ position: number; name: string; tier: LoyaltyTier; lifetimePoints: number }>;
  me: { position: number; lifetimePoints: number } | null;
}

export interface NftBadgeDto {
  id: string;
  tier: LoyaltyTier;
  name: string;
  imageUrl: string;
  metadataUri: string | null;
  // URL http del gateway IPFS para mostrar la metadata en el navegador
  metadataUrl: string | null;
  contractAddress: string | null;
  tokenId: string | null;
  txHash: string | null;
  status: BadgeStatus;
  mintedAt: Date | null;
  ownerAddress: string | null; // RF-14.8 wallet dueña actual
  transferTxHash: string | null;
}
