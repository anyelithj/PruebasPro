// landing.api.ts => Repository de las landings contra Express: listado y detalle publicados (/cms/landing) y alta
// de leads (/cms/landing/:slug/lead, con rate limit en el backend). Inyección del cliente "api" (testeable).
import type { Api } from "~~/shared/lib/api-client";
import type { Query } from "~~/shared/types/api.types";
import type { Landing, LandingData, LandingSummary, Lead } from "~~/entities/landing/model/landing.types";
import type { LeadValues } from "../lib/landing.validator";

export function landingApi(api: Api) {
  return {
    list: (query: Query = {}) => api.get<LandingSummary[]>("/cms/landing", query),
    get: async (slug: string) => (await api.get<Landing>(`/cms/landing/${slug}`)).data as Landing & { data: LandingData },
    subscribe: async (slug: string, lead: LeadValues & { source?: string | undefined }) => (await api.post<Lead>(`/cms/landing/${slug}/lead`, lead)).data,
  };
}
