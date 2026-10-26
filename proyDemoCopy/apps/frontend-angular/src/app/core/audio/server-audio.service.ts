import { inject, Injectable, signal } from '@angular/core';
import { API_URL } from '@core/http/api-url.token';
import { isAudible } from './audio-audibility';
import { SpeechSynthesisService } from './speech-synthesis.service';
// [ServerAudioService · core/audio]: audio de pronunciación del SERVIDOR (espeak-ng → caché en el almacén de objetos MinIO/R2 = «nube») con copia LOCAL en Cache Storage del navegador y respaldo a la voz del navegador | [Patrón]: Facade + Cache-Aside (dos niveles: navegador → nube) + Chain of Responsibility (voz natural → servidor → voz del sistema) | [Principio]: SRP + DRY (lo usan el botón de pronunciación, las transcripciones y el avatar de la conversación) | [Paradigma]: async/await
// [Por qué]: los turnos de diálogos y el vocabulario sonaban solo con la voz del sistema (y no sonaban si el SO no tenía la voz del idioma); ahora el audio queda guardado y se repite sin red
// [2026-10-24]: la respuesta de AULA podía llegar como WAV mudo y se reproducía en silencio → el audio se comprueba (RMS) antes de sonar; si está vacío o mudo se borra de la copia local y habla la voz del navegador

// `caches` (Cache Storage API): sobrevive a recargas y funciona sin conexión | v2: descarta los WAV de espeak con cabecera rota guardados por v1
const CACHE = 'aula-audio-v2';
const OLD_CACHES = ['aula-audio-v1'];

// [PlayHooks]: eventos de una reproducción | `audio` = elemento del servidor que va a sonar (boca del avatar con Web Audio) · `end` = terminó, falló o se cortó (UNA vez)
export interface PlayHooks {
  boundary?: (charIndex: number) => void;
  audio?: (el: HTMLAudioElement) => void;
  end?: () => void;
}

@Injectable({ providedIn: 'root' })
export class ServerAudioService {
  private readonly api = inject(API_URL);
  private readonly speech = inject(SpeechSynthesisService);
  private audio: HTMLAudioElement | null = null;
  private finish: (() => void) | null = null; // Cierre de la reproducción vigente (las anteriores quedan anuladas)
  readonly playing = signal<string | null>(null); // Texto que suena (resalta el botón activo)

  constructor() {
    // [Limpieza]: borra versiones anteriores de la copia local (podían contener audio mudo) | `void` + `catch`: no bloquea ni rompe sin Cache Storage
    if (typeof caches !== 'undefined') for (const old of OLD_CACHES) void caches.delete(old).catch(() => undefined);
  }

  // [url]: GET /api/audio (BFF de Next.js → NestJS) | inglés con la variante del acento elegido (IPA y voz coinciden)
  url(text: string, language: string): string {
    const q = new URLSearchParams({ text, language });
    if (language === 'en') q.set('variant', this.speech.accent() === 'uk' ? 'en-GB' : 'en-US');
    return `${this.api}/audio?${q}`;
  }

  // [play]: voz natural del sistema → audio del servidor (copia local → nube) → voz del sistema; un solo audio a la vez | `rate` < 1 → más lento
  async play(text: string, language: string, rate = 0.9, hooks: PlayHooks = {}): Promise<void> {
    this.stop();
    // [done · Guard]: `end` UNA sola vez y solo si esta reproducción sigue vigente (una nueva o `stop()` la reemplaza)
    const finish = () => {
      this.playing.set(null);
      hooks.end?.();
    };
    this.finish = finish;
    const current = () => this.finish === finish;
    const done = () => {
      if (!current()) return;
      this.finish = null;
      finish();
    };
    if (!text.trim()) return done();
    this.playing.set(text);
    const browserVoice = () => this.speech.speak(text, language, rate, { boundary: hooks.boundary, end: done });
    const server = async () => {
      try {
        await this.playServer(text, language, rate, current, done, hooks.audio);
      } catch {
        // [Fallback]: servidor de voz apagado, audio vacío/mudo o el navegador no lo decodifica → voz del sistema; el texto sigue visible (WCAG 1.1.1)
        if (current()) browserVoice();
      }
    };
    // [2026-10-20]: con una voz natural instalada (Edge/Chrome/Windows 11/macOS) se usa ESA: suena humana; espeak-ng queda de respaldo
    // [2026-10-24]: si esa voz no suena (voz en red sin conexión, error del motor) → audio del servidor en vez de silencio
    if (this.speech.hasNaturalVoice(language)) {
      this.speech.speak(text, language, rate, { boundary: hooks.boundary, end: done, error: () => void (current() && server()) });
      return;
    }
    await server();
  }

