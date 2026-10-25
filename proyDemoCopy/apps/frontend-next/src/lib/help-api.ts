import { apiFetch } from "./api-client";
import type { Locale } from "@aula/shared-i18n";
// [help-api · Sprint 7.13]: FAQ PÚBLICAS de NestJS Help para la landing (solo lectura, sin sesión) | [Patrón]: Facade + Adapter | [Principio]: SRP + SSOT (las mismas FAQ que el Centro de ayuda de Angular) | [Paradigma]: Funcional + asíncrono
// [Fail-soft]: si el backend no responde, la landing usa las preguntas de su diccionario (nunca se rompe la home)

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  role: "ALL" | "USER" | "TEACHER" | "ADMIN";
}

// [landingFaqs]: preguntas «para todos» del idioma activo · `revalidate` (Next.js ISR): se refrescan cada hora sin reconstruir
export async function landingFaqs(locale: Locale, limit = 6): Promise<PublicFaq[]> {
  try {
    const all = await apiFetch<PublicFaq[]>(`/help/faqs?locale=${locale}&role=ALL`, { next: { revalidate: 3600 } });
    return all.filter((f) => f.role === "ALL").slice(0, limit);
  } catch {
    return [];
  }
}
