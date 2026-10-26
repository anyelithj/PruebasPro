import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Subscription } from 'rxjs';
import { LipSyncService } from '@core/audio/lip-sync.service';
import { ServerAudioService } from '@core/audio/server-audio.service';
import { isServerSpeechDown } from '@core/audio/server-speech';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import type { AvatarState } from '@shared/ui/organisms/avatar-stage/avatar-state';
import type { Recording } from '@shared/ui/organisms/voice-recorder/voice-recorder.component';
import { DialoguesRepository } from '../domain/dialogues.repository.port';
import { TurnSchema, type Session, type Topic, type Turn } from '../domain/models/dialogues';
// [DialogueAgentFacade · Aplicación · Sprint 9.12 · RF-122/RF-124]: conversación con el avatar — iniciar, enviar lo dicho (voz → texto con faster-whisper) o escrito, recibir la respuesta en streaming (SSE), hablarla con la voz del navegador y resaltar el turno que suena | [Patrón]: Facade + State Machine (en reposo → escuchando → pensando → hablando) + Observer (SSE) | [Principio]: SRP + DIP + privacidad (la grabación solo la escucha su dueño y se borra con la conversación) | [Paradigma]: Reactivo (signals + RxJS) + async/await
// [Sin voz]: si el navegador no tiene voz para el idioma se avisa y la conversación sigue solo con texto

@Injectable()
export class DialogueAgentFacade {
  private readonly repo = inject(DialoguesRepository);
  private readonly speech = inject(SpeechSynthesisService);
  private readonly voice = inject(ServerAudioService); // [2026-10-24]: voz natural → audio del servidor comprobado (no mudo) → voz del sistema
  readonly lipSync = inject(LipSyncService);

