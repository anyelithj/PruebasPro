// channel.model.ts (Mongoose / MongoDB) => entidades del comercio social multicanal (RF 19):
//  - ChannelListing (RF-19.1 / 19.7 / 19.10): producto/variante publicado en un canal externo y su id allá
//  - LiveSession (RF-19.9): transmisión de Live Shopping con productos y producto fijado en vivo
//  - UgcItem (RF-19.11): contenido generado por usuarios (foto/video) asociado a un producto, con moderación
// ¿Por qué MongoDB? Documentos sin transacciones, forma flexible por canal y alto volumen de lectura en la tienda.
// Los pedidos importados viven en PostgreSQL (un solo modelo de pedido para todos los canales).
import { Schema, model, type InferSchemaType } from "mongoose";

// Canales de catálogo: el catálogo de Meta alimenta Facebook Shop, Instagram Shopping, Marketplace y WhatsApp
export const CatalogChannels = ["META", "TIKTOK_SHOP"] as const;
export type CatalogChannel = (typeof CatalogChannels)[number];

const channelListingSchema = new Schema(
  {
    channel: { type: String, enum: CatalogChannels, required: true },
    productId: { type: String, required: true }, // UUID del producto en PostgreSQL
    variantId: { type: String, default: null },
    sku: { type: String, required: true },
    externalId: { type: String, default: null }, // Id del producto en el canal (TikTok product_id)
    externalSkuId: { type: String, default: null }, // Id de la variante en el canal (TikTok sku id)
    syncedAt: { type: Date, default: null },
    error: { type: String, default: null }, // Último error de sincronización (visible en el panel)
  },
  { timestamps: true, versionKey: false }
);
channelListingSchema.index({ channel: 1, sku: 1 }, { unique: true }); // Una fila por SKU y canal (idempotente)
channelListingSchema.index({ channel: 1, productId: 1 });
export const ChannelListingModel = model("ChannelListing", channelListingSchema);

// ---------- RF-19.9 Live Shopping ----------
export const LivePlatforms = ["YOUTUBE", "FACEBOOK", "INSTAGRAM", "TIKTOK", "STORE"] as const;
export const LiveStatuses = ["SCHEDULED", "LIVE", "ENDED"] as const;
export type LiveStatus = (typeof LiveStatuses)[number];

const liveSessionSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 140 },
    description: { type: String, default: "", maxlength: 2000 },
    hostId: { type: String, required: true }, // ADMIN/VENDOR que transmite
    embedUrl: { type: String, required: true }, // Reproductor embebible (YouTube Live, Facebook Live...) en la tienda
    // Varias plataformas a la vez (multistream): enlace de la transmisión en cada red
    streams: { type: [new Schema({ platform: { type: String, enum: LivePlatforms, required: true }, url: { type: String, required: true } }, { _id: false })], default: [] },
    productIds: { type: [String], default: [] }, // Productos de la transmisión
    pinnedProductId: { type: String, default: null }, // Producto que se muestra en este momento
    status: { type: String, enum: LiveStatuses, default: "SCHEDULED" },
    scheduledAt: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    clicks: { type: Number, default: 0 }, // Clics en productos desde el live (atribución)
  },
  { timestamps: true, versionKey: false }
);
liveSessionSchema.index({ status: 1, scheduledAt: -1 });
export const LiveSessionModel = model("LiveSession", liveSessionSchema);
export type LiveSessionRecord = InferSchemaType<typeof liveSessionSchema>;

// ---------- RF-19.11 UGC ----------
export const UgcSources = ["CUSTOMER", "INSTAGRAM", "TIKTOK"] as const;
export const UgcStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type UgcStatus = (typeof UgcStatuses)[number];

const ugcSchema = new Schema(
  {
    productId: { type: String, required: true },
    userId: { type: String, default: null }, // Cliente que lo subió (null si se importó de una red)
    author: { type: String, required: true, maxlength: 120 },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["IMAGE", "VIDEO"], default: "IMAGE" },
    caption: { type: String, default: "", maxlength: 1000 },
    source: { type: String, enum: UgcSources, default: "CUSTOMER" },
    externalId: { type: String, default: null }, // Id de la publicación original (evita importar dos veces)
    permalink: { type: String, default: null }, // Enlace a la publicación original (crédito al autor)
    status: { type: String, enum: UgcStatuses, default: "PENDING" }, // Moderación obligatoria antes de mostrarse
  },
  { timestamps: true, versionKey: false }
);
ugcSchema.index({ productId: 1, status: 1, createdAt: -1 }); // Galería de la ficha de producto
ugcSchema.index({ externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: "string" } } });
export const UgcModel = model("Ugc", ugcSchema);
