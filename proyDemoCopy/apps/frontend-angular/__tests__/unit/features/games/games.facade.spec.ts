import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { GameAgentFacade } from '@features/games/application/game-agent.facade';
import { GamesFacade } from '@features/games/application/games.facade';
import { SpeechFacade } from '@features/games/application/speech.facade';
import { GamesRepository } from '@features/games/domain/games.repository.port';
import { accuracy, maskGap, shuffle } from '@features/games/domain/models/games';
// [Spec GamesFacade + GameAgentFacade + SpeechFacade · Sprints 8.8–8.11]: ciclo de partida (empezar → responder → terminar), turno del agente con marcas del motor, pipeline de voz, SM-2 y reglas puras | [Patrón]: Test Double (repositorio falso)

const session = { id: 's1', gameType: 'taboo' as const, language: 'en', level: null, difficulty: 1, scenarioId: null, content: { vocabulary: [], target: 'apple', forbidden: ['fruit'] }, status: 'active' as const, score: 0, roundsCount: 0, correctCount: 0, createdAt: '', finishedAt: null };
const round = { id: 'r1', index: 1, prompt: '', answer: 'x', correct: true, timeToAnswerMs: 900, durationMs: null, wordsProduced: 1, evaluation: {}, createdAt: '' };

function setup(overrides: Partial<GamesRepository> = {}) {
  const repo = {
    start: jest.fn(() => of(session)),
    submitRound: jest.fn(() => of({ round, verdict: { correct: true }, metric: null })),
    finish: jest.fn(() => of({ ...session, status: 'finished', score: 10 })),
    session: jest.fn(() => of({ session: { ...session, status: 'finished' }, rounds: [round], metrics: [] })),
    cancel: jest.fn(() => of(undefined)),
    agentTurn: jest.fn(() => of({ reply: 'Is it an apple?', state: { violation: false, solved: true }, round, finished: true })),
    transcribe: jest.fn(() => of({ text: 'hello there', language: 'en', duration: 2, words: [{ word: 'hello', start: 0, end: 0.4 }] })),
    dueCards: jest.fn(() => of([{ id: 'c1', entryId: 'e1', repetitions: 0, intervalDays: 0, dueAt: '', entry: { id: 'e1', term: 'bus', translation: 'autobús', language: 'en', example: null } }])),
    review: jest.fn(() => of({})),
    ...overrides,
  } as unknown as GamesRepository;
  TestBed.configureTestingModule({ providers: [GamesFacade, GameAgentFacade, SpeechFacade, { provide: GamesRepository, useValue: repo }] });
  return { games: TestBed.inject(GamesFacade), agent: TestBed.inject(GameAgentFacade), speech: TestBed.inject(SpeechFacade), repo };
}

describe('GamesFacade', () => {
  it('empezar → responder (contadores locales) → terminar carga el resumen', async () => {
    const { games, repo } = setup();
    await games.start({ gameType: 'taboo', language: 'en' });
    expect(games.phase()).toBe('playing');
    await games.answer({ answer: 'apple', entryIndex: 0 });
    expect(games.session()?.correctCount).toBe(1);
    await games.finish();
    expect(games.phase()).toBe('finished');
    expect(repo.session).toHaveBeenCalledWith('s1');
    expect(games.result.data()?.rounds).toHaveLength(1);
  });

  it('error al empezar → vuelve a «idle» con el mensaje', async () => {
    const { games } = setup({ start: () => throwError(() => new ApiError(400, 'No hay suficientes palabras para este juego')) });
    await games.start({ gameType: 'memory', language: 'es' });
    expect(games.phase()).toBe('idle');
    expect(games.error()).toContain('suficientes');
  });

  it('SM-2: calificar saca la tarjeta del mazo de hoy', async () => {
    const { games, repo } = setup();
    await games.loadDue();
    await games.review(games.due.data()![0], 4);
    expect(repo.review).toHaveBeenCalledWith('c1', 4);
    expect(games.due.data()).toEqual([]);
  });
});

describe('GameAgentFacade', () => {
  it('turno: añade mensaje del usuario y respuesta con marca «solved»; envía el tiempo hasta responder', async () => {
    const { games, agent, repo } = setup();
    await games.start({ gameType: 'taboo', language: 'en' });
    agent.open('Instrucciones');
    expect(await agent.send('  It is red and sweet  ')).toBe(true);
    expect(agent.turns().map((t) => t.who)).toEqual(['agent', 'user', 'agent']);
    expect(agent.turns()[2].flag).toBe('solved');
    expect(agent.finished()).toBe(true);
    expect((repo.agentTurn as jest.Mock).mock.calls[0][1]).toBe('It is red and sweet');
    expect(typeof (repo.agentTurn as jest.Mock).mock.calls[0][2]).toBe('number');
  });
});

describe('SpeechFacade', () => {
  it('voz → transcripción → ronda con marcas de tiempo y duración', async () => {
    const { games, speech, repo } = setup();
    await games.start({ gameType: 'random_topic', language: 'en' });
    await speech.submitOral({ blob: new Blob(['x']), durationMs: 2000 }, { prompt: 'tema' });
    expect(repo.submitRound).toHaveBeenCalledWith('s1', expect.objectContaining({ answer: 'hello there', durationMs: 2000, words: [{ word: 'hello', start: 0, end: 0.4 }] }));
  });

  it('silencio (sin palabras) → aviso y sin ronda', async () => {
    const { games, speech, repo } = setup({ transcribe: () => of({ text: '', language: 'en', duration: 1, words: [] }) });
    await games.start({ gameType: 'random_topic', language: 'en' });
    expect(await speech.submitOral({ blob: new Blob(['x']), durationMs: 900 })).toBeNull();
    expect(speech.error()).toContain('No se entendió');
    expect(repo.submitRound).not.toHaveBeenCalled();
  });
});

describe('Reglas puras de juegos', () => {
  it('maskGap oculta solo la palabra del hueco; accuracy y shuffle deterministas', () => {
    expect(maskGap({ text: 'I take the bus to work', gap: 'bus' })).toBe('I take the _____ to work');
    expect(accuracy({ roundsCount: 4, correctCount: 3 })).toBe(75);
    expect(accuracy({ roundsCount: 0, correctCount: 0 })).toBe(0);
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});
