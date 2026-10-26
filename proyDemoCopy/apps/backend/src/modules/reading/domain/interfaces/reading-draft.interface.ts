import type { ReadingGenre } from '../reading-genre';
// [Port ReadingDraftPort · Lectura · 2026-10-25]: borrador de un texto de lectura (título, resumen y párrafos) sin que el caso de uso conozca Ollama | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const READING_DRAFT = Symbol('READING_DRAFT');

export interface ReadingDraftRequest {
  language: string;
  level: string;
  genre: ReadingGenre;
  topic: string;
  words: number; // Longitud aproximada (60–600 palabras)
  sourceText?: string; // Material importado en el que basarse (resumir/adaptar al nivel)
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
