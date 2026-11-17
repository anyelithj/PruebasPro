import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Subscription } from 'rxjs';
import { LipSyncService } from '@core/audio/lip-sync.service';
import { ServerAudioService } from '@core/audio/server-audio.service';
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
  readonly vocabularyUsed = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly busy = computed(() => this.state() === 'thinking' || this.state() === 'listening');
  readonly ended = computed(() => this.session()?.status === 'ended');
  readonly noVoice = signal(false);
  private stream: Subscription | null = null;
  private pendingRecording: Blob | null = null; // [2026-10-20]: voz del próximo turno del usuario (se asocia cuando NestJS devuelve su id)
  // [2026-11-05 · Solo local]: grabaciones en memoria de la pestaña (blob: URL) — no se suben ni se guardan en ninguna base de datos; se liberan al salir
  private readonly localRecordings = new Map<string, string>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stream?.unsubscribe();
      this.localRecordings.forEach((url) => URL.revokeObjectURL(url));
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
  send(text: string, origin: 'voz' | 'escrito' = 'escrito'): void {
    const s = this.session();
    if (!s || !text.trim() || this.ended()) return;
    this.error.set(null);
    this.partial.set('');
    this.state.set('thinking');
    this.voice.stop();
    this.stream?.unsubscribe();
    this.stream = this.repo.streamTurn(s.id, text.trim(), origin).subscribe({
      next: (m) => {
        if (m.type === 'user') {
          const t = TurnSchema.parse(m.data);
          this.turns.update((ts) => [...ts, t]);
          this.keepRecording(t.id);
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

  // [heard · 2026-11-09]: la voz se queda SOLO en este navegador mientras dura la actividad → el texto lo da el dictado del navegador
  // (Web Speech) y el audio queda en memoria para «Mis grabaciones» | nada se sube ni se guarda en el servidor
  heard(rec: Recording): void {
    this.pendingRecording = rec.blob;
    this.state.set('idle');
  }

  // [recordingUrl]: grabación local del turno (null = no hay)
  recordingUrl(turnId: string): string | null {
    return this.localRecordings.get(turnId) ?? null;
  }

  // [keepRecording · 2026-11-05]: la voz pendiente queda en memoria asociada al turno (blob: URL) — nada se envía al servidor
  private keepRecording(turnId: string): void {
    const blob = this.pendingRecording;
    this.pendingRecording = null;
    if (!blob?.size) return;
    this.localRecordings.set(turnId, URL.createObjectURL(blob)); // `URL.createObjectURL` (Web API): reproducible con <audio> sin red
    this.turns.update((ts) => ts.map((x) => (x.id === turnId ? { ...x, audioKey: 'local' } : x)));
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
