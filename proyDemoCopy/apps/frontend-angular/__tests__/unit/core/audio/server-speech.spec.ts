import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { isServerSpeechDown, liveDictationSupported, speechFallbackNotice } from '@core/audio/server-speech';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { ApiError } from '@core/http/error.interceptor';
import { DialogueAgentFacade } from '@features/dialogues/application/dialogue-agent.facade';
import { DialoguesFacade } from '@features/dialogues/application/dialogues.facade';
import { DialoguesRepository } from '@features/dialogues/domain/dialogues.repository.port';
import { GamesFacade } from '@features/games/application/games.facade';
import { SpeechFacade } from '@features/games/application/speech.facade';
import { GamesRepository } from '@features/games/domain/games.repository.port';
import { session, topic, turn } from '@testing/music-dialogues';
// [Spec server-speech · 2026-10-25]: servidor sin voz a texto (503 SPEECH_ENGINE_MISSING) → respaldo (dictado del navegador o escribir), sin error rojo y conservando la grabación | [Patrón]: Test Double (repositorios falsos) + AAA

const missing = () => throwError(() => new ApiError(503, 'El reconocimiento de voz del servidor no está instalado.', 'SPEECH_ENGINE_MISSING'));
const labels = { serverOffLive: 'LIVE', serverOffType: 'TYPE', liveTip: 'TIP' };
const rec = (liveText = '') => ({ blob: new Blob(['x']), durationMs: 900, liveText });

describe('server-speech (funciones puras)', () => {
  afterEach(() => delete (window as unknown as Record<string, unknown>)['webkitSpeechRecognition']);

  it('solo los fallos del servidor activan el respaldo', () => {
    expect(isServerSpeechDown(new ApiError(503, 'x', 'SPEECH_ENGINE_MISSING'))).toBe(true);
    expect(isServerSpeechDown(new ApiError(0, 'sin conexión'))).toBe(true);
    expect(isServerSpeechDown(new ApiError(400, 'Audio no válido'))).toBe(false);
    expect(isServerSpeechDown(new Error('otro'))).toBe(false);
  });

  it('mensaje según haya texto dictado y según el navegador', () => {
    expect(speechFallbackNotice(labels, true)).toBe('LIVE');
    expect(liveDictationSupported()).toBe(false); // jsdom no trae Web Speech
    expect(speechFallbackNotice(labels, false)).toBe('TYPE TIP');
    (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] = function Fake() {};
    expect(speechFallbackNotice(labels, false)).toBe('TYPE');
  });
});

describe('Diálogos sin voz a texto en el servidor', () => {
  const speech = { speak: jest.fn((_t: string, _l: string, _r: number, h: { end?: () => void } = {}) => h.end?.()), stop: jest.fn(), hasVoice: () => true, hasNaturalVoice: () => true, speaking: () => false, accent: () => 'uk' };

  function setup() {
    const repo = {
      startSession: jest.fn(() => of({ session: session(), topic, turns: [turn(0, 'avatar', 'Hi!')] })),
      streamTurn: jest.fn(() => of({ type: 'user', data: turn(1, 'user', 'I like pasta') })),
      transcribe: jest.fn(missing),
      saveRecording: jest.fn(() => of(turn(1, 'user', 'I like pasta'))),
    } as unknown as DialoguesRepository;
    TestBed.configureTestingModule({
      providers: [DialoguesFacade, DialogueAgentFacade, { provide: DialoguesRepository, useValue: repo }, { provide: SpeechSynthesisService, useValue: speech }],
    });
    return { dialogues: TestBed.inject(DialoguesFacade), agent: TestBed.inject(DialogueAgentFacade), repo };
  }

  it('Biblioteca: devuelve null, marca el servidor caído y NO muestra error', async () => {
    const { dialogues } = setup();
    expect(await dialogues.transcribe(new Blob(['x']), 'en')).toBeNull();
    expect(dialogues.serverSpeechDown()).toBe(true);
    expect(dialogues.actionError()).toBeNull();
  });

  it('Conversación: sin error, vuelve a reposo y la grabación se guarda al enviar el texto escrito', async () => {
    const { agent, repo } = setup();
    await agent.start('tp1', 'en', 'A2');
    expect(await agent.transcribe(rec())).toBeNull();
    expect(agent.serverSpeechDown()).toBe(true);
    expect(agent.error()).toBeNull();
    expect(agent.state()).toBe('idle');
    agent.send('I like pasta'); // El alumno lo escribió
    expect(repo.saveRecording).toHaveBeenCalled(); // «Mis grabaciones» conserva la voz
  });
});

describe('Juegos orales sin voz a texto en el servidor', () => {
  const gameSession = { id: 's1', gameType: 'random_topic' as const, language: 'en', level: null, difficulty: 1, scenarioId: null, content: {}, status: 'active' as const, score: 0, roundsCount: 0, correctCount: 0, createdAt: '', finishedAt: null };

  function setup() {
    const repo = {
      start: jest.fn(() => of(gameSession)),
      submitRound: jest.fn(() => of({ round: {}, verdict: { correct: true }, metric: null })),
      transcribe: jest.fn(missing),
    } as unknown as GamesRepository;
    TestBed.configureTestingModule({ providers: [GamesFacade, SpeechFacade, { provide: GamesRepository, useValue: repo }] });
    return { games: TestBed.inject(GamesFacade), speech: TestBed.inject(SpeechFacade), repo };
  }

  it('con dictado en vivo la ronda se envía con ese texto (sin marcas por palabra)', async () => {
    const { games, speech, repo } = setup();
    await games.start({ gameType: 'random_topic', language: 'en' });
    await speech.submitOral(rec('hello there'));
    expect(repo.submitRound).toHaveBeenCalledWith('s1', expect.objectContaining({ answer: 'hello there', durationMs: 900 }));
    expect(speech.error()).toBeNull();
  });

  it('sin dictado muestra el mensaje accionable del backend', async () => {
    const { speech } = setup();
    expect(await speech.toText(rec(), 'en')).toBeNull();
    expect(speech.error()).toMatch(/no está instalado/);
  });
});
