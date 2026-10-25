import { Achievement, AchievementCode } from '../entities/achievement.entity';
// [Port achievement repo] | [Patron]: Repository + Port | [Principio]: DIP + ISP

export const ACHIEVEMENT_REPOSITORY = Symbol('ACHIEVEMENT_REPOSITORY');

export interface IAchievementRepository {
  hasAchievement(userId: string, code: AchievementCode): Promise<boolean>;
  unlock(
    userId: string,
    code: AchievementCode,
    title: string,
    description?: string,
  ): Promise<Achievement>;
  listByUser(userId: string): Promise<Achievement[]>;
}
