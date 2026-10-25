// landing.types.ts (TypeScript estricto) => "data" propio de una landing (validado por Express en cms.schema.ts):
// titular, llamado a la acción, cupón, fin de la oferta (cuenta regresiva) y testimonios.
import type { CmsContent, CmsContentSummary } from "../../cms/model/cms.types";

export interface Testimonial {
  author: string;
  quote: string;
}

export interface LandingData {
  headline?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  couponCode?: string;
  endsAt?: string; // ISO: fin de la oferta
  testimonials: Testimonial[];
}

export type Landing = CmsContent<LandingData>;
export type LandingSummary = CmsContentSummary<LandingData>;

// Lead => suscripción capturada en la landing (consentimiento explícito obligatorio)
export interface Lead {
  id: string;
  landingSlug: string;
  email: string;
  name: string | null;
  source: string | null;
  createdAt: string;
}
