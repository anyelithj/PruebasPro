import { Language } from '../../../../shared/domain/language.vo';
// [Artículo de las fichas de vocabulario · 2026-11-02]: qué artículos admite cada idioma y cuándo es obligatorio | [Patrón]: Specification + Lookup Table | [Paradigma]: Funcional (pura)
// de/fr/pt/es: obligatorio en sustantivos · en: opcional (a, an, the) · ru/zh: no tienen artículos («No aplica») → el campo debe ir vacío
// [Espejo]: frontend-next/src/types/curriculum.ts (VOCAB_ARTICLES) — misma tabla para validar antes de enviar

export const VOCAB_ARTICLES: Readonly<Record<Language, readonly string[]>> = {
  [Language.DE]: ['der', 'die', 'das'],
  [Language.FR]: ['le', 'la', "l'", 'les'],
  [Language.PT]: ['o', 'a', 'os', 'as'],
  [Language.ES]: ['el', 'la', 'los', 'las'],
  [Language.EN]: ['a', 'an', 'the'],
  [Language.RU]: [],
  [Language.ZH]: [],
};
export const ARTICLE_REQUIRED: ReadonlySet<Language> = new Set([Language.DE, Language.FR, Language.PT, Language.ES]);

// `’` tipográfico → `'` (l’ = l') | minúsculas: «Der» = «der»
export const normalizeArticle = (a: unknown): string => (typeof a === 'string' ? a.trim().toLowerCase().replace(/’/g, "'") : '');

// [isNoun]: el tipo de palabra lo marca como sustantivo (el editor guarda «sustantivo»; la IA a veces «noun» o «sustantivo masculino»)
// Sin tipo de palabra no se sabe si es sustantivo → no se exige (nunca se adivina)
const isNoun = (partOfSpeech: unknown): boolean => typeof partOfSpeech === 'string' && /^(sustantivo|nombre|noun)\b/i.test(partOfSpeech.trim());

// [articleInLemma]: la palabra YA trae su artículo escrito («das Obst», «l'eau») → la información está y no hace falta repetirla (datos existentes siguen siendo válidos)
export function articleInLemma(language: Language, lemma: unknown): string | null {
  if (typeof lemma !== 'string') return null;
  const l = lemma.trim().toLowerCase().replace(/’/g, "'");
  return VOCAB_ARTICLES[language].find((a) => (a.endsWith("'") ? l.startsWith(a) && l.length > a.length : l.startsWith(`${a} `))) ?? null;
}

// [vocabularyArticleProblem]: null = correcto · texto = motivo legible (va en el 400 como «content.article: …»)
export function vocabularyArticleProblem(language: Language, content: Record<string, unknown>): string | null {
  const article = normalizeArticle(content.article);
  const allowed = VOCAB_ARTICLES[language];
  if (!allowed.length) return article ? 'Este idioma no tiene artículos gramaticales: el artículo no aplica' : null;
  if (article && !allowed.includes(article)) return `Artículo no válido para este idioma; usa: ${allowed.join(', ')}`;
  if (!article && ARTICLE_REQUIRED.has(language) && isNoun(content.partOfSpeech) && !articleInLemma(language, content.lemma))
    return `El artículo es obligatorio para los sustantivos (${allowed.join(', ')})`;
  return null;
}
