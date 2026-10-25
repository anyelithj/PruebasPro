import { CheckAchievementsUseCase } from '../../../../src/modules/score/application/use-cases/check-achievements.use-case';
import { AchievementCode } from '../../../../src/modules/score/domain/entities/achievement.entity';
import { ACHIEVEMENT_UNLOCKED_EVENT } from '../../../../src/modules/score/domain/events/achievement-unlocked.event';

// [Suite CheckAchievementsUseCase]: motor de reglas, dedup por logro ya desbloqueado, eventos

describe('CheckAchievementsUseCase', () => {
  let useCase: CheckAchievementsUseCase;
  let achievements: { hasAchievement: jest.Mock; unlock: jest.Mock };
  let scores: { countByUser: jest.Mock; sumPointsByUser: jest.Mock };
  let events: { emit: jest.Mock };

  beforeEach(() => {
    achievements = { hasAchievement: jest.fn().mockResolvedValue(false), unlock: jest.fn() };
    scores = { countByUser: jest.fn(), sumPointsByUser: jest.fn() };
    events = { emit: jest.fn() };
    useCase = new CheckAchievementsUseCase(
      achievements as any,
      scores as any,
      events as any,
    );
    achievements.unlock.mockImplementation(async (userId, code, title) => ({
      id: code,
      userId,
      code,
      title,
    }));
  });

  it('desbloquea FIRST_QUIZ y PERFECT_SCORE con 1 quiz y accuracy 1', async () => {
    scores.countByUser.mockResolvedValue(1);
    scores.sumPointsByUser.mockResolvedValue(300);

    const unlocked = await useCase.execute('u1', 1);
    const codes = unlocked.map((a) => a.code);

    expect(codes).toContain(AchievementCode.FIRST_QUIZ);
    expect(codes).toContain(AchievementCode.PERFECT_SCORE);
    expect(codes).not.toContain(AchievementCode.POINTS_1000);
    expect(events.emit).toHaveBeenCalledWith(
      ACHIEVEMENT_UNLOCKED_EVENT,
      expect.objectContaining({ userId: 'u1' }),
    );
  });

  it('desbloquea hitos de puntos cuando se alcanzan los umbrales', async () => {
    scores.countByUser.mockResolvedValue(10);
    scores.sumPointsByUser.mockResolvedValue(5000);

    const codes = (await useCase.execute('u1', 0.5)).map((a) => a.code);
    expect(codes).toContain(AchievementCode.POINTS_1000);
    expect(codes).toContain(AchievementCode.POINTS_5000);
    expect(codes).not.toContain(AchievementCode.PERFECT_SCORE);
  });

  it('no re-desbloquea logros ya existentes', async () => {
    scores.countByUser.mockResolvedValue(1);
    scores.sumPointsByUser.mockResolvedValue(0);
    achievements.hasAchievement.mockResolvedValue(true);

    const unlocked = await useCase.execute('u1', 0.5);
    expect(unlocked).toHaveLength(0);
    expect(achievements.unlock).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('no desbloquea nada si ninguna regla se cumple', async () => {
    scores.countByUser.mockResolvedValue(0);
    scores.sumPointsByUser.mockResolvedValue(0);
    const unlocked = await useCase.execute('u1', 0.4);
    expect(unlocked).toHaveLength(0);
  });
});
