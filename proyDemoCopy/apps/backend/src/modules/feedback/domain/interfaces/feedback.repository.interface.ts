import type { GradingStrategy } from '../entities/feedback-ia.entity';

export const FEEDBACK_REPOSITORY = Symbol('FEEDBACK_REPOSITORY');

export interface CreateFeedbackInput {
  sessionId: string;
  questionId: string;
  userId: string;
  content: string;
  suggestion?: string | null;
  score: number;
  isCorrect: boolean;
  confidence?: number | null;
  model: string;
  strategyUsed: GradingStrategy;
  latencyMs?: number | null;
}

export interface IFeedbackRepository {
  create(input: CreateFeedbackInput): Promise<{ id: string }>;
}
