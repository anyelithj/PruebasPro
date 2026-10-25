import { AchievementCode } from '../entities/achievement.entity';
// [Domain Event AchievementUnlocked]: para SSE notification al frontend | [Patron]: Observer | [Paradigma]: Event-Driven

export const ACHIEVEMENT_UNLOCKED_EVENT = 'achievement.unlocked';

export class AchievementUnlockedEvent {
  constructor(
    public readonly userId: string,
    public readonly code: AchievementCode,
    public readonly title: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
