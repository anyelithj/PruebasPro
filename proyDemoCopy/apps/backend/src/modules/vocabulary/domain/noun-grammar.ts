// [NounGrammar · 2026-11-03 · Regla obligatoria de vocabulario]: cada sustantivo se guarda como unidad gramatical completa
// de/fr/pt/es → artículo definido + género + plural · en → contable/incontable (+ a/an/the) · ru → género + plural · zh → pinyin + clasificador
// [Patrón]: Value Object + Specification (`missingGrammar`) | [Principio]: espejo de ai-service/.../domain/noun_grammar.py (la IA propone ahí; aquí se revalida tras una edición manual)

export interface NounGrammar {
  is_noun: boolean;
  article?: string | null;
  gender?: 'm' | 'f' | 'n' | null;
  plural?: string | null;
  plural_article?: string | null;
  countable?: boolean | null;
  pinyin?: string | null;
  classifier?: string | null;
  measure_example?: string | null;
  cases?: Record<string, string>;
}

// [Snapshot guardado en vocabulary_entries.grammar]: datos + texto de la tarjeta + lo que falta | `checked=false` → la IA no respondió (se reintenta)
export interface GrammarSnapshot extends NounGrammar {
  lemma?: string;
  headword: string;
  missing: string[];
  checked: boolean;
}

const REQUIRED: Record<string, (keyof NounGrammar)[]> = {
  de: ['article', 'gender', 'plural'],
  fr: ['article', 'gender', 'plural'],
  pt: ['article', 'gender', 'plural'],
  es: ['article', 'gender', 'plural'],
  ru: ['gender', 'plural'],
  en: ['countable'],
  zh: ['pinyin', 'classifier'],
};
const DEFINITE: Record<string, Record<string, [string, string]>> = {
  de: { m: ['der', 'die'], f: ['die', 'die'], n: ['das', 'die'] },
  fr: { m: ['le', 'les'], f: ['la', 'les'] },
  pt: { m: ['o', 'os'], f: ['a', 'as'] },
  es: { m: ['el', 'los'], f: ['la', 'las'] },
};

export const missingGrammar = (language: string, g: NounGrammar): string[] =>
  !g.is_noun
    ? []
    : (REQUIRED[language] ?? []).filter(
        (f) => (g[f] ?? '') === '' && !(f === 'plural' && g.countable === false),
      );

// [isGrammarComplete]: null (sin revisar) o checked=false → pendiente | se usa para reparar entradas viejas y para avisar en la UI
export const isGrammarComplete = (s: GrammarSnapshot | null): boolean =>
  !!s && s.checked && s.missing.length === 0;

// [applyManualGrammar]: edición manual → artículo coherente con el género (der/die/das, le/la/l'…) y faltantes recalculados | función pura
export function applyManualGrammar(
  language: string,
  term: string,
  prev: GrammarSnapshot | null,
  patch: Partial<NounGrammar>,
): GrammarSnapshot {
  const g: NounGrammar = { ...(prev ?? { is_noun: true }), ...patch };
  const lemma = prev?.lemma ?? term;
  const pair = g.gender ? DEFINITE[language]?.[g.gender] : undefined;
  if (pair) {
    g.article = language === 'fr' && /^[aeiouyhâàéèêëîïôûùœ]/i.test(lemma) ? "l'" : pair[0];
    g.plural_article = pair[1];
  }
  const sing = g.article === "l'" ? `l'${lemma}` : [g.article, lemma].filter(Boolean).join(' ');
  const headword = !g.is_noun
    ? lemma
    : pair
      ? g.plural ? `${sing} – ${g.plural_article} ${g.plural}` : sing
      : language === 'ru'
        ? `${lemma} (${g.gender ?? '?'})${g.plural ? ` – ${g.plural}` : ''}`
        : language === 'zh'
          ? `${g.measure_example ?? lemma}${g.pinyin ? ` (${g.pinyin})` : ''}`
          : sing;
  return { ...g, lemma, headword, missing: missingGrammar(language, g), checked: true };
}
