import type { ReadingGenre } from '../reading-genre';
// [Port ReadingDraftPort · Lectura · 2026-10-25]: borrador de un texto de lectura (título, resumen y párrafos) sin que el caso de uso conozca Ollama | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const READING_DRAFT = Symbol('READING_DRAFT');
// [Límites de longitud · 2026-10-28]: SSOT del DTO (@Min/@Max) y del adaptador | `as const` (TS): literales inmutables
// Antes el techo era 600 palabras → un C1/C2 con ≥ 6 párrafos × 5 frases no cabía
export const MIN_DRAFT_WORDS = 60;
export const MAX_DRAFT_WORDS = 900;

export interface ReadingDraftRequest {
  language: string;
  level: string;
  genre: ReadingGenre;
  topic: string;
  words: number; // Longitud aproximada (MIN_DRAFT_WORDS–MAX_DRAFT_WORDS palabras; el adaptador nunca baja del mínimo del nivel)
  sourceText?: string; // Material importado en el que basarse (resumir/adaptar al nivel)
  kind?: 'reading' | 'dictation'; // [2026-11-16]: dictado → forma corta (DICTATION_SHAPE) para que el modelo local no agote el plazo
}

export interface ReadingDraft {
  title: string;
  summary: string; // En español
  paragraphs: string[];
  model: string;
}

export interface ReadingDraftPort {
  draft(req: ReadingDraftRequest): Promise<ReadingDraft>;
}
