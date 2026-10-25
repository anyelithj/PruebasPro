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
  // [hooks · Sprint 9.12]: `boundary` = palabra que empieza a sonar (resaltado y boca del avatar) · `end` = terminó o falló
  speak(
    text: string,
    language: string,
    rate = 0.9,
    hooks: { boundary?: (charIndex: number) => void; end?: () => void } = {},
  ): void {
    if (!this.supported || !text.trim()) return hooks.end?.(); // Sin voz: el llamador sigue su flujo como si hubiera terminado
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text); // `SpeechSynthesisUtterance` (Web Speech API)
    u.lang = this.voiceLang(language);
    u.rate = rate;
    // [Voz]: la mejor instalada del idioma (natural > misma región > mismo idioma); si no hay, el navegador elige por `lang`
    u.voice = this.bestVoice(language);
    u.onstart = () => this.speaking.set(true);
    u.onboundary = (e) => e.name !== 'sentence' && hooks.boundary?.(e.charIndex); // No todos los navegadores informan palabras
    u.onend = u.onerror = () => {
      this.speaking.set(false);
      hooks.end?.();
    };
    synth.speak(u);
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
    if (this.supported) window.speechSynthesis.cancel();
    this.speaking.set(false);
  }
}
