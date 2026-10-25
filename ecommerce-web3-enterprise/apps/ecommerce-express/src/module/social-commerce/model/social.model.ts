// social.model.ts (Mongoose / MongoDB) => SocialPost: publicación shoppable (imagen + texto + productos etiquetados)
// que se muestra en el feed social de la tienda y, opcionalmente, se publica en Instagram, Facebook y TikTok.
// ¿Por qué MongoDB? Feed de alto volumen, documentos sin transacciones y métricas por red con forma flexible.
// Los pedidos siguen en PostgreSQL (los productos etiquetados se guardan como referencia lógica por UUID).
import { Schema, model, type InferSchemaType } from "mongoose";

// Redes externas soportadas (Strategy en social.service: un publicador por red)
export const SocialPlatforms = ["INSTAGRAM", "FACEBOOK", "TIKTOK"] as const;
export type SocialPlatform = (typeof SocialPlatforms)[number];

// Ciclo de vida (patrón State): DRAFT/SCHEDULED/FAILED se editan; PUBLISHING evita que dos réplicas publiquen lo mismo
export const SocialPostStatuses = ["DRAFT", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"] as const;
export type SocialPostStatus = (typeof SocialPostStatuses)[number];
export const EDITABLE_STATUSES: readonly SocialPostStatus[] = ["DRAFT", "SCHEDULED", "FAILED"];
// RF-19.8 formato: publicación del feed o Story shoppable (24 h en la red; en la tienda queda con sus productos)
export const SocialFormats = ["FEED", "STORY"] as const;
export type SocialFormat = (typeof SocialFormats)[number];

const INSTAGRAM_CAPTION_MAX = 2200; // Límite de caracteres de Instagram (el más estricto de las tres redes)

const socialPostSchema = new Schema(
  {
    authorId: { type: String, required: true }, // UUID del ADMIN/VENDOR que la creó
    caption: { type: String, required: true, maxlength: INSTAGRAM_CAPTION_MAX },
    mediaUrl: { type: String, required: true }, // Imagen pública HTTPS (las redes la descargan desde aquí)
    mediaAlt: { type: String, required: true, maxlength: 200 }, // Texto alternativo: accesibilidad (WCAG 1.1.1)
    productIds: { type: [String], default: [] }, // Productos etiquetados (shoppable)
    format: { type: String, enum: SocialFormats, default: "FEED" }, // RF-19.8
    linkUrl: { type: String, default: null }, // RF-19.8 enlace de compra de la Story (con UTM de atribución)
    platforms: { type: [String], enum: SocialPlatforms, default: [] }, // Vacío = solo el feed de la tienda
    // Colaboración con influencer (tracking de referidos): perfil público + código de referido
    influencer: {
      type: new Schema({ handle: { type: String, required: true }, displayName: { type: String, required: true }, avatarUrl: String }, { _id: false }),
      default: null,
    },
    referralCode: { type: String, default: null },
    status: { type: String, enum: SocialPostStatuses, default: "DRAFT" },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    externalIds: { type: Map, of: String, default: {} }, // Red -> ID de la publicación en esa red
    error: { type: String, default: null }, // Último error de publicación (visible para el autor)
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      purchases: { type: Number, default: 0 },
    },
  },
  { timestamps: true, versionKey: false }
);

socialPostSchema.index({ status: 1, publishedAt: -1 }); // Feed público: publicadas, más recientes primero
socialPostSchema.index({ "influencer.handle": 1, publishedAt: -1 }); // Perfil de un influencer
socialPostSchema.index({ status: 1, scheduledAt: 1 }); // Job de publicaciones programadas vencidas
socialPostSchema.index({ authorId: 1, createdAt: -1 }); // Analítica del vendedor

export type SocialPostRecord = InferSchemaType<typeof socialPostSchema>;
export const SocialPostModel = model("SocialPost", socialPostSchema);

// SocialComment (RF-15.11) => comentario recibido en una red (webhook de Meta/TikTok vía n8n o importación del panel).
// Se guarda el texto para analizar el sentimiento; "externalId" único evita duplicados al reenviar el webhook
const socialCommentSchema = new Schema(
  {
    postId: { type: String, default: null }, // Publicación de la tienda a la que pertenece (si se conoce)
    platform: { type: String, enum: SocialPlatforms, required: true },
    externalId: { type: String, required: true, unique: true },
    author: { type: String, required: true, maxlength: 120 },
    text: { type: String, required: true, maxlength: 1000 },
    publishedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);
socialCommentSchema.index({ publishedAt: -1 }); // Análisis del período más reciente
export const SocialCommentModel = model("SocialComment", socialCommentSchema);
