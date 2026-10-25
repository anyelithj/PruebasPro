import { Inject, Injectable } from '@nestjs/common';
import { monthsToSince } from '../../../../shared/utils/period.util';
import {
  QUIZ_REPOSITORY,
  type IQuizRepository,
} from '../../../quiz/domain/interfaces/quiz.repository.interface';
import {
  SCORE_REPOSITORY,
  type IScoreRepository,
} from '../../../score/domain/interfaces/score.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import type { ReportData } from '../../domain/report-data';
// [Query ReportData · Sprint 6.4]: reúne los MISMOS agregados que /admin/reports desde los puertos de Users, Score y Quiz | [Patrón]: Query (CQRS-lite) + Aggregator | [Principio]: DIP (puertos, no tablas ajenas) + DRY | [Paradigma]: POO + async/await

const LEADERBOARD_SIZE = 20; // Igual que la pantalla de reportes
const MAX_QUIZZES = 100;

@Injectable()
export class ReportDataQuery {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(SCORE_REPOSITORY) private readonly scores: IScoreRepository,
    @Inject(QUIZ_REPOSITORY) private readonly quizzes: IQuizRepository,
  ) {}

  async execute(periodMonths: number | null): Promise<ReportData> {
    // `Promise.all` (ES2015): las tres fuentes en paralelo
    const [byRole, leaderboard, quizzes] = await Promise.all([
      this.users.countByRole(),
      this.scores.getLeaderboard(
        LEADERBOARD_SIZE,
        monthsToSince(periodMonths ?? undefined),
      ),
      this.quizzes.listQuizzes({ limit: MAX_QUIZZES }),
    ]);
    return {
      generatedAt: new Date(),
      periodMonths,
      users: {
        total: Object.values(byRole).reduce((s, n) => s + n, 0),
        byRole,
      },
      leaderboard,
      quizzes: quizzes.data.map((q) => ({
        title: q.title,
        category: q.category,
        difficulty: q.difficulty,
        language: q.language,
        isPublished: q.isPublished,
        createdAt: q.createdAt,
      })),
    };
  }
}
