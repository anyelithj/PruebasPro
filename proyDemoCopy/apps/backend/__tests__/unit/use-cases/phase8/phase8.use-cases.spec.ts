import { LookupTermUseCase } from '../../../../src/modules/vocabulary/application/use-cases/lookup-term.use-case';
import type { LanguageLookup } from '../../../../src/modules/vocabulary/domain/entities/language-lookup.entity';
import type {
  LanguageToolsPort,
  TermLookupResult,
} from '../../../../src/shared/domain/interfaces/language-tools.interface';
import { evaluateRound } from '../../../../src/modules/games/application/strategies/game-evaluator.strategy';
import { scoreOf } from '../../../../src/modules/games/application/use-cases/finish-game-session.use-case';
import { PlayAgentTurnUseCase } from '../../../../src/modules/games/application/use-cases/play-agent-turn.use-case';
import { toView } from '../../../../src/modules/games/application/use-cases/start-game-session.use-case';
import type { GameSession } from '../../../../src/modules/games/domain/entities/game-session.entity';
import {
  bankFor,
  GAME_CONTENT_LICENSE,
} from '../../../../src/modules/games/domain/game-content';
import { sm2, SM2_START } from '../../../../src/modules/games/domain/sm2';
import { buildRolePlayScenarioSeed } from '../../../../src/modules/games/infrastructure/seeds/roleplay-scenarios.seed';
import {
  itemProblem,
  toStudentItem,
} from '../../../../src/modules/practice/domain/item-rules';
import type { PracticeItem } from '../../../../src/modules/practice/domain/entities/practice-item.entity';
// [Suite Fase 8 · Sprints 8.2/8.5/8.12/8.17]: caché de traducción e IPA (Cache-Aside), SM-2, evaluador de rondas, turno con el agente, puntaje, contenido con licencia y reglas de ítems | [Patrón]: Test Double (repositorios y puertos en memoria) | [Herramienta]: Jest

const DAY = 86_400_000;

describe('LookupTermUseCase (Cache-Aside)', () => {
  const result = (model = 'aya'): TermLookupResult => ({
    text: 'water',
    language: 'en',
    translation: {
      translation: 'agua',
      alternatives: [],
      tone: 'neutral',
      model,
    },
    ipa_uk: 'wˈɔːtə',
    ipa_us: 'wˈɑːɾɚ',
    ipa: null,
    engine: 'espeak-ng 1.52.0',
  });
  function setup(model?: string) {
    const rows: LanguageLookup[] = [];
    const qb = {
      insert: () => qb,
      values: (v: LanguageLookup) => {
        rows.push({ ...v, id: 'l1' });
        return qb;
      },
      orIgnore: () => qb,
      execute: jest.fn(async () => undefined),
    };
    const repo = {
      findOneBy: jest.fn(
        async ({ fingerprint }: { fingerprint: string }) =>
          rows.find((r) => r.fingerprint === fingerprint) ?? null,
      ),
      create: (x: Partial<LanguageLookup>) => x as LanguageLookup,
      increment: jest.fn(async () => undefined),
      createQueryBuilder: () => qb,
    };
    const tools: LanguageToolsPort = {
      lookup: jest.fn(async () => result(model)),
      word: jest.fn(),
      lines: jest.fn(),
      ipa: jest.fn(), // [Sprint 10.5]: método nuevo del puerto (no se usa aquí)
      translate: jest.fn(), // [2026-10-19]: título de tema (no se usa aquí)
    };
    return {
      rows,
      repo,
      tools,
      uc: new LookupTermUseCase(repo as never, tools),
    };
  }

  it('la segunda consulta sale de la caché sin llamar a FastAPI', async () => {
    const { uc, tools, repo } = setup();
    await uc.execute({ text: 'Water ', language: 'en' }, 't');
    const again = await uc.execute({ text: 'water', language: 'en' }, 't');
    expect(tools.lookup).toHaveBeenCalledTimes(1);
    expect(repo.increment).toHaveBeenCalledTimes(1);
    expect(again.result).toMatchObject({ ipa_uk: 'wˈɔːtə', ipa_us: 'wˈɑːɾɚ' });
  });

  it('si el LLM no respondió no se cachea (la próxima vez reintenta)', async () => {
    const { uc, rows, tools } = setup('unavailable');
    await uc.execute({ text: 'water', language: 'en' }, 't');
    await uc.execute({ text: 'water', language: 'en' }, 't');
    expect(rows).toHaveLength(0);
    expect(tools.lookup).toHaveBeenCalledTimes(2);
  });
});

describe('SM-2', () => {
  const now = new Date('2026-10-17T00:00:00Z');
  it('1 → 6 días → intervalo × facilidad; un fallo reinicia a mañana', () => {
    const a = sm2(SM2_START, 5, now);
    expect([
      a.repetitions,
      a.intervalDays,
      a.dueAt.getTime() - now.getTime(),
    ]).toEqual([1, 1, DAY]);
    const b = sm2(a, 4, now);
    expect(b.intervalDays).toBe(6);
    const c = sm2(b, 4, now);
    expect(c.intervalDays).toBe(Math.round(6 * c.ease));
    const fail = sm2(c, 1, now);
    expect([fail.repetitions, fail.intervalDays]).toEqual([0, 1]);
    expect(sm2({ ...SM2_START, ease: 1.3 }, 0, now).ease).toBe(1.3); // nunca baja de 1.3
  });
});