  stop(): void {
    const finish = this.finish;
    this.finish = null; // Anula la reproducción vigente antes de cortar (sus eventos tardíos ya no cuentan)
    this.audio?.pause();
    this.audio = null;
    this.speech.stop();
    this.playing.set(null);
    finish?.(); // El llamador recibe su `end` (p. ej. el avatar vuelve a reposo)
  }

  // [playServer]: descarga (o lee de la copia local), comprueba que SUENA y reproduce | lanza si no hay audio útil → el llamador usa la voz del sistema
  private async playServer(
    text: string,
    language: string,
    rate: number,
    current: () => boolean,
    done: () => void,
    onAudio?: (el: HTMLAudioElement) => void,
  ): Promise<void> {
    const url = this.url(text, language);
    const blob = await this.fetchCached(url);
    if (!(await isAudible(blob))) {
      await this.evict(url); // Un audio mudo no se vuelve a servir desde la copia local
      throw new Error('Audio del servidor vacío o en silencio');
    }
    if (!current()) return; // Mientras se descargaba, empezó otra reproducción o se detuvo
    const src = URL.createObjectURL(blob); // `createObjectURL`: el <audio> lee el blob sin volver a la red
    const a = new Audio(src);
    a.muted = false; // Explícito: nunca se reproduce silenciado ni con volumen 0
    a.volume = 1;
    // [Sin cortes]: frenar un WAV con `playbackRate` lo trocea → velocidad normal salvo el modo lento explícito (< 0,8)
    a.playbackRate = rate < 0.8 ? rate : 1;
    const release = () => {
      URL.revokeObjectURL(src); // Libera la memoria del blob
      if (this.audio === a) this.audio = null;
    };
    a.onended = () => {
      release();
      done();
    };
    this.audio = a;
    onAudio?.(a);
    try {
      await a.play(); // `play()` rechaza si el navegador no puede decodificarlo o bloquea la reproducción
    } catch (err) {
      release();
      throw err;
    }
    // [onerror tras empezar]: el flujo se corta a mitad → se da por terminado (el texto sigue visible)
    a.onerror = () => {
      release();
      done();
    };
  }

  // [fetchCached]: Cache Storage si existe (contexto seguro); si no, red directa | solo se guardan respuestas 200 completas
  // `cache: 'no-cache'` (Fetch API): revalida con el servidor → no reutiliza un WAV viejo de la caché HTTP (max-age de un día)
  private async fetchCached(url: string): Promise<Blob> {
    const store = await this.store();
    const hit = await store?.match(url);
    if (hit) return hit.blob();
    const res = await fetch(url, { credentials: 'include', cache: 'no-cache' });
    if (!res.ok) throw new Error(`audio ${res.status}`);
    if (store && res.status === 200) await store.put(url, res.clone()).catch(() => undefined); // Cuota llena → se reproduce igual
    return res.blob();
  }

  private async evict(url: string): Promise<void> {
    await (await this.store())?.delete(url).catch(() => false);
  }

  private async store(): Promise<Cache | null> {
    return typeof caches === 'undefined' ? null : caches.open(CACHE).catch(() => null);
  }
}
