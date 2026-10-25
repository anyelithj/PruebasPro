import { GenerateAIQuestionsUseCase } from '../../../../src/modules/quiz/application/use-cases/generate-ai-questions.use-case';
import type { AIGeneratedQuestion } from '../../../../src/modules/quiz/domain/interfaces/ai-question-provider.interface';
import type { GenerateAIQuestionsDto } from '../../../../src/modules/quiz/application/dtos/generate-ai-questions.dto';

// [Suite GenerateAIQuestionsUseCase]: loop de relleno (top-up) + dedup + sin caché | [Correcciones]: no genera la cantidad pedida, duplicados al 2da generación, datos cacheados obsoletos

const q = (text: string): AIGeneratedQuestion => ({ text }) as AIGeneratedQuestion;

const dto = (amount: number): GenerateAIQuestionsDto =>
  ({ topic: 'Fotosíntesis', amount }) as GenerateAIQuestionsDto;

describe('GenerateAIQuestionsUseCase', () => {
  it('una sola llamada si ya alcanza la cantidad pedida', async () => {
    const factory = {
      generateWithFallback: jest
        .fn()
        .mockResolvedValue({ questions: [q('A'), q('B')], usedProvider: 'qwen', fallbackUsed: false }),
    };
    const uc = new GenerateAIQuestionsUseCase(factory as never);

    const res = await uc.execute(dto(2));
    expect(res.questions).toHaveLength(2);
    expect(factory.generateWithFallback).toHaveBeenCalledTimes(1);
    expect(res.usedProvider).toBe('qwen');
    // [Sin caché]: la respuesta ya no expone el flag `cached`
    expect(res).not.toHaveProperty('cached');
  });

  it('rellena (top-up) cuando el modelo devuelve menos preguntas y deduplica por enunciado', async () => {
    const factory = {
      generateWithFallback: jest
        .fn()
        .mockResolvedValueOnce({ questions: [q('A'), q('B')], usedProvider: 'qwen', fallbackUsed: false })
        // [Segundo intento]: 'B' es duplicado, solo se agrega 'C'
        .mockResolvedValueOnce({ questions: [q('B'), q('C')], usedProvider: 'qwen', fallbackUsed: false }),
    };
    const uc = new GenerateAIQuestionsUseCase(factory as never);

    const res = await uc.execute(dto(3));
    expect(res.questions.map((x) => x.text)).toEqual(['A', 'B', 'C']);
    expect(factory.generateWithFallback).toHaveBeenCalledTimes(2);
    // [Segundo intento pide solo lo faltante]
    expect(factory.generateWithFallback.mock.calls[1][0]).toMatchObject({ amount: 1 });
  });

  it('se detiene si un intento no aporta preguntas nuevas (anti-bucle)', async () => {
    const factory = {
      generateWithFallback: jest
        .fn()
        .mockResolvedValueOnce({ questions: [q('A')], usedProvider: 'qwen', fallbackUsed: false })
        .mockResolvedValue({ questions: [q('A')], usedProvider: 'qwen', fallbackUsed: false }),
    };
    const uc = new GenerateAIQuestionsUseCase(factory as never);

    const res = await uc.execute(dto(5));
    expect(res.questions).toHaveLength(1);
    // [Stagnation]: corta antes de agotar MAX_ATTEMPTS si no hay progreso
    expect(factory.generateWithFallback.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('propaga el error si el primer intento falla (nada que devolver)', async () => {
    const factory = {
      generateWithFallback: jest.fn().mockRejectedValue(new Error('Ollama no disponible')),
    };
    const uc = new GenerateAIQuestionsUseCase(factory as never);
    await expect(uc.execute(dto(3))).rejects.toThrow('Ollama no disponible');
  });

  it('conserva lo acumulado si un intento posterior falla (éxito parcial)', async () => {
    const factory = {
      generateWithFallback: jest
        .fn()
        .mockResolvedValueOnce({ questions: [q('A')], usedProvider: 'qwen', fallbackUsed: false })
        .mockRejectedValueOnce(new Error('timeout')),
    };
    const uc = new GenerateAIQuestionsUseCase(factory as never);
    const res = await uc.execute(dto(3));
    expect(res.questions).toHaveLength(1);
  });
});