describe('Evaluador de rondas y puntaje', () => {
  const content = {
    vocabulary: [{ term: 'apple', translation: 'manzana' }],
    lines: [
      {
        text: 'I usually take the bus to work at eight',
        gap: 'bus',
        answer: 'eight',
      },
    ],
  };
  it('vocabulario normaliza tildes y mayúsculas; comprensión mide solapamiento', () => {
    expect(
      evaluateRound(
        'flashcards',
        { answer: 'Manzána', entryIndex: 0, expected: 'translation' },
        content,
      ).correct,
    ).toBe(true);
    expect(
      evaluateRound(
        'shadowing',
        { answer: 'I usually take the bus to work', lineIndex: 0 },
        content,
      ),
    ).toMatchObject({ correct: true });
    expect(
      evaluateRound(
        'partial_dictation',
        { answer: 'Bus', lineIndex: 0 },
        content,
      ).correct,
    ).toBe(true);
    expect(
      evaluateRound('quick_qa', { answer: 'at eight', lineIndex: 0 }, content)
        .correct,
    ).toBe(true);
    expect(
      evaluateRound('random_topic', { answer: 'anything' }, content).correct,
    ).toBeNull();
  });
  // [Sprint 8.8]: clasificación rápida → la respuesta es la categoría elegida (no la palabra)
  it('clasificación rápida compara con la categoría de la tarjeta', () => {
    const sorted = { vocabulary: [{ term: 'apple', category: 'food' }] };
    expect(
      evaluateRound(
        'quick_sort',
        { answer: 'Food', entryIndex: 0, expected: 'category' },
        sorted,
      ),
    ).toMatchObject({ correct: true, expected: 'food' });
    expect(
      evaluateRound(
        'quick_sort',
        { answer: 'places', entryIndex: 0, expected: 'category' },
        sorted,
      ).correct,
    ).toBe(false);
  });
  it('el puntaje premia aciertos y palabras producidas', () => {
    expect(
      scoreOf([
        { correct: true, wordsProduced: 12 },
        { correct: null, wordsProduced: 25 },
      ]),
    ).toBe(10 + 2 + 5);
  });
});

describe('PlayAgentTurnUseCase', () => {
  it('envía el estado de la partida, guarda la ronda y aplica los objetivos cumplidos', async () => {
    const session = {
      id: 's1',
      userId: 'u1',
      gameType: 'role_play',
      language: 'en',
      level: 'A2',
      status: 'active',
      roundsCount: 0,
      correctCount: 0,
      content: {
        vocabulary: [{ term: 'bill' }],
        role: 'a waiter',
        objectives: [
          { id: 'bill', text: 'Pide la cuenta', keywords: ['bill'] },
        ],
        met: [],
      },
    } as unknown as GameSession;
    const agent = {
      turn: jest.fn(async () => ({
        sessionId: 'conv1',
        reply: 'Here you are.',
        answeredBy: 'llm',
        state: { met: ['bill'], finished: true },
      })),
    };
    const saved: unknown[] = [];
    const repo = {
      save: jest.fn(async (x: unknown) => (saved.push(x), x)),
      create: (x: unknown) => x,
    };
    const uc = new PlayAgentTurnUseCase(
      { load: async () => session } as never,
      repo as never,
      repo as never,
      agent,
    );
    const res = await uc.execute('u1', 's1', 'The bill, please', 'tok');
    expect(agent.turn).toHaveBeenCalledWith(
      expect.objectContaining({
        game: expect.objectContaining({
          game: 'role_play',
          turn: 1,
          role: 'a waiter',
        }),
      }),
      'tok',
    );
    expect(res.finished).toBe(true);
    expect(session.content).toMatchObject({
      met: ['bill'],
      conversationId: 'conv1',
    });
  });

  it('toView oculta la palabra secreta de 20 preguntas mientras se juega', () => {
    const s = {
      gameType: 'twenty_questions',
      status: 'active',
      content: { target: 'dog', vocabulary: [] },
    } as unknown as GameSession;
    expect(toView(s).content.target).toBeNull();
  });
});

describe('Contenido propio (8.17) y escenarios', () => {
  it('declara licencia, cae al inglés si el idioma no tiene banco y siembra seis escenarios', () => {
    expect(GAME_CONTENT_LICENSE.license).toBe('CC BY 4.0');
    expect(bankFor('ru').fallback).toBe(true);
    expect(bankFor('es').taboo.length).toBeGreaterThan(0);
    // [Sprint 8.8]: cada tarjeta del banco trae categoría (clasificación rápida)
    expect(bankFor('en').taboo.every((c) => c.category.length > 0)).toBe(true);
    const seed = buildRolePlayScenarioSeed();
    expect(seed.map((s) => s.slug)).toEqual([
      'en-restaurant',
      'en-job-interview',
      'en-airport',
      'en-doctor',
      'en-hotel',
      'en-meeting',
    ]);
    expect(seed.every((s) => s.objectives!.length >= 3)).toBe(true);
  });
});

describe('Reglas de ítems de práctica', () => {
  it('valida coherencia por tipo y oculta las respuestas al estudiante', () => {
    expect(
      itemProblem({
        itemType: 'multiple_choice',
        prompt: 'x',
        options: ['a', 'b'],
        accepted: [['c']],
      }),
    ).toMatch(/una de las opciones/);
    expect(
      itemProblem({
        itemType: 'drag_order',
        prompt: '',
        options: ['I', 'go'],
        accepted: [['go', 'I']],
      }),
    ).toBeNull();
    expect(
      itemProblem({
        itemType: 'mark_errors',
        prompt: 'She go home',
        options: [],
        accepted: [['5']],
      }),
    ).toMatch(/índices/);
    const student = toStudentItem({
      id: 'i',
      position: 0,
      itemType: 'fill_blank',
      skill: 'grammar',
      prompt: 'I ___',
      options: [],
      accepted: [['went']],
      tip: 't',
    } as unknown as PracticeItem);
    expect(student).not.toHaveProperty('accepted');
    expect(student).not.toHaveProperty('tip');
    expect(student.blanks).toBe(1);
  });
});
