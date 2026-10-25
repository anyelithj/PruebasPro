// social.dto.ts => contratos de salida del módulo Social Commerce (feed, publicación, analítica).
// Los DTO de ENTRADA (PublishDto, UpdatePublishDto) se infieren de los schemas Zod (social.schema.ts): DRY.
import type { SocialPlatform, SocialPostStatus } from "../model/social.model";
import type { ProductListItemDto } from "../../product/dto/product.dto";

export interface InfluencerDto {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SocialMetricsDto {
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  purchases: number;
}

// SocialPostDto => tarjeta del feed con sus productos (MISMO DTO de tarjeta que el catálogo)
export interface SocialPostDto {
  id: string;
  caption: string;
  mediaUrl: string;
  mediaAlt: string;
  platforms: SocialPlatform[];
  format: "FEED" | "STORY"; // RF-19.8
  linkUrl: string | null;
  status: SocialPostStatus;
  influencer: InfluencerDto | null;
  referralCode: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  error: string | null;
  metrics: SocialMetricsDto;
  products: ProductListItemDto[];
  createdAt: Date;
}

// SocialAnalyticDto => métricas unificadas por red ("STORE" = feed propio de la tienda)
export interface SocialAnalyticDto extends SocialMetricsDto {
  platform: SocialPlatform | "STORE";
  posts: number;
  ctr: number; // Click-through rate = clicks / impressions
}
