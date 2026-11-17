import type { Repository } from 'typeorm';
import { BackgroundTasks, mapLimit } from '../../../../src/shared/background/background-tasks';
import { AddExampleUseCase } from '../../../../src/modules/grammar/application/use-cases/add-example.use-case';
import type { EnrichExampleUseCase } from '../../../../src/modules/grammar/application/use-cases/enrich-example.use-case';
import type { GrammarAccess } from '../../../../src/modules/grammar/application/use-cases/list-sections.use-case';
import type { GrammarExample } from '../../../../src/modules/grammar/domain/entities/grammar-example.entity';
import { EnrichTermsUseCase } from '../../../../src/modules/polyglot/application/use-cases/enrich-terms.use-case';
import type { PolyglotConcept } from '../../../../src/modules/polyglot/domain/entities/polyglot-concept.entity';
import type { PolyglotTerm } from '../../../../src/modules/polyglot/domain/entities/polyglot-term.entity';
import { DRAFT_BUDGET_MS, GenerateContentDraftQuery } from '../../../../src/modules/curriculum/application/queries/ai-draft.queries';
import { CurriculumItemKind } from '../../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { CefrLevel } from '../../../../src/shared/domain/cefr-level.vo';
import { Language } from '../../../../src/shared/domain/language.vo';
import { LanguageSkill } from '../../../../src/shared/domain/language-skill.vo';
import type { LanguageToolsPort } from '../../../../src/shared/domain/interfaces/language-tools.interface';
// [Suite Rendimiento · 2026-10-27 · «crear un recurso/actividad tarda más de 6 min»]: guardar primero y enriquecer en segundo plano, coalescing por clave,
// paralelismo acotado y presupuesto de reintentos del LLM | [Patrón]: Test Double (puertos y repositorios en memoria, promesas controladas) | [Herramienta]: Jest

// [deferred]: promesa que el test resuelve a mano → simula una llamada lenta a FastAPI/Ollama | `Promise` (ES2015)
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const tick = () => new Promise((r) => setImmediate(r)); // Deja correr las microtareas pendientes

describe('BackgroundTasks', () => {
  it('schedule vuelve al instante y respeta el cupo de concurrencia', async () => {
    const bg = new BackgroundTasks(2);
    const gates = [deferred(), deferred(), deferred()];
    let running = 0;
    let peak = 0;
    gates.forEach((g, i) =>
      bg.schedule(`k${i}`, async () => {
        running++;
        peak = Math.max(peak, running);
        await g.promise;
        running--;
      }),
    );
    await tick();
    expect(running).toBe(2); // El tercero espera cupo
    gates.forEach((g) => g.resolve());
    await bg.idle();
    expect(peak).toBe(2);
  });

  it('coalesce: la misma clave en espera se ejecuta UNA vez con la última tarea; si llega mientras corre, se repite al terminar', async () => {
    const bg = new BackgroundTasks(1);
    const gate = deferred();
    const runs: string[] = [];
    bg.schedule('busy', () => gate.promise); // Ocupa el único cupo
    bg.schedule('k', async () => runs.push('a'));
    bg.schedule('k', async () => runs.push('b')); // Sustituye a «a» (aún en espera)
    expect(bg.isActive('k')).toBe(true);
    gate.resolve();
    await bg.idle();
    expect(runs).toEqual(['b']);

    const slow = deferred();
    bg.schedule('k', async () => {
      runs.push('c');
      await slow.promise;
    });
    await tick();
    bg.schedule('k', async () => runs.push('d')); // Llega mientras «c» corre → se ejecuta después
    slow.resolve();
    await bg.idle();
    expect(runs).toEqual(['b', 'c', 'd']);
    expect(bg.isActive('k')).toBe(false);
  });

  it('un fallo se registra y no detiene la cola (Fail-soft)', async () => {
    const bg = new BackgroundTasks(1);
    const after = jest.fn(async () => undefined);
    bg.schedule('bad', async () => {
      throw new Error('FastAPI caído');
    });
    bg.schedule('good', after);
    await bg.idle();
    expect(after).toHaveBeenCalled();
  });
});

describe('mapLimit', () => {
  it('conserva el orden y nunca supera el límite', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([30, 5, 20, 1, 10], 3, async (ms, i) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return i * 2;
    });
    expect(out).toEqual([0, 2, 4, 6, 8]);
    expect(peak).toBe(3);
  });

  it('lista vacía → []', async () => {
    expect(await mapLimit([], 3, async () => 1)).toEqual([]);
  });
});

