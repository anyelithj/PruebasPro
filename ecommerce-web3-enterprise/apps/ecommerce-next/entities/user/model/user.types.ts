// user.types.ts (entities) => perfil, direcciones y fidelidad del usuario (forma JSON de la API).

export interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  phoneVerified: boolean; // RF-01.1: celular confirmado con el código SMS
  birthDate: string | null; // RF-13.3 / RF-14.1 "YYYY-MM-DD"
  isActive: boolean;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  walletAddress: string | null;
  locale: "es" | "en"; // Idioma preferido: emails y notificaciones del backend
  roles: string[];
  addresses: Address[];
  createdAt: string;
}

export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "PLATINUM"; // RF-14.2 Diamante

export interface LoyaltyAccount {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  nextTier: { tier: LoyaltyTier; pointsNeeded: number } | null;
  expiringSoon: number;
  recentTransactions: Array<{ id: string; operation: "ADD" | "SUBTRACT"; points: number; reason: string; orderId: string | null; expiresAt: string | null; createdAt: string }>;
  benefits: { extraDiscountPercent: number; freeShipping: boolean; preSale: boolean; personalShopper: boolean }; // RF-14.4
  activeMultiplier: { name: string; multiplier: number; endsAt: string } | null; // RF-14.9
}

export interface NftBadge {
  id: string;
  tier: LoyaltyTier;
  name: string;
  imageUrl: string;
  metadataUri: string | null;
  metadataUrl: string | null;
  ownerAddress?: string | null; // RF-14.8 wallet dueña actual (tras transferir)
  contractAddress: string | null;
  tokenId: string | null;
  txHash: string | null;
  status: "PENDING" | "MINTED" | "FAILED";
  mintedAt: string | null;
}
