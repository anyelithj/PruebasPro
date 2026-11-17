import { Language } from '../../../../shared/domain/language.vo';
import type { NounGrammarResult } from '../../../../shared/domain/interfaces/language-tools.interface';
import { articleInLemma, normalizeArticle, VOCAB_ARTICLES } from './vocabulary-article';
// [vocabulary-grammar · 2026-11-06 · Regla obligatoria de vocabulario]: funciones PURAS que completan una ficha de vocabulario con artículo, género, plural y clasificador
// Antes vivían en ai-draft.queries y en el listener de Vocabulary (solo se aplicaban al APROBAR) → ahora también al GENERAR con IA | [Principio]: DRY + SSOT | [Paradigma]: Funcional

type Content = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const GENDER_ES = { m: 'masculino', f: 'femenino', n: 'neutro' } as const;
const WITH_ARTICLE = new Set<string>(['de', 'fr', 'pt', 'es']);
const PLURAL_ARTICLES = new Set(['les', 'os', 'as', 'los', 'las']);
// [Artículo por género]: misma tabla que ai-service/.../domain/noun_grammar.py (DEFINITE)
const DEFINITE: Partial<Record<string, Partial<Record<'m' | 'f' | 'n', string>>>> = {
  de: { m: 'der', f: 'die', n: 'das' },
  fr: { m: 'le', f: 'la' },
  pt: { m: 'o', f: 'a' },
  es: { m: 'el', f: 'la' },
};
const FR_VOWEL = /^[aeiouyhâàéèêëîïôûùœ]/i;

// [genderCode]: «masculino», «m», «Maskulinum», «féminin»… → m/f/n | null si no se reconoce
export function genderCode(g: unknown): 'm' | 'f' | 'n' | null {
  const s = str(g).toLowerCase();
  if (/^(m|masc|mask|male)/.test(s)) return 'm';
  if (/^(f|fem)/.test(s)) return 'f';
  if (/^(n|neut)/.test(s)) return 'n';
  return null;
}

// [articleFor]: artículo definido singular por género (fr: l' ante vocal/h) | null = no se puede deducir
export function articleFor(language: string, word: string, gender: unknown): string | null {
  const g = genderCode(gender);
  const art = g ? DEFINITE[language]?.[g] : undefined;
  if (!art) return null;
  return language === 'fr' && FR_VOWEL.test(word.trim()) ? "l'" : art;
}

const join = (article: string, word: string): string => (article.endsWith("'") ? `${article}${word}` : `${article} ${word}`);

// [withArticle · 2026-11-05]: «Tisch» + article «der» → lemma «der Tisch» · «der Tisch» sin article → article «der»
// [2026-11-06]: sin artículo pero CON género (la IA suele darlo) → el artículo sale del género (determinista, sin otra llamada)
export function withArticle(language: Language, d: Content): void {
  if (typeof d.lemma !== 'string' || !d.lemma.trim()) return;
  const inLemma = articleInLemma(language, d.lemma);
  if (inLemma) {
    if (!normalizeArticle(d.article)) d.article = inLemma;
    return;
  }
  const word = d.lemma.trim();
  let article = normalizeArticle(d.article);
  if (!article && WITH_ARTICLE.has(language)) article = articleFor(language, word, d.gender) ?? '';
  if (!VOCAB_ARTICLES[language].includes(article) || PLURAL_ARTICLES.has(article)) return;
  if (!normalizeArticle(d.article)) d.article = article;
  d.lemma = join(article, word);
}

// [needsGrammar]: sustantivo (o sin tipo de palabra: la IA decide) al que le falta un dato obligatorio de su idioma
export function needsGrammar(language: string, c: Content): boolean {
  const pos = str(c.partOfSpeech);
  if (pos && !/^(sustantivo|nombre|noun)\b/i.test(pos)) return false;
  if (!str(c.lemma)) return false;
  if (WITH_ARTICLE.has(language))
    return !(str(c.article) || articleInLemma(language as Language, c.lemma)) || !str(c.plural) || !str(c.gender);
  if (language === 'ru') return !str(c.gender) || !str(c.plural);
  if (language === 'zh') return !str(c.classifier) || !str(c.romanization);
  return false; // en: el artículo es opcional (uso natural)
}

// [applyGrammar]: completa SOLO lo que falta (lo escrito por el docente manda) | null = nada que cambiar
export function applyGrammar(language: string, c: Content, r: NounGrammarResult): Content | null {
  const g = r.grammar;
  if (!r.checked || !g.is_noun) return null;
  const next: Content = { ...c, partOfSpeech: str(c.partOfSpeech) || 'sustantivo' };
  if (!str(next.gender) && g.gender) next.gender = GENDER_ES[g.gender];
  if (!str(next.plural) && g.plural) next.plural = g.plural_article ? `${g.plural_article} ${g.plural}` : g.plural;
  if (WITH_ARTICLE.has(language) && !str(next.article) && g.article) next.article = g.article;
  if (language === 'zh') {
    if (!str(next.classifier) && (g.measure_example || g.classifier)) next.classifier = g.measure_example || g.classifier;
    if (!str(next.romanization) && g.pinyin) next.romanization = g.pinyin;
  }
  withArticle(language as Language, next); // «Tisch» + der → «der Tisch»
  return JSON.stringify(next) === JSON.stringify(c) ? null : next;
}

// [termWithArticle]: un término suelto (juegos, políglota) → con su artículo («Tisch» → «der Tisch», «book» → «a book») | sin datos fiables → igual
export function termWithArticle(language: string, term: string, r: NounGrammarResult | null): string {
  const t = term.trim();
  if (!t || articleInLemma(language as Language, t)) return t;
  if (!r?.checked || !r.grammar.is_noun) return t;
  const g = r.grammar;
  if (WITH_ARTICLE.has(language)) {
    const art = normalizeArticle(g.article) || articleFor(language, r.lemma || t, g.gender);
    return art && VOCAB_ARTICLES[language as Language].includes(art) && !PLURAL_ARTICLES.has(art) ? join(art, r.lemma || t) : t;
  }
  if (language === 'en' && g.countable !== false && (g.article === 'a' || g.article === 'an')) return `${g.article} ${t}`;
  return t;
}

// [grammarNote · 2026-11-16 · Regla obligatoria de vocabulario]: nota corta para la tabla de Poliglota — plural y género (de/fr/pt/es),
// contable/incontable (en), género y plural (ru), clasificador con pinyin (zh) · «» si no hay datos fiables | Función pura
export function grammarNote(language: string, r: NounGrammarResult | null): string {
  if (!r?.checked || !r.grammar.is_noun) return '';
  const g = r.grammar;
  const gender = g.gender ? GENDER_ES[g.gender] : '';
  const plural = g.plural ? `${g.plural_article ? `${g.plural_article} ` : ''}${g.plural}` : '';
  const parts =
    language === 'zh'
      ? [[g.measure_example || g.classifier, g.pinyin && `(${g.pinyin})`].filter(Boolean).join(' ')]
      : language === 'en'
        ? [g.countable === false ? 'incontable' : g.countable ? 'contable' : '', g.countable !== false && plural ? `pl. ${plural}` : '']
        : [gender, plural && `pl. ${plural}`];
  return parts.filter(Boolean).join(' · ').slice(0, 160);
}
