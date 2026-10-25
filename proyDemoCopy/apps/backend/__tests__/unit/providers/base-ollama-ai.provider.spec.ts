import { BaseOllamaAIProvider } from '../../../src/modules/quiz/infrastructure/clients/base-ollama-ai.provider';
import { AIProvider } from '../../../src/modules/quiz/domain/value-objects/ai-provider.vo';
import { QuestionType } from '../../../src/modules/quiz/domain/entities/question.entity';
import type { GenerateAIQuestionsOptions } from '../../../src/modules/quiz/domain/interfaces/ai-question-provider.interface';

// [Suite BaseOllamaAIProvider]: parser robusto + validación + normalize | [Correcciones]: placeholders "Opción A", open_answer, JSON tolerante (<think>, objeto único/sueltos), prompt sin placeholders

// [Subclase de prueba]: expone los métodos protegidos | [Patrón]: Test Subclass
class TestProvider extends BaseOllamaAIProvider {
  readonly id = AIProvider.QWEN;
  protected readonly model = 'test:model';
  parse(raw: string) {
    return this.parseJsonArray(raw);
  }
  valid(q: unknown) {
    return this.isValidRawQuestion(q);
  }
  norm(raw: unknown, opts: GenerateAIQuestionsOptions) {
    return this.normalize(raw as never, opts);
  }
  prompt(opts: GenerateAIQuestionsOptions) {
    return this.buildPrompt(opts);
  }
}

const makeProvider = () =>
  new TestProvider({} as never, { get: (_k: string, d: unknown) => d } as never);

const baseOpts: GenerateAIQuestionsOptions = { topic: 'Fotosíntesis', amount: 3 };

describe('parseJsonArray (parser tolerante)', () => {
  const p = makeProvider();

  it('parsea un array JSON limpio', () => {
    expect(p.parse('[{"a":1},{"a":2}]')).toHaveLength(2);
  });

  it('extrae JSON dentro de un bloque markdown ```json', () => {
    const raw = 'Aquí tienes:\n```json\n[{"a":1}]\n```\ngracias';
    expect(p.parse(raw)).toHaveLength(1);
  });

  it('ignora bloques <think> de razonamiento (Qwen3)', () => {
    const raw = '<think>debo responder...</think>[{"a":1}]';
    expect(p.parse(raw)).toHaveLength(1);
  });

  it('envuelve un objeto único en array', () => {
    const out = p.parse('{"text":"x"}');
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
  });

  it('recolecta objetos sueltos sin array contenedor', () => {
    const out = p.parse('{"a":1}\n{"a":2}\n{"a":3}');
    expect(out).toHaveLength(3);
  });

  it('texto sin JSON → array vacío', () => {
    expect(p.parse('no hay json aquí')).toEqual([]);
  });
});

describe('isValidRawQuestion (gate de calidad)', () => {
  const p = makeProvider();

  it('acepta multiple_choice válida', () => {
    expect(
      p.valid({
        text: '¿Qué gas liberan las plantas durante la fotosíntesis?',
        type: 'multiple_choice',
        options: ['Oxígeno', 'Dióxido de carbono'],
        correctAnswer: 'Oxígeno',
        explanation: 'x',
        feedback: 'y',
      }),
    ).toBe(true);
  });

  it('RECHAZA placeholders genéricos ("Opción A")', () => {
    expect(
      p.valid({
        text: 'Pregunta',
        type: 'multiple_choice',
        options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
        correctAnswer: 'Opción A',
        explanation: 'x',
        feedback: 'y',
      }),
    ).toBe(false);
  });

  it('acepta open_answer sin options', () => {
    expect(
      p.valid({
        text: 'Explica la fotosíntesis',
        type: 'open_answer',
        correctAnswer: 'Proceso por el que las plantas producen glucosa.',
        explanation: 'x',
        feedback: 'y',
      }),
    ).toBe(true);
  });

  it('rechaza si falta correctAnswer', () => {
    expect(
      p.valid({ text: 'x', type: 'true_false', options: ['true', 'false'], correctAnswer: '', explanation: 'a', feedback: 'b' }),
    ).toBe(false);
  });
});

describe('normalize (mapeo a dominio)', () => {
  const p = makeProvider();

  it('open_answer → tipo OPEN_ANSWER y options vacío', () => {
    const out = p.norm(
      { text: 'q', type: 'open_answer', correctAnswer: 'respuesta', explanation: 'e', feedback: 'f' },
      baseOpts,
    );
    expect(out.type).toBe(QuestionType.OPEN_ANSWER);
    expect(out.options).toEqual([]);
  });

  it('multiple_choice self-healing: agrega correctAnswer si falta en options', () => {
    const out = p.norm(
      { text: 'q', type: 'multiple_choice', options: ['a', 'b'], correctAnswer: 'c', explanation: 'e', feedback: 'f' },
      baseOpts,
    );
    expect(out.options).toContain('c');
  });
});

describe('buildPrompt', () => {
  const p = makeProvider();

  it('pide la cantidad exacta y el formato usa marcadores <> a sustituir', () => {
    const prompt = p.prompt({ topic: 'Fotosíntesis', amount: 4 });
    expect(prompt).toContain('4');
    // [Formato con marcadores]: el JSON de muestra usa marcadores <> que el modelo debe sustituir por contenido real del tema
    expect(prompt).toContain('"correctAnswer": "<respuesta correcta');
    // [Regla anti-placeholder presente]: el prompt instruye explícitamente no usar etiquetas genéricas
    expect(prompt).toMatch(/NUNCA etiquetas genéricas/i);
  });

  it('open_answer: instruye no incluir options', () => {
    const prompt = p.prompt({ topic: 'X', amount: 2, type: QuestionType.OPEN_ANSWER });
    expect(prompt.toLowerCase()).toContain('open_answer');
  });
});