  readonly session = signal<Session | null>(null);
  readonly topic = signal<Topic | null>(null);
  readonly turns = signal<Turn[]>([]);
  readonly state = signal<AvatarState>('idle');
  readonly speakingIndex = signal<number | null>(null); // Turno resaltado mientras suena
  readonly partial = signal(''); // Respuesta del avatar llegando palabra a palabra
  readonly lastCorrection = signal<string | null>(null);
  readonly vocabularyUsed = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly busy = computed(() => this.state() === 'thinking' || this.state() === 'listening');
  readonly ended = computed(() => this.session()?.status === 'ended');
  readonly noVoice = signal(false);
  // [2026-10-25]: el servidor no pudo transcribir (faster-whisper no instalado o caído) → la página muestra el respaldo (dictado/escribir), no un error
  readonly serverSpeechDown = signal(false);
  private stream: Subscription | null = null;
  private pendingRecording: Blob | null = null; // [2026-10-20]: voz del próximo turno del usuario (se sube cuando NestJS devuelve su id)

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stream?.unsubscribe();
      this.voice.stop();
      this.lipSync.detach();
    });
  }

  async start(topicId: string, language: string, level: string): Promise<boolean> {
    this.error.set(null);
    this.state.set('thinking');
    try {
      const r = await firstValueFrom(this.repo.startSession({ topicId, language, level }));
      this.session.set(r.session);
      this.topic.set(r.topic);
      this.turns.set(r.turns);
      this.vocabularyUsed.set([]);
      this.noVoice.set(!this.speech.hasVoice(language));
      this.say(r.turns.length - 1);
      return true;
    } catch (err) {
      this.fail(err);
      return false;
    }
  }

  // [load]: transcripción de una conversación anterior (solo lectura)
  async load(id: string): Promise<void> {
    try {
      const s = await firstValueFrom(this.repo.getSession(id));
      this.session.set(s);
      this.turns.set(s.turns);
      this.vocabularyUsed.set(s.vocabularyUsed);
    } catch (err) {
      this.fail(err);
    }
  }

  // [send]: SSE — `user` (turno guardado) → `token`… (texto del avatar en vivo) → `avatar` (turno con IPA y traducción) → `done`
  send(text: string): void {
    const s = this.session();
    if (!s || !text.trim() || this.ended()) return;
    this.error.set(null);
    this.partial.set('');
    this.state.set('thinking');
    this.voice.stop();
    this.stream?.unsubscribe();
    this.stream = this.repo.streamTurn(s.id, text.trim()).subscribe({
      next: (m) => {
        if (m.type === 'user') {
          const t = TurnSchema.parse(m.data);
          this.turns.update((ts) => [...ts, t]);
          this.lastCorrection.set(t.correction);
          this.keepRecording(s.id, t.id);
        } else if (m.type === 'token') this.partial.update((p) => p + String(m.data['text'] ?? ''));
        else if (m.type === 'avatar') {
          this.partial.set('');
          this.turns.update((ts) => [...ts, TurnSchema.parse(m.data)]);
          this.vocabularyUsed.set(
            (m.data['vocabularyUsed'] as string[] | undefined) ?? this.vocabularyUsed(),
          );
          // [2026-10-23]: `ended` = el usuario se despidió → la sesión queda terminada (el avatar ya no pregunta más)
          const ended = m.data['ended'] === true;
          this.session.update((x) => (x ? { ...x, userTurns: x.userTurns + 1, status: ended ? 'ended' : x.status } : x));
          this.say(this.turns().length - 1);
        } else if (m.type === 'error') this.fail(new Error(String(m.data['message'] ?? 'Error')));
      },
      error: (err) => this.fail(err),
    });
  }

  // [transcribe]: voz del usuario → texto (faster-whisper en el idioma de la sesión; no se guarda el audio) | [2026-10-19]: ya NO se envía solo:
  // el texto va al campo para que el alumno lo revise y corrija antes de enviarlo (antes se enviaba directo y no se podía evaluar)
  async transcribe(rec: Recording, fallback = ''): Promise<string | null> {
    const s = this.session();
    if (!s) return null;
    this.pendingRecording = rec.blob; // Se guarda con el turno al enviarlo
    this.state.set('thinking');
    try {
      const text = await firstValueFrom(this.repo.transcribe(rec.blob, s.language));
      if (!text)
        throw new Error(
          'No se entendió la grabación. Habla más cerca del micrófono o escribe tu respuesta.',
        );
      this.state.set('idle');
      this.serverSpeechDown.set(false);
      return text;
    } catch (err) {
      // [2026-10-25]: servidor sin voz a texto (503 SPEECH_ENGINE_MISSING, caído, sin red) → respaldo, no error; `pendingRecording` se conserva
      // y se guarda en «Mis grabaciones» cuando el alumno envíe el texto dictado o escrito
      const down = isServerSpeechDown(err);
      this.serverSpeechDown.set(down);
      // [2026-10-20]: si el reconocimiento en vivo del navegador ya escribió el texto, un fallo de Whisper (p. ej. falta de RAM) no es un error para el alumno
      if (down || fallback.trim()) this.state.set('idle');
      else this.fail(err);
      return null;
    }
  }

  // [recordingUrl]: dónde escuchar la grabación guardada de un turno
  recordingUrl(turnId: string): string | null {
    const s = this.session();
    return s ? this.repo.recordingUrl(s.id, turnId) : null;
  }

  // [keepRecording]: sube la voz pendiente al turno recién guardado; si falla, la conversación sigue (solo se pierde la grabación)
  private keepRecording(sessionId: string, turnId: string): void {
    const blob = this.pendingRecording;
    this.pendingRecording = null;
    if (!blob?.size) return;
    this.repo.saveRecording(sessionId, turnId, blob).subscribe({
      next: (saved) => this.turns.update((ts) => ts.map((x) => (x.id === saved.id ? { ...x, audioKey: saved.audioKey } : x))),
      error: () => undefined,
    });
  }

  listening(): void {
    this.voice.stop();
    this.state.set('listening');
  }

  // [say]: el avatar habla el turno y queda resaltado mientras suena | [2026-10-24]: antes solo usaba la voz del navegador y, si esa
  // voz no sonaba (o el WAV del servidor llegaba mudo), la respuesta de AULA quedaba en silencio → ServerAudioService encadena
  // voz natural → audio del servidor comprobado → voz del sistema | boca del avatar: eventos de palabra (voz del sistema) o volumen real (audio del servidor)
  say(index: number): void {
    const turn = this.turns()[index];
    const s = this.session();
    if (!turn || !s) return;
    this.voice.stop(); // Cierra lo que sonaba ANTES de marcar el turno nuevo (su `end` ya no lo desmarca)
    this.speakingIndex.set(index);
    this.state.set('speaking');
    void this.voice.play(turn.text, s.language, 0.9, {
      boundary: () => this.lipSync.pulse(),
      audio: (el) => this.lipSync.attach(el),
      end: () => {
        this.lipSync.detach();
        this.speakingIndex.set(null);
        if (this.state() === 'speaking') this.state.set('idle');
      },
    });
  }

  async end(): Promise<void> {
    const s = this.session();
    if (!s) return;
    try {
      this.session.set(await firstValueFrom(this.repo.endSession(s.id)));
      this.voice.stop();
      this.state.set('idle');
    } catch (err) {
      this.fail(err);
    }
  }

  async remove(): Promise<boolean> {
    const s = this.session();
    if (!s) return false;
    try {
      await firstValueFrom(this.repo.deleteSession(s.id));
      this.session.set(null);
      this.turns.set([]);
      return true;
    } catch (err) {
      this.fail(err);
      return false;
    }
  }

  private fail(err: unknown): void {
    this.error.set(err instanceof Error ? err.message : String(err));
    this.state.set('idle');
  }
}
