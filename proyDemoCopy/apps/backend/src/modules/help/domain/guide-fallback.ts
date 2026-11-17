import type { HelpLocale } from './entities/faq.entity';
import { basicAnswer, NO_ANSWER, smallTalk } from './guide-basics';
// [GuideFallback · Dominio · 2026-10-27]: respuesta del Agente Guía SIN IA (FastAPI/Ollama caídos) → búsqueda léxica sobre las FAQ publicadas y las secciones del manual
// | [Patrón]: Null Object de la cadena FAQ → manual → LLM (misma forma de respuesta y citas) + Chain of Responsibility (FAQ antes que manual) | [Principio]: Fail Soft + SRP (sin HTTP ni BD: funciones puras y testeables) | [Paradigma]: Funcional
// [Por qué]: antes un FastAPI apagado devolvía 503 «El Agente Guía no está disponible» y el usuario solo veía un error; el manual y la FAQ están en PostgreSQL → se responde igual

export interface FallbackFaq {
  id: string;
  question: string;
  answer: string;
  manualSlug: string | null;
}
export interface FallbackArticle {
  slug: string;
  title: string;
  body: string;
}
export interface FallbackSource {
  kind: 'faq' | 'manual';
  id: string;
  title: string;
  ref: string | null;
}
export interface FallbackAnswer {
  reply: string;
  sources: FallbackSource[];
  answeredBy: 'faq' | 'manual' | 'none';
}
export type GuideMode = 'guide' | 'support'; // [2026-10-28]: sin «tutor» — el asistente «Soporte y Guía» no enseña idiomas (Tutor IA en /tutor)

// [Umbrales]: proporción mínima de palabras de la pregunta presentes en el candidato (0..1) | constantes nombradas (sin números mágicos)
const MIN_SCORE = 0.34;
const MAX_SNIPPET = 700; // Caracteres de la sección del manual que se muestran (el enlace lleva al resto)
const MAX_SOURCES = 3;

// [Palabras vacías ES/EN]: no aportan significado a la búsqueda («cómo», «the»…) | `ReadonlySet` (TS): inmutable
const STOPWORDS: ReadonlySet<string> = new Set(
  'como cual cuales cuando donde que quien para por con sin los las del una uno unos unas este esta esto ese esa eso mis tus sus hay puedo puede quiero tengo hacer the and for how what where when which with can you your are does from that this have'.split(
    ' ',
  ),
);

// [fold]: minúsculas sin tildes (á→a, ñ→n) — misma regla que `anchor` de FastAPI y Angular | `normalize('NFD')` (Unicode): separa la tilde de la letra
export const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// [anchor]: «Cómo pagar» → «como-pagar» (ancla de la sección; las citas abren la sección exacta)
export const anchor = (title: string): string =>
  fold(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// [terms]: palabras significativas (≥ 3 letras, sin palabras vacías) | `Set`: sin duplicados
export const terms = (s: string): Set<string> =>
  new Set(
    fold(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
  );

// [score]: fracción de términos de la pregunta presentes en el candidato; el título/pregunta pesa el doble (es lo que mejor lo describe)
// Coincidencia por prefijo de 5 letras → «certificado» ≈ «certificados», «pagar» ≈ «pagos» (stemming mínimo sin librerías)
function score(query: Set<string>, title: string, body: string): number {
  if (query.size === 0) return 0;
  const stem = (w: string) => w.slice(0, 5);
  const inTitle = new Set([...terms(title)].map(stem));
  const inBody = new Set([...terms(body)].map(stem));
  let total = 0;
  for (const q of query) total += inTitle.has(stem(q)) ? 2 : inBody.has(stem(q)) ? 1 : 0;
  return total / (2 * query.size);
}

// [sections]: un artículo Markdown → secciones `## ` (la introducción va con el título del artículo) sin capturas de pantalla
export function sections(a: FallbackArticle): { id: string; title: string; text: string; ref: string }[] {
  const parts = a.body.split(/^##\s+(.+?)\s*$/m); // [intro, título1, cuerpo1, …] — `split` con grupo de captura conserva los títulos
  const pairs: [string, string][] = [[a.title, parts[0] ?? '']];
  for (let i = 1; i < parts.length; i += 2) pairs.push([parts[i], parts[i + 1] ?? '']);
  return pairs
    .map(([title, body]) => ({
      id: title === a.title ? a.slug : `${a.slug}#${anchor(title)}`,
      title,
      text: body
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // Capturas: no aportan texto
        .replace(/^#\s+.*$/m, '') // H1 del artículo (ya está en el título)
        .trim(),
      ref: a.slug,
    }))
    .filter((s) => s.text.length > 0);
}

// [clip]: recorta en el último fin de frase/espacio antes del límite → no corta palabras a la mitad
const clip = (s: string, max: number): string => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
  return `${cut.slice(0, end > max * 0.6 ? end + 1 : max).trim()}…`;
};

const MANUAL_INTRO: Record<HelpLocale, string> = {
  es: 'Esto es lo más parecido que encontré en el manual:',
  en: 'This is the closest match I found in the manual:',
};

// [answerWithoutLlm]: FAQ con mejor puntuación → su respuesta aprobada · si no, la sección del manual más parecida (recortada, con cita) · si no, «no lo sé»
export function answerWithoutLlm(
  question: string,
  locale: HelpLocale,
  mode: GuideMode,
  faqs: FallbackFaq[],
  articles: FallbackArticle[],
): FallbackAnswer {
  // [2026-11-09]: saludo → respuesta amable · sin coincidencias → pasos del tema frecuente antes de «no lo sé»
  const chat = smallTalk(question, mode, locale);
  if (chat) return { reply: chat, sources: [], answeredBy: 'none' };
  const none: FallbackAnswer = { reply: basicAnswer(question, locale) ?? NO_ANSWER[locale][mode], sources: [], answeredBy: 'none' };
  const q = terms(question);
  const faqHits = faqs
    .map((f) => ({ f, s: score(q, f.question, f.answer) }))
    .filter((x) => x.s >= MIN_SCORE)
    .sort((a, b) => b.s - a.s);
  const manualHits = articles
    .flatMap(sections)
    .map((sec) => ({ sec, s: score(q, sec.title, sec.text) }))
    .filter((x) => x.s >= MIN_SCORE)
    .sort((a, b) => b.s - a.s);

  const manualSources: FallbackSource[] = manualHits.map(({ sec }) => ({ kind: 'manual', id: sec.id, title: sec.title, ref: sec.ref }));
  const bestFaq = faqHits[0];
  if (bestFaq && bestFaq.s >= (manualHits[0]?.s ?? 0)) {
    const { f } = bestFaq;
    return {
      reply: f.answer,
      sources: [{ kind: 'faq' as const, id: f.id, title: f.question, ref: f.manualSlug }, ...manualSources].slice(0, MAX_SOURCES),
      answeredBy: 'faq',
    };
  }
  const best = manualHits[0];
  if (!best) return none;
  return {
    reply: `${MANUAL_INTRO[locale]}\n\n${best.sec.title}\n${clip(best.sec.text, MAX_SNIPPET)}`,
    sources: manualSources.slice(0, MAX_SOURCES),
    answeredBy: 'manual',
  };
}

