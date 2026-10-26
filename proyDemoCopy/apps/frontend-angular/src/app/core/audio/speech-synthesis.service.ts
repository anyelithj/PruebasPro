import { inject, Injectable, signal } from '@angular/core';
import { AulaEventsService } from '@core/events/aula-events.service';
// [SpeechSynthesisService · core/audio · Sprint 8.3]: voz del navegador (Web Speech API) y preferencia de acento UK/US compartida por traductor, juegos, práctica y widgets | [Patrón]: Facade (sobre speechSynthesis) + Observer (evento aula:accent-changed) | [Principio]: SRP + DRY (un solo lugar que habla) | [Paradigma]: Reactivo (signals)
// [Sin servidor]: la voz la genera el sistema operativo → cero red, cero coste y funciona sin conexión (RF-107)
// [A11y]: el texto siempre está visible; la voz es un complemento (WCAG 1.1.1)

export type Accent = 'uk' | 'us'; // Variantes del inglés que ofrece el interruptor
export const ACCENT_COOKIE = 'aula-accent'; // Cookie legible por Next.js (no es dato sensible)

// [BCP 47]: código de voz por idioma; el inglés depende del acento elegido | `Record` (TS) exhaustivo por código ISO 639-1
const VOICE_LANG: Readonly<Record<string, string>> = {
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-BR',
  zh: 'zh-CN',
  ru: 'ru-RU',
};

// [NATURAL · 2026-10-20]: voces neuronales/naturales que traen Edge, Chrome, Windows 11 y macOS → suenan humanas (espeak-ng suena robótico)
const NATURAL = /natural|neural|online|google|premium|enhanced|siri/i;

// [SpeakHooks]: eventos de una frase hablada | `error` opcional: si falta, un fallo se notifica como `end` (compatibilidad)
export interface SpeakHooks {
  boundary?: (charIndex: number) => void;
  end?: () => void;
  error?: (reason: string) => void;
}

// [2026-10-24]: errores de SpeechSynthesis que son cortes voluntarios, no fallos del motor
const STOPPED: ReadonlySet<string> = new Set(['interrupted', 'canceled']);
const START_TIMEOUT_MS = 4000; // Una voz en red (Google/Microsoft Online) tarda ~1 s en empezar; 4 s = no va a sonar

// [readAccent]: preferencia guardada o «us» | `RegExp` sobre `document.cookie` (DOM) | [Paradigma]: función pura sobre un string
const readAccent = (cookie: string): Accent =>
  /(?:^|;\s*)aula-accent=uk(?:;|$)/.test(cookie) ? 'uk' : 'us';

@Injectable({ providedIn: 'root' })
export class SpeechSynthesisService {
  private readonly events = inject(AulaEventsService);
  // `signal` (Angular): acento activo → las plantillas que muestran IPA eligen la variante sin nueva petición
  readonly accent = signal<Accent>(
    typeof document === 'undefined' ? 'us' : readAccent(document.cookie),
  );
  // `'speechSynthesis' in window`: detección de capacidad → el botón de sonido se oculta si el navegador no habla
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly speaking = signal(false);
  private current: SpeechSynthesisUtterance | null = null; // Frase en curso
  private pending: ReturnType<typeof setTimeout> | undefined; // `speak` diferido un tick tras `cancel`
  private watchdog: ReturnType<typeof setTimeout> | undefined; // Vigilante de arranque
  private interrupt: (() => void) | null = null; // Cierra la frase vigente como «terminada» cuando se corta a propósito

  constructor() {
    // [Sincronía entre widgets]: otro Angular Element (o el shell) cambió el acento → este servicio lo refleja
    this.events
      .on<Accent>('accent-changed')
      .subscribe((a) => this.accent.set(a === 'uk' ? 'uk' : 'us'));
  }

  // [setAccent]: guarda un año en cookie y avisa por evento `aula:accent-changed` (todos los widgets de la página cambian a la vez)
  setAccent(accent: Accent): void {
    if (accent === this.accent()) return;
    this.accent.set(accent);
    document.cookie = `${ACCENT_COOKIE}=${accent}; path=/; max-age=31536000; samesite=lax`;
    this.events.publish('accent-changed', accent);
  }

  // [voiceLang]: etiqueta de voz del idioma (inglés según acento) | [Paradigma]: función pura
  voiceLang(language: string): string {
    return language === 'en'
      ? this.accent() === 'uk'
        ? 'en-GB'
        : 'en-US'
      : (VOICE_LANG[language] ?? language);
  }

