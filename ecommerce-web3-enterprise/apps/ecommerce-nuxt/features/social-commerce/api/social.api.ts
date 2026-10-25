// social.api.ts => Repository del comercio social contra Express (/social, Fase 6): feed de publicaciones con
// productos, detalle, métricas por plataforma (solo staff) y publicación/edición/borrado. Inyección del cliente "api".
import type { Api } from "~~/shared/lib/api-client";
import type { Query } from "~~/shared/types/api.types";
import type { ChannelStatus, LiveSession, SocialAnalytic, SocialInsights, SocialPost, UgcItem } from "~~/entities/social/model/social.types";
import type { PublishValues } from "../lib/social.validator";

// toPayload => valores del formulario -> PublishSchema de Express (Adapter: influencer como objeto anidado)
export const toPayload = (values: PublishValues) => ({
  caption: values.caption,
  mediaUrl: values.mediaUrl,
  mediaAlt: values.mediaAlt,
  platforms: values.platforms,
  ...(values.influencerHandle && values.influencerName ? { influencer: { handle: values.influencerHandle, displayName: values.influencerName } } : {}),
  ...(values.referralCode ? { referralCode: values.referralCode } : {}),
  ...(values.scheduledAt ? { scheduledAt: values.scheduledAt } : {}),
  draft: values.draft,
  format: values.format, // RF-19.8
  ...(values.linkUrl ? { linkUrl: values.linkUrl } : {}),
});

export function socialApi(api: Api) {
  return {
    posts: (query: Query = {}) => api.get<SocialPost[]>("/social/product", query),
    post: async (id: string) => (await api.get<SocialPost>(`/social/product/${id}`)).data,
    analytics: async () => (await api.get<SocialAnalytic[]>("/social/analytic")).data,
    sentiment: async (days = 30) => (await api.get<SocialInsights>("/social/sentiment", { days })).data, // RF-15.11
    publish: async (values: PublishValues, productIds: string[] = []) => (await api.post<SocialPost>("/social/publish", { ...toPayload(values), productIds })).data,
    remove: (id: string) => api.del(`/social/publish/${id}`),
    // RF-19.1 / 19.7 / 19.10 canales de catálogo
    channels: async () => (await api.get<ChannelStatus[]>("/social/channel")).data,
    syncChannels: async (channels?: string[]) => (await api.post<Array<{ channel: string; synced: number; failed: number }>>("/social/channel/sync", channels ? { channels } : {})).data,
    // RF-19.9 Live Shopping
    lives: async (status?: string) => (await api.get<LiveSession[]>("/social/live", status ? { status } : {})).data,
    live: async (id: string) => (await api.get<LiveSession>(`/social/live/${id}`)).data,
    createLive: async (body: unknown) => (await api.post<LiveSession>("/social/live", body)).data,
    updateLive: async (id: string, body: Record<string, unknown>) => (await api.patch<LiveSession>(`/social/live/${id}`, body)).data,
    deleteLive: (id: string) => api.del(`/social/live/${id}`),
    liveClick: (id: string) => api.post(`/social/live/${id}/click`),
    // RF-19.11 UGC
    ugc: async (productId: string) => (await api.get<UgcItem[]>("/social/ugc", { productId })).data,
    submitUgc: async (body: { productId: string; mediaUrl: string; mediaType: "IMAGE" | "VIDEO"; caption: string }) => (await api.post<{ id: string }>("/social/ugc", body)).data,
    ugcQueue: (query: Query = {}) => api.get<UgcItem[]>("/social/ugc/queue", query),
    moderateUgc: (id: string, status: "APPROVED" | "REJECTED") => api.patch(`/social/ugc/${id}`, { status }),
    importUgc: async (productId: string, hashtag?: string) => (await api.post<{ imported: number }>("/social/ugc/import", { productId, ...(hashtag ? { hashtag } : {}) })).data,
  };
}
