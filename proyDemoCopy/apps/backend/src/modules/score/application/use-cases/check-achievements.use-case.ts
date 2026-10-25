import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Achievement,
  AchievementCode,
} from '../../domain/entities/achievement.entity';
import { ACHIEVEMENT_REPOSITORY } from '../../domain/interfaces/achievement.repository.interface';
import type { IAchievementRepository } from '../../domain/interfaces/achievement.repository.interface';
import { SCORE_REPOSITORY } from '../../domain/interfaces/score.repository.interface';
import type { IScoreRepository } from '../../domain/interfaces/score.repository.interface';
import {
  ACHIEVEMENT_UNLOCKED_EVENT,
  AchievementUnlockedEvent,
} from '../../domain/events/achievement-unlocked.event';
// [Use Case CheckAchievements]: listener de ScoreUpdated evalua reglas | [Patron]: Observer + Rules Engine | [Principio]: SRP + OCP | [Paradigma]: POO

// [Reglas]: cada regla = (codigo, titulo, predicado) | [Patron]: Strategy
interface Rule {
  code: AchievementCode;
  title: string;
  description: string;
  shouldUnlock: (stats: UserStats) => boolean;
}

interface UserStats {
  quizzesCompleted: number;
  totalPoints: number;
  lastAccuracy: number;
}

const RULES: Rule[] = [
  {
    code: AchievementCode.FIRST_QUIZ,
    title: 'Primer quiz',
    description: 'Completaste tu primer quiz.',
    shouldUnlock: (s) => s.quizzesCompleted >= 1,
  },
  {
    code: AchievementCode.PERFECT_SCORE,
    title: 'Puntaje perfecto',
    description: '100% de aciertos en un quiz.',
    shouldUnlock: (s) => s.lastAccuracy === 1,
  },
  {
    code: AchievementCode.POINTS_1000,
    title: '1.000 puntos',
    description: 'Acumulaste 1.000 puntos.',
    shouldUnlock: (s) => s.totalPoints >= 1000,
  },
  {
    code: AchievementCode.POINTS_5000,
    title: '5.000 puntos',
    description: 'Acumulaste 5.000 puntos.',
    shouldUnlock: (s) => s.totalPoints >= 5000,
  },
];

@Injectable()
export class CheckAchievementsUseCase {
  private readonly logger = new Logger(CheckAchievementsUseCase.name);

  constructor(
    @Inject(ACHIEVEMENT_REPOSITORY)
    private readonly achievements: IAchievementRepository,
    @Inject(SCORE_REPOSITORY) private readonly scores: IScoreRepository,
    private readonly events: EventEmitter2,
  ) {}

  // [execute]: re-evalua todas las reglas tras un score nuevo | [Principio]: OCP
  async execute(userId: string, lastAccuracy: number): Promise<Achievement[]> {
    const [quizzesCompleted, totalPoints] = await Promise.all([
      this.scores.countByUser(userId),
      this.scores.sumPointsByUser(userId),
    ]);
    const stats: UserStats = { quizzesCompleted, totalPoints, lastAccuracy };

    const unlocked: Achievement[] = [];
    for (const rule of RULES) {
      if (!rule.shouldUnlock(stats)) continue;
      const already = await this.achievements.hasAchievement(userId, rule.code);
      if (already) continue;
      const ach = await this.achievements.unlock(
        userId,
        rule.code,
        rule.title,
        rule.description,
      );
      unlocked.push(ach);
      this.events.emit(
        ACHIEVEMENT_UNLOCKED_EVENT,
        new AchievementUnlockedEvent(userId, rule.code, rule.title),
      );
      this.logger.log(`Achievement unlocked: ${userId} → ${rule.code}`);
    }
    return unlocked;
  }
}
