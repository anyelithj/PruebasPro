import { inject, Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { isServerSpeechDown } from '@core/audio/server-speech';
import { AsyncState } from '@shared/utils/async-state';
import { DialoguesRepository } from '../domain/dialogues.repository.port';
import type {
  Dialogue,
  DialogueDetail,
  DialogueDraft,
  DialogueFilter,
  DialogueInput,
  DraftRequest,
  Session,
  Topic,
  TopicInput,
} from '../domain/models/dialogues';
// [DialoguesFacade · Aplicación · Sprints 9.11/9.13]: casos de uso de temas, biblioteca, subida con nivel estimado, audio sincronizado, confirmación docente e historial de conversaciones | [Patrón]: Facade + State Machine (AsyncState) + Command (`act`) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await

@Injectable()
export class DialoguesFacade {
  private readonly repo = inject(DialoguesRepository);

  readonly topics = new AsyncState<Topic[]>((l) => !l.length);
  readonly library = new AsyncState<Dialogue[]>((l) => !l.length);
  readonly mine = new AsyncState<Dialogue[]>((l) => !l.length);
  readonly pending = new AsyncState<Dialogue[]>((l) => !l.length);
  readonly dialogue = new AsyncState<DialogueDetail>();
  readonly history = new AsyncState<Session[]>((l) => !l.length);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly serverSpeechDown = signal(false); // [2026-10-25]: el servidor no transcribe (faster-whisper ausente o caído) → la página ofrece el respaldo

  private async act<T>(source: Observable<T>): Promise<T | null> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      return await firstValueFrom(source);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  loadTopics(f: { language?: string; level?: string }) {
    return this.topics.run(this.repo.listTopics(f));
  }
  loadLibrary(f: DialogueFilter) {
    return this.library.run(this.repo.listDialogues(f));
  }
  loadMine() {
    return this.mine.run(this.repo.listDialogues({ mine: true }));
  }
  loadPending() {
    return this.pending.run(this.repo.listDialogues({ pending: true }));
  }
  loadDialogue(id: string) {
    return this.dialogue.run(this.repo.getDialogue(id));
  }
  loadHistory() {
    return this.history.run(this.repo.listSessions());
  }

  async createTopic(input: TopicInput): Promise<Topic | null> {
    const t = await this.act(this.repo.createTopic(input));
    if (t) this.topics.set([...(this.topics.data() ?? []), t]);
    return t;
  }

  // [create]: guarda el diálogo; NestJS obtiene IPA y traducción por turno y estima el nivel (queda «estimado»)
  async create(input: DialogueInput): Promise<Dialogue | null> {
    return this.act(this.repo.createDialogue(input));
  }

  // [draftFromUrl · 2026-10-19]: página → texto (Next.js, anti-SSRF) → guion (NestJS: «Nombre: frase» sin IA; si no, el LLM lo extrae)
  async draftFromUrl(url: string, req: Omit<DraftRequest, 'mode' | 'text'>): Promise<DialogueDraft | null> {
    const page = await this.act(this.repo.readUrl(url));
    if (!page) return null;
    const draft = await this.act(this.repo.draftDialogue({ ...req, mode: 'text', text: page.text, title: req.title || page.title }));
    return draft ? { ...draft, holder: page.holder } : null;
  }

  // [draftWithAi · 2026-10-19]: diálogo original del tema generado por el LLM local (borrador: el docente lo revisa antes de guardar)
  draftWithAi(req: Omit<DraftRequest, 'mode' | 'text'>): Promise<DialogueDraft | null> {
    return this.act(this.repo.draftDialogue({ ...req, mode: 'ai' }));
  }

  async uploadAudio(id: string, file: Blob): Promise<boolean | null> {
    const r = await this.act(this.repo.uploadAudio(id, file));
    if (r) await this.loadDialogue(id);
    return r ? r.aligned : null;
  }

  async confirmLevel(id: string, level: string): Promise<boolean> {
    const r = await this.act(this.repo.confirmLevel(id, level));
    if (r) {
      const d = this.dialogue.data();
      if (d?.id === id) this.dialogue.set({ ...d, level: r.level, levelStatus: r.levelStatus });
      this.pending.set((this.pending.data() ?? []).filter((x) => x.id !== id));
    }
    return !!r;
  }

  async withdraw(id: string): Promise<boolean> {
    return (await this.act(this.repo.withdraw(id))) !== null;
  }

  audioUrl(id: string): string {
    return this.repo.audioUrl(id);
  }

  // [transcribe · 2026-10-25]: servidor sin voz a texto → `null` SIN `actionError` (no es un fallo del alumno) y `serverSpeechDown` = true
  // `catchError` (RxJS): convierte solo ese caso en `of(null)`; el resto de errores sigue por `act` | [Principio]: DRY (reutiliza act)
  transcribe(audio: Blob, language: string): Promise<string | null> {
    this.serverSpeechDown.set(false);
    return this.act(
      this.repo.transcribe(audio, language).pipe(
        catchError((err: unknown) => {
          if (!isServerSpeechDown(err)) return throwError(() => err);
          this.serverSpeechDown.set(true);
          return of(null);
        }),
      ),
    );
  }
}
