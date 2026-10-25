import { inject, Injectable, signal } from '@angular/core';
import { API_URL } from '@core/http/api-url.token';
import { SpeechSynthesisService } from './speech-synthesis.service';
// [ServerAudioService · core/audio]: audio de pronunciación del SERVIDOR (espeak-ng → caché en el almacén de objetos MinIO/R2 = «nube») con copia LOCAL en Cache Storage del navegador y respaldo a la voz del navegador | [Patrón]: Facade + Cache-Aside (dos niveles: navegador → nube) + Fallback | [Principio]: SRP + DRY (lo usan el botón de pronunciación y las transcripciones de diálogos) | [Paradigma]: async/await
// [Por qué]: los turnos de diálogos y el vocabulario sonaban solo con la voz del sistema (y no sonaban si el SO no tenía la voz del idioma); ahora el audio queda guardado y se repite sin red

const CACHE = 'aula-audio-v1'; // `caches` (Cache Storage API): sobrevive a recargas y funciona sin conexión

@Injectable({ providedIn: 'root' })
export class ServerAudioService {
  private readonly api = inject(API_URL);
  private readonly speech = inject(SpeechSynthesisService);
  private audio: HTMLAudioElement | null = null;
  readonly playing = signal<string | null>(null); // Texto que suena (resalta el botón activo)

  // [url]: GET /api/audio (BFF de Next.js → NestJS) | inglés con la variante del acento elegido (IPA y voz coinciden)
  url(text: string, language: string): string {
    const q = new URLSearchParams({ text, language });
    if (language === 'en') q.set('variant', this.speech.accent() === 'uk' ? 'en-GB' : 'en-US');
    return `${this.api}/audio?${q}`;
  }

  // [play]: copia local → servidor → voz del navegador; un solo audio a la vez | `rate` < 1 → más lento para aprendices
  async play(text: string, language: string, rate = 0.9): Promise<void> {
    this.stop();
    if (!text.trim()) return;
    this.playing.set(text);
    // [2026-10-20]: con una voz natural instalada (Edge/Chrome/Windows 11/macOS) se usa ESA: suena humana; espeak-ng queda de respaldo
    if (this.speech.hasNaturalVoice(language)) {
      this.speech.speak(text, language, rate, { end: () => this.playing.set(null) });
      return;
    }
    try {
      const blob = await this.fetchCached(this.url(text, language));
      const src = URL.createObjectURL(blob); // `createObjectURL`: el <audio> lee el blob sin volver a la red
      const a = new Audio(src);
      // [Sin cortes]: frenar un WAV con `playbackRate` lo trocea → velocidad normal salvo el modo lento explícito (< 0,8)
      a.playbackRate = rate < 0.8 ? rate : 1;
      a.onended = a.onerror = () => {
        URL.revokeObjectURL(src);
        if (this.audio === a) this.playing.set(null);
      };
      this.audio = a;
      await a.play();
    } catch {
      // [Fallback]: sin servidor de voz (FastAPI/espeak apagados) → voz del sistema; el texto sigue visible (WCAG 1.1.1)
      this.speech.speak(text, language, rate, { end: () => this.playing.set(null) });
    }
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.speech.stop();
    this.playing.set(null);
  }

  // [fetchCached]: Cache Storage si existe (contexto seguro); si no, red directa | solo se guardan respuestas 200 completas
  private async fetchCached(url: string): Promise<Blob> {
    const store = typeof caches === 'undefined' ? null : await caches.open(CACHE).catch(() => null);
    const hit = await store?.match(url);
    if (hit) return hit.blob();
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`audio ${res.status}`);
    if (store && res.status === 200) await store.put(url, res.clone()).catch(() => undefined); // Cuota llena → se reproduce igual
    return res.blob();
  }
}
