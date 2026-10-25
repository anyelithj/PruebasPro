// [Fixtures Diccionario, Poliglota y Gramática · Fase 10]: consulta de palabra, palabras marcadas, tema con su tabla, vista guardada y ficha de gramática con la forma de NestJS | [Patrón]: Test Data Builder | [Principio]: DRY (specs de core/dictionary, polyglot y grammar)

export const wordLookup = (over: Record<string, unknown> = {}) => ({
  id: 'w1',
  language: 'en',
  text: 'run',
  result: {
    word: 'run',
    lemma: 'run',
    translation: 'correr',
    ipa: null,
    ipa_uk: 'rʌn-uk',
    ipa_us: 'rʌn-us',
    examples: ['I run every morning.', 'She runs fast.'],
    ...over,
  },
});

export const marked = (term: string, status: 'learning' | 'learned' = 'learning', id = `m-${term}`) => ({
  id,
  language: 'en',
  term,
  termKey: term.toLowerCase(),
  status,
});

export const pgTopic = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  slug: 'familia',
  title: 'Familia',
  emoji: '👨‍👩‍👧',
  description: '',
  status: 'published',
  createdBy: null,
  ...over,
});

export const term = (language: string, text: string, over: Record<string, unknown> = {}) => ({
  id: `t-${language}-${text}`,
  conceptId: 'c1',
  language,
  text,
  ipa: `ipa-${text}`,
  ipaUs: language === 'en' ? `us-${text}` : null,
  reviewed: false,
  needsNativeReview: language === 'ru' || language === 'zh',
  ...over,
});

export const pgTable = (languages = ['en', 'de', 'fr', 'pt', 'ru', 'zh', 'es']) => ({
  topic: pgTopic(),
  languages,
  rows: [
    {
      concept: { id: 'c1', topicId: 'p1', position: 0, kind: 'word', emoji: '👩', imageUrl: null, imageLicense: null, gloss: 'madre' },
      terms: Object.fromEntries(
        languages.map((l) => [l, l === 'pt' ? null : term(l, { en: 'mother', de: 'Mutter', fr: 'mère', ru: 'мать', zh: '母亲', es: 'madre' }[l] ?? l)]),
      ),
    },
  ],
});

export const pgView = { id: 'v1', topicId: 'p1', name: 'Familia ES-EN', languages: ['es', 'en'], updatedAt: '' };

export const gTopic = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  slug: 'present-simple',
  title: 'Present Simple',
  summary: 'Hábitos y rutinas.',
  language: 'en',
  levels: ['A1'],
  status: 'published',
  model: null,
  createdBy: null,
  ...over,
});

export const gExample = (id: string, text: string, over: Record<string, unknown> = {}) => ({
  id,
  sectionId: 's1',
  position: 0,
  text,
  ipa: `uk-${id}`,
  ipaUs: `us-${id}`,
  translation: `es-${id}`,
  reviewed: false,
  ...over,
});

export const gDetail = (over: Record<string, unknown> = {}) => ({
  ...gTopic(over),
  sections: [
    { id: 's1', topicId: 'g1', position: 0, type: 'usage', title: '', body: 'Hábitos y rutinas.', examples: [gExample('e1', 'I drink coffee every morning.')] },
    { id: 's2', topicId: 'g1', position: 1, type: 'formula', title: '', body: 'Sujeto + verbo (+s)', examples: [] },
  ],
});
