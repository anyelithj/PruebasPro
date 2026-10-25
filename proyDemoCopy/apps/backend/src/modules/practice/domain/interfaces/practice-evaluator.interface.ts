// [Port PracticeEvaluatorPort · Sprint 8.12]: evaluación de un intento (FastAPI Grading /grading/practice) sin que el caso de uso conozca HTTP | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO
import type { ItemType, Skill } from '../item-type';

export const PRACTICE_EVALUATOR = Symbol('PRACTICE_EVALUATOR');

export interface EvaluateInput {
  item_type: ItemType;
  skill: Skill;
  language: string;
  prompt: string;
  answer: string[];
  accepted: string[][];
  corrections: Record<string, string>;
  explanation: string;
  tip: string;
}

export interface Finding {
  type: string; // grammar | vocabulary | word_order | …
  original: string;
  correction: string;
  explanation_es: string;
  start: number | null;
  end: number | null;
}

export interface EvaluateResult {
  correct: boolean;
  score: number;
  findings: Finding[];
  correct_answer: string;
  explanation: string;
  tip: string;
  method: 'deterministic' | 'semantic' | 'llm';
}

export interface PracticeEvaluatorPort {
  evaluate(input: EvaluateInput, token: string): Promise<EvaluateResult>;
}
