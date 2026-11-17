import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ServerAudioService } from '@core/audio/server-audio.service';
import { estimateMs, tokenize, wordAtChar, wordAtProgress, type Token } from '../domain/models/reading';
// [ReadAloudPlayer · Aplicación · Lectura · 2026-10-25]: lectura en voz alta FRASE A FRASE con la palabra activa resaltada — reproducir/pausar, velocidad 0,75x/1x, repetir la frase y saltar a cualquier frase
// [Audio]: ServerAudioService (voz natural del sistema → WAV del servidor con caché → voz del sistema) — el mismo que diálogos y vocabulario (DRY)
// [Sincronía palabra a palabra · Chain of Responsibility]: 1) eventos `boundary` de la voz del navegador (exactos) → 2) avance real del <audio> del servidor (currentTime/duration repartido por letras)
// → 3) estimación por caracteres con reloj propio (sin audio ni eventos). La primera fuente disponible reemplaza a la anterior
// [Fix 2026-10-31 · resaltado desfasado de la voz]: (a) la estimación arranca cuando la voz SUENA (`start`), no al pedirla; (b) un solo `boundary` (voces que solo avisan al empezar) ya no congela el resaltado; (c) la estimación aprende la velocidad real de la voz frase a frase (`cps`)
// [Patrón]: State Machine (idle → playing ⇄ paused) + Strategy (fuente de sincronía) + Generation Token (`run`: eventos tardíos de una frase anterior se ignoran) | [Principio]: SRP (la página solo pinta) | [Paradigma]: Reactivo (signals) + requestAnimationFrame

export type PlayerState = 'idle' | 'playing' | 'paused';
export type SyncSource = 'boundary' | 'audio' | 'estimate';
export type ReadingRate = 0.75 | 1 | 1.25 | 1.5; // [2026-11-05]: mismas velocidades que Lecciones (Next.js)

@Injectable() // Proveedor por pantalla (no root): cada lector tiene su propio estado
export class ReadAloudPlayer {
  private readonly audio = inject(ServerAudioService);
  readonly state = signal<PlayerState>('idle');
  readonly sentence = signal(0); // Frase actual (posición global)
  readonly word = signal(-1); // Palabra activa dentro de la frase (-1 = ninguna)
  readonly rate = signal<ReadingRate>(1);
  readonly repeat = signal(false); // true = la frase actual se repite en bucle
  readonly sync = signal<SyncSource | null>(null); // Qué fuente marca la palabra (se muestra al usuario)
  onSentence: (index: number) => void = () => undefined; // La página guarda el marcador
  onFinish: () => void = () => undefined;

  private texts: readonly string[] = [];
  private language = 'en';
  private tokens = new Map<number, Token[]>(); // `Map` (ES2015): caché de palabras por frase
  private run = 0; // Generation Token
  private raf = 0;
  private cps = 14; // Caracteres por segundo de la voz a 1x (se ajusta al terminar cada frase estimada)

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop()); // Al salir de la pantalla no sigue sonando
  }

  load(texts: readonly string[], language: string, start = 0): void {
    this.stop();
    this.texts = texts;
    this.language = language;
    this.tokens.clear();
    this.sentence.set(Math.min(Math.max(start, 0), Math.max(texts.length - 1, 0)));
  }

  tokensOf(index: number): Token[] {
    let t = this.tokens.get(index);
    if (!t) this.tokens.set(index, (t = tokenize(this.texts[index] ?? '', this.language)));
    return t;
  }

  toggle(): void {
    if (this.state() === 'playing') this.pause();
    else this.play();
  }

  play(from = this.sentence()): void {
    this.state.set('playing');
    this.speak(from);
  }

  // [pause]: corta el audio y recuerda la frase → «reproducir» la retoma desde su inicio (la voz del sistema no admite pausa fiable)
  pause(): void {
    if (this.state() !== 'playing') return;
    this.run++;
    this.state.set('paused');
    this.halt();
  }

  stop(): void {
    this.run++;
    this.state.set('idle');
    this.word.set(-1);
    this.halt();
  }

  // [seek]: ir a una frase (clic en la frase o «anterior/siguiente») — si estaba sonando, sigue desde ahí
  seek(index: number, word = -1): void {
    if (index < 0 || index >= this.texts.length) return;
    if (this.state() === 'playing') return this.speak(index);
    this.sentence.set(index);
    this.word.set(word);
  }

  setRate(rate: ReadingRate): void {
    this.rate.set(rate);
    if (this.state() === 'playing') this.speak(this.sentence()); // Se aplica desde la frase actual
  }

  private speak(index: number): void {
    const text = this.texts[index];
    const gen = ++this.run;
    this.stopTicker();
    if (text === undefined) return this.finish();
    this.sentence.set(index);
    this.word.set(0);
    this.onSentence(index);
    const tokens = this.tokensOf(index);
    const rate = this.rate();
    // 3) Estimación por caracteres hasta que llegue algo mejor | `t0 = 0`: la voz aún no suena → el resaltado espera en la primera palabra
    let t0 = 0;
    let boundaries = 0;
    const ms = estimateMs(text, rate, this.cps);
    this.sync.set('estimate');
    this.ticker(gen, () => (t0 ? wordAtProgress(tokens, (performance.now() - t0) / ms) : -1));
    void this.audio.play(text, this.language, rate, {
      preferBrowserVoice: true, // [Fix 2026-11-05 · resaltado desfasado]: el WAV del servidor no da tiempos por palabra → voz del navegador con `boundary`
      start: () => {
        if (gen === this.run) t0 = performance.now();
      },
      // 1) Voz del navegador con eventos de palabra: exactos | desde el 2.º evento se confía en ellos (algunas voces solo emiten uno)
      boundary: (charIndex) => {
        if (gen !== this.run) return;
        if (++boundaries > 1) {
          this.stopTicker();
          this.sync.set('boundary');
        }
        this.word.set(wordAtChar(tokens, charIndex));
      },
      // 2) Audio del servidor: avance real del <audio>
      audio: (el) => {
        if (gen !== this.run) return;
        this.sync.set('audio');
        this.ticker(gen, () => (el.duration > 0 && Number.isFinite(el.duration) ? wordAtProgress(tokens, el.currentTime / el.duration) : -1));
      },
      end: () => {
        if (gen !== this.run || this.state() !== 'playing') return;
        this.stopTicker();
        // [Aprende la velocidad]: duración real de esta frase → la estimación de las siguientes se acerca a la voz | `> 500`: descarta frases cortísimas y cortes
        if (this.sync() === 'estimate' && t0 && performance.now() - t0 > 500) this.cps = (text.length / ((performance.now() - t0) / 1000)) * rate;
        if (this.repeat()) return this.speak(index);
        if (index + 1 < this.texts.length) return this.speak(index + 1);
        this.finish();
      },
    });
  }

  private finish(): void {
    this.state.set('idle');
    this.word.set(-1);
    this.stopTicker();
    this.onFinish();
  }

  private halt(): void {
    this.stopTicker();
    this.audio.stop();
  }

  // [ticker]: bucle requestAnimationFrame (~60 fps, se detiene solo en segundo plano) que actualiza la palabra activa | `requestAnimationFrame` (DOM)
  private ticker(gen: number, current: () => number): void {
    this.stopTicker();
    const step = () => {
      if (gen !== this.run) return;
      const w = current();
      if (w >= 0 && w !== this.word()) this.word.set(w);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private stopTicker(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
