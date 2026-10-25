// [Port LanguageToolsPort · shared/domain · Sprints 8.2/9.1]: traducción e IPA (FastAPI LanguageTools) sin que los casos de uso conozcan HTTP — compartido por Vocabulary, Music y Dialogues y, en la Fase 10, Polyglot y Grammar | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP + DRY | [Paradigma]: POO

export const LANGUAGE_TOOLS = Symbol('LANGUAGE_TOOLS');

// [Contratos]: espejo de LookupResponse y WordResponse de FastAPI (snake_case del cable)
export interface TermLookupResult {
  text: string;
  language: string;
  translation: {
    translation: string;
    alternatives: string[];
    tone: 'formal' | 'informal' | 'neutral';
    model: string; // 'unavailable' = el LLM no respondió (no se cachea)
  };
  ipa_uk: string | null;
  ipa_us: string | null;
  ipa: string | null;
  engine: string;
}

export interface WordLookupResult {
  word: string;
  lemma: string | null;
  translation: string;
  ipa_uk: string | null;
  ipa_us: string | null;
  ipa: string | null;
  examples: string[];
  engine: string;
}

// [Sprint 9.1]: espejo de LinesResponse de FastAPI — traducción al español e IPA por línea (canciones y diálogos)
export interface EnrichedLine {
  index: number;
  text: string;
  translation: string | null; // null si el contenido ya está en español
  ipa: string; // Variante por defecto del idioma (en: en-GB)
  ipa_us: string | null; // Solo inglés
}
export interface LinesResult {
  lines: EnrichedLine[];
  engine: string;
  needs_native_review: boolean; // Chino mandarín y ruso
}

// [Sprint 10.5/10.9]: IPA sin traducción (fonetizador de FastAPI) — términos poliglota y ejemplos de gramática
export interface IpaOnlyResult {
  ipa: string; // Variante por defecto del idioma (en: en-GB)
  ipa_us: string | null; // Solo inglés
  engine: string;
}

export interface LanguageToolsPort {
  lookup(
    text: string,
    language: string,
    token: string,
  ): Promise<TermLookupResult>;
  word(
    word: string,
    sentence: string,
    language: string,
    token: string,
  ): Promise<WordLookupResult>;
  lines(lines: string[], language: string, token: string): Promise<LinesResult>; // [Sprint 9.1]: Music y Dialogues
  ipa(text: string, language: string, token: string): Promise<IpaOnlyResult>; // [Sprint 10.5]: Polyglot (sin LLM: determinista)
  translate(text: string, source: string, target: string, token: string): Promise<{ translation: string }>; // [2026-10-19]: título de tema español → idioma estudiado
}
