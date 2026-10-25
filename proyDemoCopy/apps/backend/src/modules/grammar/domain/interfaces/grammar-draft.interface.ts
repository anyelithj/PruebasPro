import type { SectionType } from '../section-type';
// [Port GrammarDraftPort · Sprint 10.10 · RF-135]: borrador de una ficha de gramática (secciones y ejemplos) sin que el caso de uso conozca Ollama | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const GRAMMAR_DRAFT = Symbol('GRAMMAR_DRAFT');

export interface DraftSection {
  type: SectionType;
  title: string;
  body: string;
  examples: string[];
}

export interface GrammarDraftPort {
  draft(input: {
    title: string;
    language: string;
    level: string;
  }): Promise<{ summary: string; sections: DraftSection[]; model: string }>;
}
