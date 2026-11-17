// [nounRulePrompt · 2026-11-03 · Regla obligatoria de vocabulario]: instrucción para los generadores con IA (juegos, políglota…) → cada sustantivo con su artículo/clasificador
// [Principio]: DRY (una sola redacción de la regla para todos los prompts) · espejo de ai-service/.../domain/noun_grammar.py | [Paradigma]: función pura
const RULE: Record<string, string> = {
  de: 'Every German noun MUST carry its definite article (der/die/das), e.g. "der Tisch", "die Lampe", "das Buch" — never a bare noun.',
  fr: `Every French noun MUST carry its definite article (le/la/l'), e.g. "le livre", "la maison", "l'école" — never a bare noun.`,
  pt: 'Every Portuguese noun MUST carry its definite article (o/a), e.g. "o livro", "a casa" — never a bare noun.',
  es: 'Every Spanish noun MUST carry its definite article (el/la), e.g. "el libro", "la mesa" — never a bare noun.',
  en: 'English nouns: use a/an/the only when natural ("a book", "an apple"); uncountable nouns go without article ("water").',
  ru: 'Russian has no articles: give the noun in nominative singular.',
  zh: 'Chinese has no articles: for nouns give the measure word with the number one, e.g. "一本书", "一个人", "一张桌子".',
};

export const nounRulePrompt = (language: string): string => RULE[language] ?? '';
