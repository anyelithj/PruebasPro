import type { ConceptKind } from '../entities/polyglot-concept.entity';
// [Port PolyglotDraftPort · Sprint 10.6 · RF-132]: borrador de un tema en los siete idiomas (conceptos con emoji y un término por idioma) sin que el caso de uso conozca Ollama | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const POLYGLOT_DRAFT = Symbol('POLYGLOT_DRAFT');

export interface DraftConcept {
  kind: ConceptKind;
  emoji: string;
  gloss: string; // Significado en español
  terms: Record<string, string>; // idioma → término (en, de, fr, pt, ru, zh, es)
}

export interface PolyglotDraftPort {
  draft(input: {
    topic: string;
    kind: ConceptKind;
    count: number;
    exclude: string[]; // Glosas que el tema ya tiene (no repetir)
  }): Promise<{ concepts: DraftConcept[]; model: string }>;
}
