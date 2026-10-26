import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { AUDIENCES } from '@aula/shared-schemas';
import { LOCALES } from '@aula/shared-i18n';
import type { SseData, SseMessage } from '@shared/utils/event-source';
// [Modelo Help · Dominio]: FAQ, manual por rol y Agente Guía (contrato de /api/help/* de NestJS) + reglas puras (filtro de FAQ, anclas, trozos SSE) | [Patrón]: Schema-First (Zod) + Tagged Union (GuideChunk) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional (funciones puras)

export const HELP_ROLES = AUDIENCES; // [Sprint 7.1]: packages/shared-schemas · mismos valores que NestJS Help (faq.entity.ts)
export type HelpRole = (typeof HELP_ROLES)[number];
export const HELP_LOCALES = LOCALES; // Idiomas de la interfaz (packages/shared-i18n)
export type HelpLocale = (typeof HELP_LOCALES)[number];

export const FaqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  category: z.string(),
  role: z.enum(HELP_ROLES),
  locale: z.enum(HELP_LOCALES),
  manualSlug: z.string().nullable(),
  reviewedAt: z.string(),
});
export type Faq = z.infer<typeof FaqSchema>; // `z.infer` (Zod): tipo derivado del esquema (DRY)

// [FaqInputSchema]: lo que edita el ADMIN — mismas reglas que CreateFaqDto (class-validator) → el error aparece antes de enviar
export const FaqInputSchema = z.object({
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(3).max(4000),
  category: z.string().regex(/^[a-z0-9-]{2,40}$/),
  role: z.enum(HELP_ROLES),
  locale: z.enum(HELP_LOCALES),
  manualSlug: z.union([z.literal(''), z.string().regex(/^[a-z0-9-]{2,80}$/)]), // '' = sin artículo
});
export type FaqInput = z.infer<typeof FaqInputSchema>;

export const ManualEntrySchema = z.object({
  slug: z.string(),
  title: z.string(),
  role: z.enum(HELP_ROLES),
  locale: z.enum(HELP_LOCALES),
  sections: z.array(z.string()),
  updatedAt: z.string(),
});
export type ManualEntry = z.infer<typeof ManualEntrySchema>;

export const ManualArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  role: z.enum(HELP_ROLES),
  locale: z.enum(HELP_LOCALES),
  body: z.string(),
  updatedAt: z.string(),
});
export type ManualArticle = z.infer<typeof ManualArticleSchema>;

export const ReindexResultSchema = z.object({
  articles: z.number(),
  updated: z.number(),
  removed: z.number(),
  faqsSeeded: z.number(),
  sections: z.number().nullable(), // null = FastAPI no respondió (el manual se publicó igual)
  faqIndexed: z.boolean(),
});
export type ReindexResult = z.infer<typeof ReindexResultSchema>;

// ───── Agente Guía ─────
export const GuideSourceSchema = z.object({ kind: z.enum(['faq', 'manual']), id: z.string(), title: z.string(), ref: z.string().nullable().optional() });
export type GuideSource = z.infer<typeof GuideSourceSchema>;
export type AnsweredBy = 'faq' | 'manual' | 'llm' | 'none';

export interface GuideTurn {
  role: 'user' | 'assistant';
  content: string;
  sources?: GuideSource[];
  answeredBy?: AnsweredBy;
  rating?: boolean; // Valoración enviada (útil / no útil)
}

// [BotMode · 2026-10-19]: modo del chatbot flotante → persona de FastAPI (tutor | support | guide)
export const BOT_MODES = ['tutor', 'support', 'guide'] as const;
export type BotMode = (typeof BOT_MODES)[number];

export interface GuideQuestion {
  message: string;
  sessionId?: string;
  route?: string;
  locale: HelpLocale;
  mode?: BotMode;
  language?: string; // Solo tutor: idioma que estudia
  level?: string; // [2026-10-25] Solo tutor: nivel MCER
}

// [GuideChunk]: unión discriminada del flujo SSE del Agente Guía (el del tutor + `sources`)
export type GuideChunk =
  | { type: 'session'; sessionId: string }
  | { type: 'token'; text: string }
  | { type: 'sources'; sources: GuideSource[]; answeredBy: AnsweredBy }
  | { type: 'done' };

// [toGuideChunk]: mensaje SSE genérico → trozo del Agente Guía | null = evento desconocido o mal formado | Puro
export function toGuideChunk({ type, data }: SseMessage<SseData>): GuideChunk | null {
  if (type === 'session' && typeof data['session_id'] === 'string') return { type: 'session', sessionId: data['session_id'] };
  if (type === 'token' && typeof data['text'] === 'string') return { type: 'token', text: data['text'] };
  if (type === 'sources') {
    const sources = z.array(GuideSourceSchema).safeParse(data['sources']);
    const by = data['answered_by'];
    return sources.success ? { type: 'sources', sources: sources.data, answeredBy: (['faq', 'manual', 'llm', 'none'] as const).find((x) => x === by) ?? 'llm' } : null;
  }
  return type === 'done' ? { type: 'done' } : null;
}

// [filterFaqs]: búsqueda instantánea en el cliente (pregunta y respuesta, sin acentos) + categoría + rol (el suyo y «ALL») | Puro
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export function filterFaqs(faqs: Faq[], f: { q?: string; category?: string; role?: HelpRole | '' }): Faq[] {
  const q = fold(f.q?.trim() ?? '');
  return faqs.filter(
    (x) =>
      (!f.category || x.category === f.category) &&
      (!f.role || x.role === f.role || x.role === 'ALL') &&
      (!q || fold(`${x.question} ${x.answer}`).includes(q)),
  );
}

// [anchor]: «Cómo pagar» → «como-pagar» (misma regla que FastAPI reindex_manual.anchor → las citas del agente abren la sección exacta) | Puro
export const anchor = (title: string): string =>
  fold(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// [sourceHref]: cita → enlace (FAQ = su ficha · manual = artículo#sección)
export const sourceHref = (s: GuideSource): string => {
  if (s.kind === 'faq') return `/ayuda/faq/${s.id}`;
  const [slug, section] = s.id.split('#');
  return `/ayuda/manual/${slug}${section ? `#${section}` : ''}`;
};
