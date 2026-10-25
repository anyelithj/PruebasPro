import { Inject, Injectable } from '@nestjs/common';
import type { GradingStrategy } from '../../domain/entities/feedback-ia.entity';
import {
  FEEDBACK_REPOSITORY,
  type IFeedbackRepository,
} from '../../domain/interfaces/feedback.repository.interface';

export interface SaveFeedbackInput {
  sessionId: string;
  questionId: string;
  userId: string;
  content: string;
  suggestion?: string | null;
  score: number;
  isCorrect: boolean;
  confidence?: number | null;
  model: string;
  strategyUsed: string;
  latencyMs?: number | null;
}

@Injectable()
export class SaveFeedbackUseCase {
  constructor(
    @Inject(FEEDBACK_REPOSITORY)
    private readonly repo: IFeedbackRepository,
  ) {}

  async execute(input: SaveFeedbackInput): Promise<{ id: string }> {
    return this.repo.create({
      ...input,
      strategyUsed: input.strategyUsed as GradingStrategy,
    });
  }
}
