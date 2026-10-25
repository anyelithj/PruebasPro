// cms.model.ts (Mongoose / MongoDB) => contenido editorial que administra Nuxt (Fase 8): páginas GrapesJS, landings,
// lookbooks y eventos SEO en UNA colección (Single Table Inheritance por "kind": mismos campos base + "data" propio
// de cada tipo), leads capturados en las landings y configuración global de la tienda (pagos, envío, impuestos, moneda).
// MongoDB: documentos flexibles (HTML/CSS y proyecto JSON de GrapesJS) sin migraciones por cada bloque nuevo.
// Patrones: Single Table Inheritance + Value Object (seo, media, hotspots). Paradigma declarativo.
import { Schema, model, type InferSchemaType } from "mongoose";

// "as const" => tuplas readonly; los tipos se derivan de ellas (una sola fuente de verdad para schema Zod y Mongoose)
export const ContentKinds = ["page", "landing", "lookbook", "event"] as const;
export type ContentKind = (typeof ContentKinds)[number];
export const ContentStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatus = (typeof ContentStatuses)[number];
export const ConfigSections = ["payment", "shipping", "tax", "currency", "returns", "help"] as const; // "returns" => RF-12.6; "help" => RF-21.2 preguntas frecuentes
export type ConfigSection = (typeof ConfigSections)[number];

// Imagen del contenido (Cloudinary) con "hotspots": productos etiquetados sobre la foto del lookbook (x/y en %)
const mediaSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    alt: { type: String, required: true, maxlength: 160 }, // Obligatorio: accesibilidad (WCAG 1.1.1) y SEO
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    hotspots: [{ _id: false, productId: { type: String, required: true }, x: Number, y: Number }],
  },
  { _id: false }
);

const contentSchema = new Schema(
  {
    kind: { type: String, enum: ContentKinds, required: true },
    slug: { type: String, required: true, maxlength: 120 },
    title: { type: String, required: true, maxlength: 160 },
    summary: { type: String, default: "", maxlength: 500 },
    locale: { type: String, enum: ["es", "en"], default: "es" },
    status: { type: String, enum: ContentStatuses, default: "DRAFT" },
    // SEO por documento (meta description, imagen Open Graph); el JSON-LD lo arma Nuxt según el tipo
    seo: { title: { type: String, default: null }, description: { type: String, default: null }, imageUrl: { type: String, default: null } },
    // Cuerpo visual: HTML/CSS que exporta GrapesJS + su proyecto JSON (para volver a editar sin perder estructura)
    body: { html: { type: String, default: "" }, css: { type: String, default: "" }, project: { type: Schema.Types.Mixed, default: null } },
    media: { type: [mediaSchema], default: [] },
    productIds: { type: [String], default: [] }, // Productos destacados (UUID de PostgreSQL)
    // "Mixed" => datos propios del tipo (landing: cuenta regresiva/CTA; evento: fechas y lugar), validados por Zod
    data: { type: Schema.Types.Mixed, default: {} },
    publishedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);
// Índices: slug único por tipo y listados públicos (solo publicados, más recientes primero) sin escanear la colección
contentSchema.index({ kind: 1, slug: 1 }, { unique: true });
contentSchema.index({ kind: 1, status: 1, publishedAt: -1 });

// Lead => email capturado en una landing (consentimiento explícito: GDPR / Ley 1581 de Colombia)
const leadSchema = new Schema(
  {
    landingSlug: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    name: { type: String, default: null, maxlength: 120 },
    consent: { type: Boolean, required: true },
    source: { type: String, default: null, maxlength: 120 }, // utm_source u origen de la visita
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);
leadSchema.index({ landingSlug: 1, email: 1 }, { unique: true }); // Un email por landing (sin duplicados)

// StoreConfig => un documento por sección; "value" validado por Zod. NUNCA guarda secretos (llaves privadas en .env)
const configSchema = new Schema(
  {
    section: { type: String, enum: ConfigSections, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

export type ContentRecord = InferSchemaType<typeof contentSchema>;
export type LeadRecord = InferSchemaType<typeof leadSchema>;
export const CmsContentModel = model("CmsContent", contentSchema);
export const CmsLeadModel = model("CmsLead", leadSchema);
export const StoreConfigModel = model("StoreConfig", configSchema);
