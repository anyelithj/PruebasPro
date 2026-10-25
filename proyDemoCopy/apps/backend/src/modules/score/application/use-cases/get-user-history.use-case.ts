import { Inject, Injectable } from '@nestjs/common';
import { SCORE_REPOSITORY } from '../../domain/interfaces/score.repository.interface';
import type { IScoreRepository } from '../../domain/interfaces/score.repository.interface';
import { Score } from '../../domain/entities/score.entity';
import { monthsToSince } from '../../../../shared/utils/period.util';
// [Use Case GetUserHistory]: historial de scores del usuario, filtrable por periodo | [Patron]: Query | [Principio]: SRP

@Injectable()
export class GetUserHistoryUseCase {
  constructor(
    @Inject(SCORE_REPOSITORY) private readonly repo: IScoreRepository,
  ) {}

  async execute(userId: string, limit = 20, months?: number): Promise<Score[]> {
    return this.repo.findByUser(userId, limit, monthsToSince(months));
  }
}
