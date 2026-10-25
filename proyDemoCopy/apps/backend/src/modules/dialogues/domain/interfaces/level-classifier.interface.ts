import type { LevelEstimate } from '../entities/dialogue.entity';
// [Port LevelClassifierPort · Sprint 9.3 · RF-126]: nivel CEFR estimado de un diálogo (FastAPI LevelClassifier) sin que los casos de uso conozcan HTTP | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

export const LEVEL_CLASSIFIER = Symbol('LEVEL_CLASSIFIER');

export interface LevelClassifierPort {
  classify(
    input: { language: string; turns: string[] },
    token: string,
  ): Promise<LevelEstimate>;
}
