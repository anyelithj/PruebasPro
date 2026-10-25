// social.schema.ts => validación Zod del módulo Social Commerce (PublishSchema, PlatformEnum).
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { SocialFormats, SocialPlatforms } from "../model/social.model";
import { CatalogChannels, LivePlatforms, LiveStatuses, UgcStatuses } from "../model/channel.model";

export const PlatformEnum = z.enum(SocialPlatforms);

const InfluencerSchema = z.object({
  handle: z.string().trim().regex(/^@?[\w.]{2,30}$/, { message: "handle inválido" }).transform((h) => h.replace(/^@/, "").toLowerCase()),
  displayName: z.string().trim().min(2).max(80),
  avatarUrl: z.string().url().startsWith("https://").optional(),
});

// PublishSchema => POST /api/v1/social/publish
export const PublishSchema = z.object({
  caption: z.string().trim().min(1).max(2200),
  mediaUrl: z.string().url().startsWith("https://", { message: "La imagen debe ser HTTPS (las redes la descargan)" }),
  mediaAlt: z.string().trim().min(3).max(200),
  productIds: z.array(z.string().uuid()).max(20).default([]), // Instagram etiqueta hasta 20 productos por publicación
  platforms: z.array(PlatformEnum).max(3).default([]), // Vacío = solo el feed de la tienda
  influencer: InfluencerSchema.optional(),
  referralCode: z.string().trim().regex(/^[A-Z0-9-]{3,30}$/).optional(),
  // Fecha futura => queda programada; sin fecha => se publica ya
  scheduledAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), { message: "scheduledAt debe ser futura" }).optional(),
  draft: z.boolean().default(false), // true => se guarda como borrador sin publicar
  format: z.enum(SocialFormats).default("FEED"), // RF-19.8 Story shoppable (Instagram / Facebook)
  linkUrl: z.string().url().startsWith("https://").optional(), // Enlace de compra de la Story
});

// UpdatePublishSchema => PATCH /api/v1/social/publish/:id (parcial; "draft:false" publica un borrador)
export const UpdatePublishSchema = PublishSchema.partial().omit({ draft: true }).extend({ draft: z.boolean().optional() });

// ListSocialQuerySchema => GET /api/v1/social/product (feed público)
export const ListSocialQuerySchema = PaginationQuerySchema.extend({
  influencer: z.string().trim().toLowerCase().optional(),
  productId: z.string().uuid().optional(),
});

export type PublishInput = z.infer<typeof PublishSchema>;
export type UpdatePublishInput = z.infer<typeof UpdatePublishSchema>;
export type ListSocialQuery = z.infer<typeof ListSocialQuerySchema>;

// IngestCommentsSchema => POST /api/v1/social/comment (RF-15.11 comentarios de redes: webhook n8n o importación)
export const IngestCommentsSchema = z.object({
  comments: z
    .array(
      z.object({
        postId: z.string().max(64).optional(),
        platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK"]),
        externalId: z.string().trim().min(1).max(120),
        author: z.string().trim().min(1).max(120),
        text: z.string().trim().min(1).max(1000),
        publishedAt: z.coerce.date().default(() => new Date()),
      })
    )
    .min(1)
    .max(500),
});
export const SentimentQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(180).default(30) });
export type IngestCommentsInput = z.infer<typeof IngestCommentsSchema>;

// ---------- RF-19.1 / 19.7 catálogo multicanal ----------
export const CatalogSyncSchema = z.object({ channels: z.array(z.enum(CatalogChannels)).min(1).optional() });

// ---------- RF-19.9 Live Shopping ----------
const HttpsUrl = z.string().url().startsWith("https://");
export const LiveSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).default(""),
  embedUrl: HttpsUrl, // URL de inserción (youtube.com/embed/..., facebook.com/plugins/video.php?...)
  streams: z.array(z.object({ platform: z.enum(LivePlatforms), url: HttpsUrl })).max(5).default([]),
  productIds: z.array(z.string().uuid()).max(50).default([]),
  scheduledAt: z.coerce.date(),
});
export const UpdateLiveSchema = LiveSchema.partial().extend({
  status: z.enum(LiveStatuses).optional(),
  pinnedProductId: z.string().uuid().nullable().optional(),
});
export const LiveListQuerySchema = z.object({ status: z.enum(LiveStatuses).optional() });

// ---------- RF-19.11 UGC ----------
export const UgcSchema = z.object({
  productId: z.string().uuid(),
  mediaUrl: HttpsUrl, // Subida antes a /media/upload (folder=ugc)
  mediaType: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  caption: z.string().trim().max(1000).default(""),
});
export const UgcImportSchema = z.object({ productId: z.string().uuid(), hashtag: z.string().trim().regex(/^[\w]{2,40}$/).optional() });
export const UgcModerationSchema = z.object({ status: z.enum(UgcStatuses) });
export const UgcQueueQuerySchema = PaginationQuerySchema.extend({ status: z.enum(UgcStatuses).default("PENDING") });

export type LiveInput = z.infer<typeof LiveSchema>;
export type UpdateLiveInput = z.infer<typeof UpdateLiveSchema>;
export type UgcInput = z.infer<typeof UgcSchema>;
export type UgcImportInput = z.infer<typeof UgcImportSchema>;
