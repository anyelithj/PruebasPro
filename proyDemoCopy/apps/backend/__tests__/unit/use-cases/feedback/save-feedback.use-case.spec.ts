import { SaveFeedbackUseCase } from '../../../../src/modules/feedback/application/use-cases/save-feedback.use-case';

// [Suite SaveFeedbackUseCase]: persiste feedback IA en tabla feedback_ia | [Patrón]: Command | [Principio]: SRP

describe('SaveFeedbackUseCase', () => {
  let useCase: SaveFeedbackUseCase;
  let repo: { create: jest.Mock };

  beforeEach(() => {
    repo = { create: jest.fn() };
    useCase = new SaveFeedbackUseCase(repo as any);
  });

  const sampleInput = {
    sessionId: 's1',
    questionId: 'q1',
    userId: 'u1',
    content: 'Tu respuesta es incorrecta. La respuesta correcta es 4.',
    suggestion: 'Repasa el tema de operaciones básicas.',
    score: 0,
    isCorrect: false,
    confidence: 0.95,
    model: 'ai-service',
    strategyUsed: 'similarity',
    latencyMs: 1200,
  };

  it('persiste feedback correctamente y retorna id', async () => {
    repo.create.mockResolvedValue({ id: 'fb1' });
    const result = await useCase.execute(sampleInput);
    expect(result).toEqual({ id: 'fb1' });
    expect(repo.create).toHaveBeenCalledWith({
      ...sampleInput,
      strategyUsed: 'similarity',
    });
  });

  it('funciona sin campos opcionales', async () => {
    const minimal = {
      sessionId: 's1',
      questionId: 'q1',
      userId: 'u1',
      content: 'Incorrecto',
      score: 0,
      isCorrect: false,
      model: 'ai-service',
      strategyUsed: 'exact_match',
    };
    repo.create.mockResolvedValue({ id: 'fb2' });
    const result = await useCase.execute(minimal);
    expect(result).toEqual({ id: 'fb2' });
    expect(repo.create).toHaveBeenCalledWith({
      ...minimal,
      suggestion: undefined,
      confidence: undefined,
      latencyMs: undefined,
      strategyUsed: 'exact_match',
    });
  });

  it('propaga error si el repositorio falla', async () => {
    repo.create.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute(sampleInput)).rejects.toThrow('DB error');
  });
});
