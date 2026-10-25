import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Recording } from '@shared/ui/organisms/voice-recorder/voice-recorder.component';
import { GamesRepository } from '../domain/games.repository.port';
import type { SubmitResult, Transcription } from '../domain/models/games';
import { GamesFacade } from './games.facade';
// [SpeechFacade · Aplicación · Sprints 8.6/8.9]: «transcribir lo que dije» (faster-whisper en FastAPI) y «guardar la ronda oral con sus métricas de fluidez» | [Patrón]: Facade + Pipeline (grabar → transcribir → ronda con marcas de tiempo → métrica) | [Principio]: SRP + DIP + DRY (hablar contra reloj, tema al azar y shadowing comparten el flujo) | [Paradigma]: async/await + signals
// [Privacidad]: el audio solo viaja para transcribirse; NestJS y FastAPI no lo guardan (solo texto y marcas de tiempo)

@Injectable()
export class SpeechFacade {
  private readonly repo = inject(GamesRepository);
  private readonly games = inject(GamesFacade);

  readonly transcribing = signal(false);
  readonly transcript = signal<Transcription | null>(null);
  readonly error = signal<string | null>(null);

  // [submitOral]: transcribe y envía la ronda (respuesta = texto reconocido) → NestJS calcula la métrica de fluidez con las marcas por palabra
  async submitOral(
    rec: Recording,
    extra: { prompt?: string; lineIndex?: number; timeToAnswerMs?: number } = {},
  ): Promise<SubmitResult | null> {
    const s = this.games.session();
    if (!s) return null;
    this.transcribing.set(true);
    this.error.set(null);
    try {
      const t = await firstValueFrom(this.repo.transcribe(rec.blob, s.language));
      this.transcript.set(t);
      // `words.length === 0`: silencio o audio ininteligible → se avisa sin enviar una ronda vacía
      if (!t.words.length)
        throw new Error(
          'No se entendió la grabación. Habla más cerca del micrófono e inténtalo otra vez.',
        );
      return await this.games.answer({
        answer: t.text,
        words: t.words,
        durationMs: rec.durationMs,
        promptEndS: 0,
        ...extra,
      });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.transcribing.set(false);
    }
  }

  // [toText]: solo transcribe (tabú hablado, role-play por voz) → el texto se envía como turno al agente
  async toText(rec: Recording, language: string): Promise<string | null> {
    this.transcribing.set(true);
    this.error.set(null);
    try {
      const t = await firstValueFrom(this.repo.transcribe(rec.blob, language));
      this.transcript.set(t);
      return t.text.trim() || null;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.transcribing.set(false);
    }
  }

  reset(): void {
    this.transcript.set(null);
    this.error.set(null);
  }
}
