// social.validator.ts (Zod) => schemas del comercio social: publicar en redes (mismas reglas que PublishSchema de
// Express) y generar enlaces de compra social (UTM + código de referido del influencer). Mensajes = claves i18n.
import { z } from "zod";

export const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "TIKTOK"] as const;
const optional = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const publishSchema = z.object({
  caption: z.string().trim().min(1, "validation.required").max(2200),
  mediaUrl: z.string().trim().url("validation.url").startsWith("https://", "validation.https"),
  mediaAlt: z.string().trim().min(3, "validation.min3").max(200),
  platforms: z.array(z.enum(PLATFORMS)).max(3),
  influencerHandle: optional(31),
  influencerName: optional(80),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/, "validation.referral").optional().or(z.literal("").transform(() => undefined)),
  scheduledAt: z.string().optional().transform((value) => (value ? new Date(value).toISOString() : undefined)),
  draft: z.boolean(),
  format: z.enum(["FEED", "STORY"]), // RF-19.8 Story shoppable (Instagram / Facebook)
  linkUrl: z.string().trim().url("validation.url").startsWith("https://", "validation.https").optional().or(z.literal("").transform(() => undefined)),
});
export type PublishForm = z.input<typeof publishSchema>;
export type PublishValues = z.output<typeof publishSchema>;

// Enlace de compra social: producto + red de origen + campaña + código de referido (atribución de la venta)
export const checkoutLinkSchema = z.object({
  productId: z.string().uuid("validation.required"),
  platform: z.enum(PLATFORMS),
  campaign: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, "validation.slug"),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/, "validation.referral").optional().or(z.literal("").transform(() => undefined)),
});
export type CheckoutLinkValues = z.output<typeof checkoutLinkSchema>;

// buildCheckoutUrl => URL de la ficha en la tienda con UTM estándar (Express analytics agrupa por "channel")
export function buildCheckoutUrl(shopUrl: string, values: CheckoutLinkValues): string {
  const url = new URL(`${shopUrl}/products/${values.productId}`);
  url.searchParams.set("utm_source", values.platform.toLowerCase());
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", values.campaign);
  if (values.referralCode) url.searchParams.set("ref", values.referralCode);
  return url.toString();
}

// ---------- RF-19.9 Live Shopping (mismas reglas que LiveSchema de Express) ----------
export const LIVE_PLATFORMS = ["YOUTUBE", "FACEBOOK", "INSTAGRAM", "TIKTOK"] as const;
const https = z.string().trim().url("validation.url").startsWith("https://", "validation.https");
export const liveSchema = z.object({
  title: z.string().trim().min(3, "validation.min3").max(140),
  description: z.string().trim().max(2000),
  embedUrl: https,
  youtubeUrl: https.optional().or(z.literal("").transform(() => undefined)),
  facebookUrl: https.optional().or(z.literal("").transform(() => undefined)),
  instagramUrl: https.optional().or(z.literal("").transform(() => undefined)),
  tiktokUrl: https.optional().or(z.literal("").transform(() => undefined)),
  scheduledAt: z.string().min(1, "validation.required").transform((value) => new Date(value).toISOString()),
});
export type LiveValues = z.output<typeof liveSchema>;

// toLivePayload => Adapter formulario -> LiveSchema de Express (enlaces por red => "streams")
export const toLivePayload = (values: LiveValues, productIds: string[]) => ({
  title: values.title,
  description: values.description,
  embedUrl: values.embedUrl,
  scheduledAt: values.scheduledAt,
  productIds,
  streams: (
    [
      ["YOUTUBE", values.youtubeUrl],
      ["FACEBOOK", values.facebookUrl],
      ["INSTAGRAM", values.instagramUrl],
      ["TIKTOK", values.tiktokUrl],
    ] as const
  ).flatMap(([platform, url]) => (url ? [{ platform, url }] : [])),
});
