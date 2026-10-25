// cms.dto.ts => contratos de salida del módulo CMS (lo que reciben Nuxt y la tienda Next.js).
import type { ConfigSection, ContentKind, ContentStatus } from "../model/cms.model";

export interface CmsMediaDto {
  url: string;
  publicId: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  hotspots: Array<{ productId: string; x: number; y: number }>;
}

// CmsContentSummaryDto => tarjeta de listado (sin el cuerpo HTML: respuestas pequeñas = menos red y memoria)
export interface CmsContentSummaryDto {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  summary: string;
  locale: "es" | "en";
  status: ContentStatus;
  coverUrl: string | null;
  coverAlt: string | null;
  data: Record<string, unknown>;
  publishedAt: Date | null;
  updatedAt: Date;
}

// CmsContentDto => documento completo (detalle y editor)
export interface CmsContentDto extends Omit<CmsContentSummaryDto, "coverUrl" | "coverAlt"> {
  seo: { title: string | null; description: string | null; imageUrl: string | null };
  body: { html: string; css: string; project: Record<string, unknown> | null };
  media: CmsMediaDto[];
  productIds: string[];
  createdBy: string;
  createdAt: Date;
}

export interface CmsLeadDto {
  id: string;
  landingSlug: string;
  email: string;
  name: string | null;
  source: string | null;
  createdAt: Date;
}

export interface StoreConfigDto {
  section: ConfigSection;
  value: Record<string, unknown>;
  updatedAt: Date | null;
}
