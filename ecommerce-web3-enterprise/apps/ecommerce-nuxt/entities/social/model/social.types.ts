// social.types.ts (TypeScript estricto) => forma JSON del módulo Social Commerce de Express (social.dto.ts, Fase 6):
// publicaciones multi-red con productos etiquetados, influencers con código de referido y métricas por plataforma.
import type { ProductCard } from "~~/shared/types/common.types";

export type SocialPlatform = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";
export type SocialPostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

export interface Influencer {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SocialMetrics {
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  purchases: number;
}

export interface SocialPost {
  id: string;
  caption: string;
  mediaUrl: string;
  mediaAlt: string;
  platforms: SocialPlatform[];
  status: SocialPostStatus;
  influencer: Influencer | null;
  referralCode: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  error: string | null;
  metrics: SocialMetrics;
  products: ProductCard[];
  createdAt: string;
}

// SocialAnalytic => métricas agregadas por plataforma ("STORE" = feed propio de la tienda)
export interface SocialAnalytic extends SocialMetrics {
  platform: SocialPlatform | "STORE";
  posts: number;
  ctr: number;
}

// InfluencerStats => ranking y comisión calculados en el cliente a partir de las publicaciones (sin endpoint extra)
export interface InfluencerStats extends Influencer {
  posts: number;
  clicks: number;
  purchases: number;
  commissionCents: number;
}

// SocialInsights => RF-15.11 respuesta del motor de FastAPI (/ml/sentiment/insights) vía Express /social/sentiment
export interface SocialInsights {
  summary: { total: number; counts: Record<string, number>; net_sentiment: number };
  negative_causes: Array<{ cause: string; label: string; count: number; share: number; examples: string[] }>;
  conclusion: string;
  items: Array<{ id: string; label: string; score: number; emotions: Record<string, number> }>;
}

// ChannelStatus => RF-19.1 / 19.7 estado de cada canal de catálogo (Meta: FB/IG/Marketplace/WhatsApp; TikTok Shop)
export interface ChannelStatus {
  channel: "META" | "TIKTOK_SHOP";
  configured: boolean;
  listed: number;
  errors: number;
  lastSync: string | null;
}

// LiveSession => RF-19.9 transmisión de Live Shopping con sus productos
export interface LiveSession {
  id: string;
  title: string;
  description: string;
  embedUrl: string;
  streams: Array<{ platform: string; url: string }>;
  productIds: string[];
  pinnedProductId: string | null;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  scheduledAt: string;
  clicks: number;
  products: ProductCard[];
}

// UgcItem => RF-19.11 foto/video de un cliente con el producto (solo los aprobados son públicos)
export interface UgcItem {
  id: string;
  productId: string;
  author: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  caption: string;
  source: "CUSTOMER" | "INSTAGRAM" | "TIKTOK";
  permalink: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}
