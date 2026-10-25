import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Score } from '../../domain/entities/score.entity';
import type {
  CreateScoreInput,
  IScoreRepository,
  LeaderboardEntry,
} from '../../domain/interfaces/score.repository.interface';
// [Adapter TypeORM]: implementa IScoreRepository | [Patron]: Repository + Adapter | [Principio]: DIP | [Paradigma]: POO

@Injectable()
export class ScoreRepository implements IScoreRepository {
  constructor(
    @InjectRepository(Score)
    private readonly repo: Repository<Score>,
  ) {}

  async create(input: CreateScoreInput): Promise<Score> {
    const accuracy =
      input.totalQuestions > 0 ? input.correctCount / input.totalQuestions : 0;
    const entity = this.repo.create({ ...input, accuracy });
    return this.repo.save(entity);
  }

  async findByUser(userId: string, limit = 20, since?: Date): Promise<Score[]> {
    return this.repo.find({
      // [Ventana temporal]: createdAt >= since cuando se solicita un periodo | [Patrón]: Time Window
      where: since ? { userId, createdAt: MoreThanOrEqual(since) } : { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // [Leaderboard]: GROUP BY userId + agregaciones + join nombre del usuario | [Patron]: Query
  async getLeaderboard(
    limit = 10,
    since?: Date,
    section?: string,
  ): Promise<LeaderboardEntry[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      // [Join suave a users]: tabla en el mismo schema; concatena nombre para display | [Patrón]: Read Join
      .addSelect('u.first_name', 'firstName')
      .addSelect('u.last_name', 'lastName')
      .addSelect('SUM(s.points)', 'totalPoints')
      .addSelect('COUNT(s.id)', 'quizzesCompleted')
      .addSelect('AVG(s.accuracy)', 'avgAccuracy')
      .leftJoin('users', 'u', 'u.id = s.user_id');
    // [Ventana temporal]: solo scores recientes según periodo | [Patrón]: Time Window
    if (since) qb.andWhere('s.created_at >= :since', { since });
    // [Filtro por sección]: solo estudiantes de esa sección | [Patrón]: Scoped Filter
    if (section) qb.andWhere('u.section = :section', { section });
    const raw = await qb
      .groupBy('s.user_id')
      .addGroupBy('u.first_name')
      .addGroupBy('u.last_name')
      .orderBy('"totalPoints"', 'DESC')
      .limit(limit)
      .getRawMany<{
        userId: string;
        firstName: string | null;
        lastName: string | null;
        totalPoints: string;
        quizzesCompleted: string;
        avgAccuracy: string;
      }>();

    return raw.map((r) => {
      const name = [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
      return {
        userId: r.userId,
        // [Fallback]: si no hay nombre (usuario borrado), id corto legible | [Patrón]: Graceful Degradation
        displayName: name || `Usuario ${r.userId.slice(0, 6)}`,
        totalPoints: Number(r.totalPoints),
        quizzesCompleted: Number(r.quizzesCompleted),
        avgAccuracy: Number(r.avgAccuracy),
      };
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.repo.count({ where: { userId } });
  }

  async sumPointsByUser(userId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.points), 0)', 'total')
      .where('s.user_id = :uid', { uid: userId })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }
}
