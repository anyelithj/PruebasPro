import { GatewayTimeoutException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GenerateActivityDraftUseCase, PRACTICE_BATCH } from '../../../../src/modules/practice/application/use-cases/generate-activity-draft.use-case';
import type { OllamaClient } from '../../../../src/modules/ai/ollama.client';
// [Borrador de Práctica por lotes · 2026-10-31]: cada inferencia pide ≤ PRACTICE_BATCH y un corte conserva lo ya generado | [Patrón]: Test Double | [Herramienta]: Jest

let next = 0;
// Respuesta con `n` ítems de opción múltiple distintos, en inglés (para no activar el reintento por idioma)
const reply = (n: number) => ({
  response: JSON.stringify({
    items: Array.from({ length: n }, () => ({ itemType: 'multiple_choice', prompt: `Which is the right answer to the question number ${++next}?`, options: ['the one', 'the other'], accepted: [['the one']] })),
  }),
});
const useCase = (generate: jest.Mock) => new GenerateActivityDraftUseCase({ generate } as unknown as OllamaClient, { get: () => 'modelo' } as unknown as ConfigService);
const req = (count: number) => ({ language: 'en', level: 'A1', skill: 'vocabulary', topic: 'can', itemTypes: ['multiple_choice'], count }) as Parameters<GenerateActivityDraftUseCase['execute']>[0];
const asked = (call: unknown[]) => Number(/Create (\d+) ORIGINAL/.exec((call[0] as { prompt: string }).prompt)?.[1]);

describe('GenerateActivityDraftUseCase · lotes', () => {
  it('reparte la cantidad en lotes hasta completarla', async () => {
    const generate = jest.fn(async (r: { prompt: string }) => reply(Number(/Create (\d+)/.exec(r.prompt)![1])));
    const out = await useCase(generate).execute(req(12));
    expect(out.items).toHaveLength(12);
    expect(generate.mock.calls.map(asked)).toEqual([PRACTICE_BATCH, PRACTICE_BATCH, 2]);
  });

  it('si un lote posterior agota el tiempo entrega lo ya generado', async () => {
    const generate = jest.fn().mockResolvedValueOnce(reply(PRACTICE_BATCH)).mockRejectedValueOnce(new GatewayTimeoutException());
    await expect(useCase(generate).execute(req(12))).resolves.toMatchObject({ items: { length: PRACTICE_BATCH } });
  });

  it('si el primer lote falla informa del error (no hay nada que revisar)', async () => {
    const generate = jest.fn().mockRejectedValue(new GatewayTimeoutException('La IA tardó demasiado'));
    await expect(useCase(generate).execute(req(5))).rejects.toThrow('La IA tardó demasiado');
  });
});

// [2026-11-06]: alemán pedido → el modelo devolvía enunciados en español; esos ítems se descartan
import { offLanguage } from '../../../../src/modules/practice/application/use-cases/generate-activity-draft.use-case';
describe('offLanguage', () => {
  it('descarta enunciados en español cuando el idioma es alemán', () => {
    expect(offLanguage({ prompt: '¿Cuántas personas hay en una familia?', options: ['3', '4'] }, 'de')).toBe(true);
    expect(offLanguage({ prompt: 'Wie viele Personen sind in der Familie? Das ist die Mutter.', options: ['drei'] }, 'de')).toBe(false);
  });
});
