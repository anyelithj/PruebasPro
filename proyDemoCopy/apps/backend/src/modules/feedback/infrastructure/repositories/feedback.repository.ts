import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackIA } from '../../domain/entities/feedback-ia.entity';
import type {
  CreateFeedbackInput,
  IFeedbackRepository,
} from '../../domain/interfaces/feedback.repository.interface';

@Injectable()
export class TypeOrmFeedbackRepository implements IFeedbackRepository {
  constructor(
    @InjectRepository(FeedbackIA)
    private readonly repo: Repository<FeedbackIA>,
  ) {}

  async create(input: CreateFeedbackInput): Promise<{ id: string }> {
    const entity = this.repo.create({
      sessionId: input.sessionId,
      questionId: input.questionId,
      userId: input.userId,
      content: input.content,
      suggestion: input.suggestion ?? null,
      score: input.score,
      isCorrect: input.isCorrect,
      confidence: input.confidence ?? null,
      model: input.model,
      strategyUsed: input.strategyUsed,
      latencyMs: input.latencyMs ?? null,
    });
    const saved = await this.repo.save(entity);
    return { id: saved.id };
  }
}
