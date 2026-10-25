import { ServiceUnavailableException } from '@nestjs/common';
import { AIProviderFactory } from '../../../src/modules/quiz/infrastructure/factories/ai-provider.factory';
import { AIProvider } from '../../../src/modules/quiz/domain/value-objects/ai-provider.vo';
import type {
  AIGeneratedQuestion,
  IAIQuestionProvider,
} from '../../../src/modules/quiz/domain/interfaces/ai-question-provider.interface';

// [Suite AIProviderFactory]: un solo modelo por defecto; fallback cruzado solo con AI_FALLBACK_ENABLED=true

const fakeQuestion = (text: string): AIGeneratedQuestion =>
  ({ text, type: 'multiple_choice', options: ['a', 'b'], correctAnswer: 'a' }) as AIGeneratedQuestion;

const provider = (id: AIProvider, impl: () => Promise<AIGeneratedQuestion[]>): IAIQuestionProvider => ({
  id,
  generateQuestions: jest.fn(impl),
});

// [Config simulada]: emula ConfigService.get
const config = (fallback: boolean) => ({ get: (k: string) => (k === 'AI_FALLBACK_ENABLED' ? String(fallback) : undefined) });

const opts = { topic: 'present perfect', amount: 2 };

function build(fallback: boolean, aya: IAIQuestionProvider, qwen: IAIQuestionProvider) {
  const mistral = provider(AIProvider.MISTRAL, async () => []);
  return new AIProviderFactory(aya as never, qwen as never, mistral as never, config(fallback) as never);
}

describe('AIProviderFactory.generateWithFallback', () => {
  it('usa Aya por defecto', async () => {
    const aya = provider(AIProvider.AYA, async () => [fakeQuestion('q1')]);
    const qwen = provider(AIProvider.QWEN, async () => []);
    const res = await build(false, aya, qwen).generateWithFallback(opts);
    expect(res.usedProvider).toBe(AIProvider.AYA);
    expect(res.fallbackUsed).toBe(false);
  });

  it('SIN fallback habilitado no carga un segundo modelo aunque el primero falle', async () => {
    const aya = provider(AIProvider.AYA, async () => {
      throw new Error('Ollama caído');
    });
    const qwen = provider(AIProvider.QWEN, async () => [fakeQuestion('q1')]);
    await expect(build(false, aya, qwen).generateWithFallback(opts)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(qwen.generateQuestions).not.toHaveBeenCalled();
  });

  it('CON fallback habilitado degrada a Qwen si Aya devuelve 0 preguntas', async () => {
    const aya = provider(AIProvider.AYA, async () => []);
    const qwen = provider(AIProvider.QWEN, async () => [fakeQuestion('q1')]);
    const res = await build(true, aya, qwen).generateWithFallback(opts);
    expect(res.usedProvider).toBe(AIProvider.QWEN);
    expect(res.fallbackUsed).toBe(true);
  });

  it('cuando todo falla → error con causa real, no "desconocido"', async () => {
    const aya = provider(AIProvider.AYA, async () => []);
    const qwen = provider(AIProvider.QWEN, async () => []);
    const factory = build(true, aya, qwen);
    await expect(factory.generateWithFallback(opts)).rejects.toThrow(/no devolvió preguntas válidas/i);
    await expect(factory.generateWithFallback(opts)).rejects.not.toThrow(/desconocido/i);
  });
});
