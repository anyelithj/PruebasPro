import { CalculateScoreUseCase } from '../../../../src/modules/score/application/use-cases/calculate-score.use-case';

// [Suite CalculateScoreUseCase]: función pura de scoring agregado con bono de perfección

describe('CalculateScoreUseCase', () => {
  let useCase: CalculateScoreUseCase;

  beforeEach(() => {
    useCase = new CalculateScoreUseCase();
  });

  it('100% aciertos: aplica bono de perfección del 20%', () => {
    const res = useCase.execute({
      sessionPoints: 1000,
      correctCount: 5,
      totalQuestions: 5,
    });
    expect(res.accuracy).toBe(1);
    expect(res.perfectBonus).toBe(200);
    expect(res.points).toBe(1200);
  });

  it('aciertos parciales: sin bono, accuracy proporcional', () => {
    const res = useCase.execute({
      sessionPoints: 600,
      correctCount: 3,
      totalQuestions: 4,
    });
    expect(res.accuracy).toBe(0.75);
    expect(res.perfectBonus).toBe(0);
    expect(res.points).toBe(600);
  });

  it('sin preguntas: accuracy 0 y sin bono (evita división por cero)', () => {
    const res = useCase.execute({
      sessionPoints: 0,
      correctCount: 0,
      totalQuestions: 0,
    });
    expect(res.accuracy).toBe(0);
    expect(res.perfectBonus).toBe(0);
    expect(res.points).toBe(0);
  });
});