describe('Gramática · AddExample con defer', () => {
  function setup() {
    let n = 0;
    const examples = {
      findOne: jest.fn(async () => null),
      create: jest.fn((x: Partial<GrammarExample>) => x),
      save: jest.fn(async (x: Partial<GrammarExample>) => ({ ...x, id: `x${++n}` })),
      findOneBy: jest.fn(),
    } as unknown as Repository<GrammarExample>;
    const access = {
      section: jest.fn(async () => ({ id: 'sec1', topicId: 'top1' })),
      editable: jest.fn(async () => ({ id: 'top1', language: 'en' })),
    } as unknown as GrammarAccess;
    const gate = deferred();
    const enrich = { execute: jest.fn(async () => (await gate.promise, { updated: 1 })) } as unknown as EnrichExampleUseCase & { execute: jest.Mock };
    const bg = new BackgroundTasks(1);
    return { uc: new AddExampleUseCase(access, examples, enrich, bg), enrich, gate, bg };
  }
  const actor = { id: 't', role: 'TEACHER' };

  it('responde sin esperar al LLM y agrupa los ejemplos de la ficha en lotes (no uno por ejemplo)', async () => {
    const { uc, enrich, gate, bg } = setup();
    const first = await uc.execute(actor, 'sec1', { text: 'I run.' }, 'tok', true);
    expect(first).toMatchObject({ id: 'x1', ipa: '' }); // Respuesta inmediata, sin IPA aún
    await tick(); // La primera tarea arranca con [x1] y queda esperando al «LLM»
    await uc.execute(actor, 'sec1', { text: 'She runs.' }, 'tok', true);
    await uc.execute(actor, 'sec1', { text: 'They run.' }, 'tok', true);
    gate.resolve();
    await bg.idle();
    expect(enrich.execute.mock.calls.map((c) => c[0])).toEqual([['x1'], ['x2', 'x3']]); // 3 ejemplos → 2 llamadas (antes 3 + 1 de la ficha)
  });

  it('sin defer mantiene el comportamiento del editor (espera la IPA)', async () => {
    const { uc, enrich, gate } = setup();
    gate.resolve();
    await uc.execute(actor, 'sec1', { text: 'I run.' }, 'tok');
    expect(enrich.execute).toHaveBeenCalledWith(['x1'], 'en', 'tok');
  });
});

describe('Poliglota · EnrichTerms en paralelo acotado', () => {
  it('pide la IPA de varios términos a la vez y guarda en UN lote', async () => {
    const terms = ['dog', 'cat', 'cow', 'pig', 'hen'].map((text, i) => ({ id: `t${i}`, conceptId: 'c1', language: 'fr', text, ipa: '', reviewed: false })) as PolyglotTerm[];
    let running = 0;
    let peak = 0;
    const ipa = jest.fn(async (text: string) => {
      running++;
      peak = Math.max(peak, running);
      await tick();
      running--;
      return { ipa: `/${text}/`, ipa_us: null, engine: 'espeak' };
    });
    const save = jest.fn(async (x: unknown) => x);
    const uc = new EnrichTermsUseCase(
      { find: jest.fn(async () => terms), save } as unknown as Repository<PolyglotTerm>,
      {} as Repository<PolyglotConcept>,
      { ipa } as unknown as LanguageToolsPort,
    );
    expect(await uc.execute({ conceptIds: ['c1'] }, 'tok')).toEqual({ updated: 5, failed: 0 });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(3);
    expect(save).toHaveBeenCalledTimes(1);
    expect(terms[4]).toMatchObject({ ipa: '/hen/' });
  });
});

describe('Curriculum · presupuesto de reintentos del LLM', () => {
  const METRICS = { model: 'qwen2.5:3b', modelDigest: null, quantization: null, parameterSize: null, promptTokens: 1, outputTokens: 1, latencyMs: 1, loadMs: 0, ramBytes: null, vramBytes: null };
  const items = { findByNaturalKey: jest.fn(async () => null), search: jest.fn(async () => ({ data: [], total: 0, page: 1, limit: 100 })), listForComparison: jest.fn(async () => []) };
  const gens = () => ({ find: jest.fn(async () => []), create: jest.fn((x) => x), save: jest.fn(async (xs: Array<Record<string, unknown>>) => xs.map((x, i) => ({ id: `g${i}`, ...x }))) });
  const req = { language: Language.EN, level: CefrLevel.A2, skill: LanguageSkill.SPEAKING, kind: CurriculumItemKind.EXAMPLE, topic: 'Pedir comida', count: 3 };
  afterEach(() => jest.restoreAllMocks());

  it('pasado el plazo no empieza otro intento: devuelve lo válido y el cliente pide el resto', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const generateJson = jest.fn(async () => {
      now += DRAFT_BUDGET_MS + 1; // Una inferencia lenta en CPU agota el presupuesto
      return { data: { items: [{ text: 'The bill, please.', translationEs: 'La cuenta, por favor.' }] }, metrics: METRICS };
    });
    const r = await new GenerateContentDraftQuery({ generateJson }, items as never, gens() as never).execute(req, 'u1');
    expect(generateJson).toHaveBeenCalledTimes(1); // Antes: hasta 3 inferencias encadenadas (≈ 6 min)
    expect(r.drafts).toHaveLength(1);
  });

  it('dentro del plazo sigue completando la cantidad pedida', async () => {
    const generateJson = jest
      .fn()
      .mockResolvedValueOnce({ data: { items: [{ text: 'The bill, please.', translationEs: 'La cuenta, por favor.' }] }, metrics: METRICS })
      .mockResolvedValueOnce({ data: { items: [{ text: 'A table for two.', translationEs: 'Una mesa para dos.' }, { text: 'Some water, please.', translationEs: 'Agua, por favor.' }] }, metrics: METRICS });
    const r = await new GenerateContentDraftQuery({ generateJson }, items as never, gens() as never).execute(req, 'u1');
    expect(generateJson).toHaveBeenCalledTimes(2);
    expect(r.drafts).toHaveLength(3);
  });
});
