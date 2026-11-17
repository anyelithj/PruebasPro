import { SubmitUserTurnUseCase } from '../../../../src/modules/dialogues/application/use-cases/submit-user-turn.use-case';
import { buildDialogueTopicSeed } from '../../../../src/modules/dialogues/infrastructure/seeds/dialogue-topics.seed';
import { lastTurns } from '../../../../src/modules/ai/assistant-client.service';
import type { TurnFeedback } from '../../../../src/modules/dialogues/domain/interfaces/sentence-corrector.interface';
// [2026-11-13 · Anexo A]: casos límite del corrector único en la conversación con el avatar | [Patrón]: Test Double (Stub/Spy)

function build(feedback: TurnFeedback | null, previous: unknown[] = []) {
  const session = {
    id: 's1',
    userId: 'u',
    topicId: 't',
    language: 'en',
    level: 'A1',
    status: 'active',
    userTurns: 0,
    conversationId: 'c',
    vocabularyUsed: [],
  };
  const agent = {
    turn: jest.fn(async () => ({
      sessionId: 'c',
      reply: 'Ok?',
      answeredBy: 'llm',
      correction: null,
      vocabularyUsed: [],
    })),
  };
  const uc = new SubmitUserTurnUseCase(
    { load: jest.fn(async () => session) } as never,
    { get: jest.fn(async () => buildDialogueTopicSeed()[0]) } as never, // Tema real del seed (contextOf necesita sus textos)
    { save: jest.fn(async (x: unknown) => x) } as never,
    {
      find: jest.fn(async () => previous), // Turnos ya guardados en dialogue_turns
      countBy: jest.fn(async () => 0),
      create: (x: unknown) => x,
      save: jest.fn(async (x: unknown) => x),
    } as never,
    agent,
    {
      enrich: jest.fn(async (t: string[]) =>
        t.map(() => ({ ipa: null, ipaUs: null, translation: '' })),
      ),
    } as never,
    { execute: jest.fn() } as never,
    { correct: jest.fn(async () => feedback) },
  );
  return { uc, agent };
}

describe('SubmitUserTurn · corrector único (Anexo A)', () => {
  it('corrector caído → la conversación sigue: el avatar responde a lo dicho y no se inventa veredicto', async () => {
    const { uc, agent } = build(null);
    const out = await uc.execute('u', 's1', 'i like pizza', 'tok');
    expect(agent.turn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'i like pizza' }),
      'tok',
    );
    expect(out.feedback).toBeNull();
    expect(out.userTurn).toMatchObject({ feedback: null, correction: null });
  });

  it('«no_responde» → el avatar recibe lo que dijo el estudiante (no hay frase corregida que lo represente)', async () => {
    const feedback = {
      correccion: {
        frase_corregida: 'Banana.',
        veredicto: 'no_responde' as const,
        errores: [],
        traduccion: '',
        alternativas_traduccion: [],
        comentario: '',
      },
      puntuacion: 0,
      modelo: 'qwen',
      respaldo: true,
      version_prompt: 'corrector_system@x',
      latencia_ms: 1,
    };
    const { uc, agent } = build(feedback);
    await uc.execute('u', 's1', 'banana', 'tok', 'voz');
    expect(agent.turn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'banana' }),
      'tok',
    );
  });

  it('[Tarea 1] el historial viene de la BD y del estudiante viaja su frase CORREGIDA', async () => {
    const prior = [
      { speaker: 'avatar', text: "What's your name?", feedback: null },
      {
        speaker: 'user',
        text: 'my niece is Laura',
        feedback: { correccion: { frase_corregida: 'My name is Laura.' } },
      },
      { speaker: 'avatar', text: 'Where are you from?', feedback: null },
    ];
    const { uc, agent } = build(null, prior);
    await uc.execute('u', 's1', 'I am from Colombia.', 'tok');
    expect(agent.turn).toHaveBeenCalledWith(
      expect.objectContaining({
        history: [
          { role: 'assistant', content: "What's your name?" },
          { role: 'user', content: 'My name is Laura.' },
          { role: 'assistant', content: 'Where are you from?' },
        ],
      }),
      'tok',
    );
  });
});

describe('lastTurns · ventana de historial (AI_HISTORY_TURNS)', () => {
  const turns = Array.from({ length: 15 }, (_, i) => ({
    role: 'user' as const,
    content: String(i),
  }));
  afterEach(() => delete process.env.AI_HISTORY_TURNS);

  it('por defecto envía los 10 últimos', () => {
    expect(lastTurns(turns).map((t) => t.content)).toEqual(
      ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
    );
  });

  it('configurable por variable de entorno y sin mutar el original', () => {
    process.env.AI_HISTORY_TURNS = '3';
    expect(lastTurns(turns).map((t) => t.content)).toEqual(['12', '13', '14']);
    expect(turns).toHaveLength(15);
  });
});
