import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ServerAudioService, type PlayHooks } from '@core/audio/server-audio.service';
import { ReadAloudPlayer } from '@features/reading/application/read-aloud.player';
import { ReadingFacade } from '@features/reading/application/reading.facade';
import { ReadingRepository } from '@features/reading/domain/reading.repository.port';
import {
  estimateMs,
  ipaWords,
  paragraphs,
  ReadingDetailSchema,
  readingMinutes,
  tokenize,
  wordAtChar,
  wordAtProgress,
  wordCount,
} from '@features/reading/domain/models/reading';
// [Spec Lectura · 2026-10-25]: palabras y sincronía (carácter, avance y estimación), IPA palabra a palabra, reproductor frase a frase (repetir, velocidad, pausa) y marcador idempotente
// [Patrón]: Test Double (ServerAudioService y repositorio falsos) | [Herramienta]: Jest + TestBed

describe('modelo de lectura', () => {
  it('tokenize conserva el texto y numera solo las palabras', () => {
    const t = tokenize("Don't run, Tom!");
    expect(t.map((x) => x.text).join('')).toBe("Don't run, Tom!");
    expect(t.filter((x) => x.word >= 0).map((x) => x.text)).toEqual(["Don't", 'run', 'Tom']);
    expect(wordCount(tokenize('我喜欢猫。', 'zh'))).toBe(4);
  });

  it('wordAtChar: el carácter del evento boundary → palabra', () => {
    const t = tokenize('The fox runs.');
    expect(wordAtChar(t, 0)).toBe(0);
    expect(wordAtChar(t, 4)).toBe(1);
    expect(wordAtChar(t, 99)).toBe(2);
    expect(wordAtChar([], 0)).toBe(-1);
  });

  it('wordAtProgress reparte el tiempo por letras', () => {
    const t = tokenize('a extraordinarily b');
    expect(wordAtProgress(t, 0)).toBe(0);
    expect(wordAtProgress(t, 0.5)).toBe(1); // La palabra larga ocupa la mayor parte
    expect(wordAtProgress(t, 1)).toBe(2);
  });

  it('IPA palabra a palabra solo si coincide el recuento', () => {
    const t = tokenize('The fox runs.');
    expect(ipaWords('/ðə fɒks rʌnz/', t)).toEqual(['ðə', 'fɒks', 'rʌnz']);
    expect(ipaWords('ðəfɒks rʌnz', t)).toBeNull();
  });

  it('estimación, minutos y párrafos', () => {
    expect(estimateMs('x'.repeat(140), 1)).toBe(10_000);
    expect(estimateMs('x'.repeat(140), 0.5)).toBe(20_000);
    expect(readingMinutes(30)).toBe(1);
    expect(paragraphs([{ paragraph: 0 }, { paragraph: 0 }, { paragraph: 1 }]).map((p) => p.length)).toEqual([2, 1]);
  });

  it('el esquema acepta la respuesta de NestJS con valores por defecto', () => {
    const d = ReadingDetailSchema.parse({ id: '1', title: 'T', language: 'en', level: 'A1', genre: 'poem', sentences: [{ id: 's', paragraph: 0, position: 0, text: 'Hi' }] });
    expect(d.progress).toBeNull();
    expect(d.sentences[0]!.ipa).toBe('');
  });
});

describe('ReadAloudPlayer', () => {
  // [fakeAudio]: guarda los hooks de cada reproducción → el test decide cuándo termina cada frase
  function setup() {
    const calls: Array<{ text: string; rate: number; hooks: PlayHooks }> = [];
    const audio = { play: jest.fn(async (text: string, _l: string, rate: number, hooks: PlayHooks) => void calls.push({ text, rate, hooks })), stop: jest.fn() };
    TestBed.configureTestingModule({ providers: [ReadAloudPlayer, { provide: ServerAudioService, useValue: audio }] });
    const player = TestBed.inject(ReadAloudPlayer);
    player.load(['One fox.', 'Two cats run.', 'The end.'], 'en');
    return { player, calls, audio };
  }

  beforeEach(() => {
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lee frase a frase, avisa cada frase y termina', () => {
    const { player, calls } = setup();
    const seen: number[] = [];
    let done = false;
    player.onSentence = (i) => seen.push(i);
    player.onFinish = () => (done = true);
    player.play();
    calls[0]!.hooks.end!();
    calls[1]!.hooks.end!();
    calls[2]!.hooks.end!();
    expect(calls.map((c) => c.text)).toEqual(['One fox.', 'Two cats run.', 'The end.']);
    expect(seen).toEqual([0, 1, 2]);
    expect(done).toBe(true);
    expect(player.state()).toBe('idle');
  });

  it('boundary marca la palabra exacta', () => {
    const { player, calls } = setup();
    player.play(1);
    calls[0]!.hooks.boundary!(5); // «cats»
    expect(player.word()).toBe(1);
    expect(player.sync()).toBe('boundary');
  });

  it('repetir frase y velocidad 0,75x', () => {
    const { player, calls } = setup();
    player.repeat.set(true);
    player.setRate(0.75);
    player.play(2);
    calls[0]!.hooks.end!();
    expect(calls.map((c) => [c.text, c.rate])).toEqual([
      ['The end.', 0.75],
      ['The end.', 0.75],
    ]);
  });

  it('pausar ignora el fin tardío de la frase y conserva la posición', () => {
    const { player, calls } = setup();
    player.play(1);
    player.pause();
    calls[0]!.hooks.end!(); // Llega después de pausar → no avanza
    expect(player.state()).toBe('paused');
    expect(player.sentence()).toBe(1);
    expect(calls).toHaveLength(1);
  });
});

describe('ReadingFacade · marcador', () => {
  it('no repite el mismo marcador y un fallo de red no lanza', async () => {
    const saveProgress = jest.fn().mockReturnValueOnce(of({ sentence: 2, word: 1, finished: false })).mockReturnValueOnce(throwError(() => new Error('offline')));
    TestBed.configureTestingModule({ providers: [ReadingFacade, { provide: ReadingRepository, useValue: { saveProgress } }] });
    const facade = TestBed.inject(ReadingFacade);
    await expect(facade.saveProgress('t', { sentence: 2, word: 1, finished: false })).resolves.toBe(true);
    await expect(facade.saveProgress('t', { sentence: 2, word: 1, finished: false })).resolves.toBe(true);
    expect(saveProgress).toHaveBeenCalledTimes(1);
    await expect(facade.saveProgress('t', { sentence: 3, word: 0, finished: false })).resolves.toBe(false);
  });
});
