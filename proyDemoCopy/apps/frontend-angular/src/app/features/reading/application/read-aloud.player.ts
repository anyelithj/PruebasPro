import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { ServerAudioService } from '@core/audio/server-audio.service';
import { estimateMs, tokenize, wordAtChar, wordAtProgress, type Token } from '../domain/models/reading';
// [ReadAloudPlayer · Aplicación · Lectura · 2026-10-25]: lectura en voz alta FRASE A FRASE con la palabra activa resaltada — reproducir/pausar, velocidad 0,75x/1x, repetir la frase y saltar a cualquier frase
// [Audio]: ServerAudioService (voz natural del sistema → WAV del servidor con caché → voz del sistema) — el mismo que diálogos y vocabulario (DRY)
// [Sincronía palabra a palabra · Chain of Responsibility]: 1) eventos `boundary` de la voz del navegador (exactos) → 2) avance real del <audio> del servidor (currentTime/duration repartido por letras)
// → 3) estimación por caracteres con reloj propio (sin audio ni eventos). La primera fuente disponible reemplaza a la anterior
// [Patrón]: State Machine (idle → playing ⇄ paused) + Strategy (fuente de sincronía) + Generation Token (`run`: eventos tardíos de una frase anterior se ignoran) | [Principio]: SRP (la página solo pinta) | [Paradigma]: Reactivo (signals) + requestAnimationFrame

export type PlayerState = 'idle' | 'playing' | 'paused';
export type SyncSource = 'boundary' | 'audio' | 'estimate';
export type ReadingRate = 0.75 | 1;

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
    // 3) Estimación por caracteres hasta que llegue algo mejor
    const t0 = performance.now();
    const ms = estimateMs(text, rate);
    this.sync.set('estimate');
    this.ticker(gen, () => wordAtProgress(tokens, (performance.now() - t0) / ms));
    void this.audio.play(text, this.language, rate, {
      // 1) Voz del navegador con eventos de palabra: exactos
      boundary: (charIndex) => {
        if (gen !== this.run) return;
        this.stopTicker();
        this.sync.set('boundary');
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
