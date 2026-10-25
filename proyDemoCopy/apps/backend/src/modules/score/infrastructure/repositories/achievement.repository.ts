import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Achievement,
  AchievementCode,
} from '../../domain/entities/achievement.entity';
import type { IAchievementRepository } from '../../domain/interfaces/achievement.repository.interface';
// [Adapter TypeORM]: implementa IAchievementRepository | [Patron]: Repository + Adapter | [Principio]: DIP

@Injectable()
export class AchievementRepository implements IAchievementRepository {
  constructor(
    @InjectRepository(Achievement)
    private readonly repo: Repository<Achievement>,
  ) {}

  async hasAchievement(
    userId: string,
    code: AchievementCode,
  ): Promise<boolean> {
    return this.repo.exists({ where: { userId, code } });
  }

  async unlock(
    userId: string,
    code: AchievementCode,
    title: string,
    description?: string,
  ): Promise<Achievement> {
    const entity = this.repo.create({ userId, code, title, description });
    return this.repo.save(entity);
  }

  async listByUser(userId: string): Promise<Achievement[]> {
    return this.repo.find({
      where: { userId },
      order: { unlockedAt: 'DESC' },
    });
  }
}
