import { TestBed } from '@angular/core/testing';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
// [Spec SpeechSynthesisService · 2026-10-24]: la voz del sistema que NO suena (nunca arranca o da error) se notifica con `error` → el llamador cambia al audio del servidor;
// los cortes voluntarios (`interrupted`) y `stop()` cierran con `end` una sola vez | [Patrón]: Test Double (speechSynthesis falso) + relojes falsos de Jest

// [FakeUtterance]: SpeechSynthesisUtterance mínimo (jsdom no implementa la Web Speech API)
class FakeUtterance {
  lang = '';
  rate = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onboundary: ((e: { name: string; charIndex: number }) => void) | null = null;
  constructor(readonly text: string) {}
}

const synth = { speak: jest.fn(), cancel: jest.fn(), resume: jest.fn(), paused: false, getVoices: () => [] };

function setup() {
  Object.assign(window, { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance });
  TestBed.configureTestingModule({});
  return TestBed.inject(SpeechSynthesisService);
}

const spoken = () => synth.speak.mock.calls.at(-1)![0] as FakeUtterance;

beforeEach(() => {
  jest.useFakeTimers();
  synth.speak.mockReset();
  synth.cancel.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('SpeechSynthesisService.speak', () => {
  it('habla un tick después de cancelar (bug de Chrome) y termina con `end`', () => {
    const svc = setup();
    const end = jest.fn();
    svc.speak("That's great!", 'en', 0.9, { end });
    expect(synth.speak).not.toHaveBeenCalled(); // Aún en el mismo tick que cancel()
    jest.advanceTimersByTime(0);
    const u = spoken();
    expect(u.lang).toBe('en-US');
    u.onstart!();
    expect(svc.speaking()).toBe(true);
    u.onend!();
    expect(end).toHaveBeenCalledTimes(1);
    expect(svc.speaking()).toBe(false);
  });

  it('la voz nunca arranca (voz en red caída) → `error` tras el vigilante', () => {
    const svc = setup();
    const error = jest.fn();
    const end = jest.fn();
    svc.speak('Hi', 'en', 0.9, { error, end });
    jest.advanceTimersByTime(5000);
    expect(synth.cancel).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('no-start');
    expect(end).not.toHaveBeenCalled();
  });

  it('error del motor → `error`; `interrupted` (corte voluntario) → `end`', () => {
    const svc = setup();
    const a = { error: jest.fn(), end: jest.fn() };
    svc.speak('Hi', 'en', 0.9, a);
    jest.advanceTimersByTime(0);
    spoken().onerror!({ error: 'synthesis-failed' });
    expect(a.error).toHaveBeenCalledWith('synthesis-failed');

    const b = { error: jest.fn(), end: jest.fn() };
    svc.speak('Hi', 'en', 0.9, b);
    jest.advanceTimersByTime(0);
    spoken().onerror!({ error: 'interrupted' });
    expect(b.end).toHaveBeenCalledTimes(1);
    expect(b.error).not.toHaveBeenCalled();
  });

  it('sin `error` (llamadores antiguos) un fallo se notifica como `end`', () => {
    const svc = setup();
    const end = jest.fn();
    svc.speak('Hi', 'en', 0.9, { end });
    jest.advanceTimersByTime(0);
    spoken().onerror!({ error: 'network' });
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('stop() antes de que empiece: no se dice y `end` llega una sola vez', () => {
    const svc = setup();
    const end = jest.fn();
    svc.speak('Hi', 'en', 0.9, { end });
    svc.stop();
    jest.advanceTimersByTime(5000);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