  // [hasVoice · Sprint 9.12]: ¿el sistema tiene una voz instalada para el idioma? (si no, la conversación avisa y muestra solo texto)
  hasVoice(language: string): boolean {
    if (!this.supported) return false;
    const voices = window.speechSynthesis.getVoices();
    const base = this.voiceLang(language).split('-')[0];
    return !voices.length || voices.some((v) => v.lang.toLowerCase().startsWith(base)); // Lista vacía = aún cargando → se intenta igual
  }

  // [speak]: pronuncia el texto; cancela lo que estuviera sonando (un solo audio a la vez) | `rate` < 1 → más lento para aprendices
  // [hooks · Sprint 9.12]: `boundary` = palabra que empieza a sonar (resaltado y boca del avatar) · `end` = terminó (o falló sin `error`)
  // [2026-10-24]: `error` = la voz del sistema NO sonó (error del motor, voz en red caída, nunca empezó) → el llamador puede usar el audio del servidor
  speak(text: string, language: string, rate = 0.9, hooks: SpeakHooks = {}): void {
    const fail = (reason: string) => (hooks.error ? hooks.error(reason) : hooks.end?.());
    if (!this.supported || !text.trim()) return fail('unsupported'); // Sin voz: el llamador sigue su flujo
    const synth = window.speechSynthesis;
    this.stop();
    const u = new SpeechSynthesisUtterance(text); // `SpeechSynthesisUtterance` (Web Speech API)
    u.lang = this.voiceLang(language);
    u.rate = rate;
    // [Voz]: la mejor instalada del idioma (natural > misma región > mismo idioma); si no hay, el navegador elige por `lang`
    u.voice = this.bestVoice(language);
    // [settle · Guard]: cada frase termina UNA sola vez (Chrome puede disparar `error` y `end`, o el vigilante y el motor a la vez)
    let settled = false;
    let started = false;
    const settle = (ok: boolean, reason = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(this.watchdog);
      if (this.current === u) {
        this.current = null;
        this.interrupt = null;
        this.speaking.set(false); // Solo la frase vigente apaga el indicador (un `interrupted` tardío de la anterior no)
      }
      if (ok) hooks.end?.();
      else fail(reason);
    };
    u.onstart = () => {
      started = true;
      clearTimeout(this.watchdog);
      this.speaking.set(true);
    };
    u.onboundary = (e) => e.name !== 'sentence' && hooks.boundary?.(e.charIndex); // No todos los navegadores informan palabras
    u.onend = () => settle(true);
    // `interrupted`/`canceled` = lo cortó el propio usuario o una frase nueva → no es un fallo (no se cambia de motor)
    u.onerror = (e) => settle(STOPPED.has(e.error), e.error);
    this.interrupt = () => settle(true); // `stop()` → `end` determinista aunque la frase aún no hubiera empezado
    this.current = u; // [Chrome]: sin una referencia viva el recolector borra la frase y `onend` nunca llega
    // [Chrome · cancel → speak]: hablar en el MISMO tick que `cancel()` a veces descarta la frase en silencio → se espera un tick
    this.pending = setTimeout(() => {
      if (synth.paused) synth.resume(); // Chrome deja la cola en pausa tras ~15 s en segundo plano
      synth.speak(u);
      // [Vigilante]: si la voz no arranca en START_TIMEOUT_MS (voz en red sin conexión, motor del SO colgado) → se da por fallida
      this.watchdog = setTimeout(() => {
        if (this.current === u && !started) {
          synth.cancel();
          settle(false, 'no-start');
        }
      }, START_TIMEOUT_MS);
    }, 0);
  }

  // [bestVoice · 2026-10-20]: puntúa las voces del idioma — natural/neuronal +2, misma región +1 | null = ninguna instalada
  bestVoice(language: string): SpeechSynthesisVoice | null {
    if (!this.supported) return null;
    const tag = this.voiceLang(language);
    const base = tag.split('-')[0];
    const score = (v: SpeechSynthesisVoice) => (NATURAL.test(v.name) ? 2 : 0) + (v.lang.replace('_', '-') === tag ? 1 : 0);
    return (
      window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang.toLowerCase().startsWith(base))
        .sort((a, b) => score(b) - score(a))[0] ?? null
    );
  }

  // [hasNaturalVoice]: ¿hay una voz natural para el idioma? → se usa antes que el audio de espeak-ng del servidor
  hasNaturalVoice(language: string): boolean {
    const v = this.bestVoice(language);
    return !!v && NATURAL.test(v.name);
  }

  stop(): void {
    clearTimeout(this.pending); // Frase programada que aún no empezó → ya no se dice
    clearTimeout(this.watchdog);
    this.interrupt?.(); // El llamador recibe su `end` (estado del avatar coherente)
    this.interrupt = null;
    this.current = null;
    if (this.supported) window.speechSynthesis.cancel();
    this.speaking.set(false);
  }
}
