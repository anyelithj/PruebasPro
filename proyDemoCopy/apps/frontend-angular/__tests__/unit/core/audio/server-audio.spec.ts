import { TestBed } from '@angular/core/testing';
import { isAudible, rms, SILENCE_RMS } from '@core/audio/audio-audibility';
import { ServerAudioService } from '@core/audio/server-audio.service';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { API_URL } from '@core/http/api-url.token';
// [Spec audio del avatar · 2026-10-24]: la respuesta de AULA sonaba MUDA → el audio del servidor se mide (RMS) antes de sonar; si está vacío o en silencio
// se pasa a la voz del navegador, y si la voz natural del sistema falla se usa el audio del servidor | [Patrón]: Test Double (Web Audio, <audio>, fetch y voz falsos)

// [decoder]: OfflineAudioContext falso — `decodeAudioData` devuelve las muestras dadas (o lanza si `samples` es null = bytes corruptos)
function fakeDecoder(samples: Float32Array | null) {
  return class {
    decodeAudioData(): Promise<unknown> {
      if (!samples) return Promise.reject(new Error('EncodingError'));
      return Promise.resolve({ duration: samples.length / 44100, length: samples.length, numberOfChannels: 1, getChannelData: () => samples });
    }
  };
}
const tone = (amp: number, n = 22050) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / 44100));
const wavBlob = () => new Blob([new Uint8Array(2000)], { type: 'audio/wav' });

function withDecoder(samples: Float32Array | null): void {
  (globalThis as Record<string, unknown>)['OfflineAudioContext'] = fakeDecoder(samples);
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)['OfflineAudioContext'];
  jest.restoreAllMocks();
});

describe('audio-audibility', () => {
  it('rms de una senoide = pico/√2', () => {
    expect(rms(tone(0.5))).toBeCloseTo(0.5 / Math.SQRT2, 2);
    expect(rms([])).toBe(0);
  });

  it('un tono suena; silencio, casi-silencio, vacío o corrupto no', async () => {
    withDecoder(tone(0.5));
    await expect(isAudible(wavBlob())).resolves.toBe(true);
    withDecoder(new Float32Array(22050)); // Todo ceros: el bug de la respuesta de AULA
    await expect(isAudible(wavBlob())).resolves.toBe(false);
    withDecoder(tone(SILENCE_RMS / 2)); // Bajo -60 dBFS
    await expect(isAudible(wavBlob())).resolves.toBe(false);
    withDecoder(new Float32Array(10)); // < 50 ms
    await expect(isAudible(wavBlob())).resolves.toBe(false);
    withDecoder(null);
    await expect(isAudible(wavBlob())).resolves.toBe(false);
    await expect(isAudible(new Blob([new Uint8Array(44)]))).resolves.toBe(false); // Solo cabecera
  });

  it('sin Web Audio (no se puede comprobar) → se intenta reproducir igual', async () => {
    await expect(isAudible(wavBlob())).resolves.toBe(true);
  });
});

describe('ServerAudioService (cadena voz natural → servidor → voz del sistema)', () => {
  const played: HTMLAudioElement[] = [];
  let natural = false;
  const speech = {
    speak: jest.fn(),
    stop: jest.fn(),
    accent: () => 'us' as const,
    hasNaturalVoice: () => natural,
  };

  function setup() {
    TestBed.configureTestingModule({
      providers: [{ provide: API_URL, useValue: '/api' }, { provide: SpeechSynthesisService, useValue: speech }],
    });
    return TestBed.inject(ServerAudioService);
  }

  beforeEach(() => {
    natural = false;
    played.length = 0;
    speech.speak.mockReset();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(wavBlob(), { status: 200 }));
    // `HTMLMediaElement.play` no existe en jsdom → se simula y se registra qué elemento sonó
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      played.push(this as HTMLAudioElement);
      return Promise.resolve();
    });
    (URL as unknown as Record<string, unknown>)['createObjectURL'] = jest.fn(() => 'blob:x');
    (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = jest.fn();
  });

  it('audio del servidor que suena → se reproduce sin silenciar y avisa al terminar', async () => {
    withDecoder(tone(0.5));
    const end = jest.fn();
    const onAudio = jest.fn();
    await setup().play("That's great!", 'en', 0.9, { end, audio: onAudio });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/audio?text=That%27s+great%21&language=en&variant=en-US'), expect.objectContaining({ cache: 'no-cache' }));
    expect(played).toHaveLength(1);
    expect(played[0]!.muted).toBe(false);
    expect(played[0]!.volume).toBe(1);
    expect(onAudio).toHaveBeenCalledWith(played[0]); // La boca del avatar sigue el volumen real
    expect(speech.speak).not.toHaveBeenCalled();
    played[0]!.onended!(new Event('ended'));
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('audio del servidor MUDO → no se reproduce y habla la voz del navegador', async () => {
    withDecoder(new Float32Array(22050));
    const end = jest.fn();
    await setup().play("That's great!", 'en', 0.9, { end });
    expect(played).toHaveLength(0);
    expect(speech.speak).toHaveBeenCalledWith("That's great!", 'en', 0.9, expect.objectContaining({ end: expect.any(Function) }));
  });

  it('servidor de voz caído (503) → voz del navegador', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await setup().play('Hi', 'en');
    expect(speech.speak).toHaveBeenCalledTimes(1);
  });

  it('la voz natural del sistema falla (no suena) → audio del servidor', async () => {
    natural = true;
    withDecoder(tone(0.5));
    speech.speak.mockImplementation((_t: string, _l: string, _r: number, h: { error?: (r: string) => void }) => h.error?.('no-start'));
    await setup().play('Hi', 'en');
    await new Promise((r) => setTimeout(r, 0)); // El cambio de motor es asíncrono (descarga)
    expect(played).toHaveLength(1);
  });

  it('stop() avisa `end` una sola vez y anula la reproducción', async () => {
    withDecoder(tone(0.5));
    const end = jest.fn();
    const svc = setup();
    await svc.play('Hi', 'en', 0.9, { end });
    svc.stop();
    played[0]!.onended?.(new Event('ended')); // Evento tardío del elemento cortado → ignorado
    expect(end).toHaveBeenCalledTimes(1);
    expect(svc.playing()).toBeNull();
  });
});
