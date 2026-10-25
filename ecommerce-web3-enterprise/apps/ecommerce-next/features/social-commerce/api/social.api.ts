// social.api.ts => lecturas REST (Axios) del Social Commerce Service de Express: feed público y detalle de publicación.
// Funciones puras sin hooks (sin "use client"): las usan los Server Components con ISR y también los Client Components
// como queryFn de TanStack Query (una sola implementación: DRY). Patrón: Gateway. Paradigma: asíncrono + funcional.
// Publicar/editar (POST/PATCH /social/publish, roles ADMIN/VENDOR) es UI del panel admin (sprint 7.3).
import { ApiError, apiGet, apiRequest } from "@/shared/lib/api-client";
import { config } from "@/shared/constants/config";
import type { PaginationMeta } from "@/shared/types/api.types";
import type { ProductCard } from "@/entities/product/model/product.types";
import { FEED_PAGE_SIZE, type SocialFeedQuery } from "../lib/social.validator";

export type SocialPlatform = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";

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

// SocialPost => SocialPostDto de Express (fechas como string ISO al viajar en JSON)
export interface SocialPost {
  id: string;
  caption: string;
  mediaUrl: string;
  mediaAlt: string;
  platforms: SocialPlatform[];
  influencer: Influencer | null;
  referralCode: string | null;
  publishedAt: string | null;
  metrics: SocialMetrics;
  products: ProductCard[];
  createdAt: string;
}

export interface SocialFeedPage {
  data: SocialPost[];
  meta?: PaginationMeta;
}

// isr => caché del Data Cache de Next (solo servidor) con etiqueta "social" para revalidación bajo demanda
const isr = { revalidate: config.revalidateSeconds, tags: ["social"] };

// getSocialFeed => GET /social/product (paginado; filtro opcional por influencer)
export function getSocialFeed(
  query: Partial<SocialFeedQuery> & { limit?: number }
): Promise<SocialFeedPage> {
  return apiRequest<SocialPost[]>("/social/product", {
    query: { limit: FEED_PAGE_SIZE, ...query },
    next: isr,
  });
}

// getSocialPost => detalle; null si no existe o no está publicado (la página responde 404 real)
export async function getSocialPost(id: string): Promise<SocialPost | null> {
  return apiGet<SocialPost>(`/social/product/${encodeURIComponent(id)}`, { next: isr }).catch(
    (error: unknown) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
      throw error;
    }
  );
}
