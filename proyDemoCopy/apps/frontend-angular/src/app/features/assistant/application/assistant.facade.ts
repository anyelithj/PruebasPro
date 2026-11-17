import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable, type Subscription } from 'rxjs';
import { ToastService } from '@core/feedback/toast.service';
import { I18nService } from '@core/i18n/i18n.service';
import { AssistantRepository } from '../domain/assistant.repository.port';
import {
  TARGET_SHARE_BY_LEVEL,
  toTurn,
  type ChatTurn,
  type ConversationDetail,
  type ConversationSummary,
  type LanguageUsage,
  type TurnSaved,
  type TutorLanguage,
  type TutorLevel,
} from '../domain/models/assistant';
// [AssistantFacade · Aplicación]: casos de uso «enviar mensaje», «recibir tokens por SSE» y «nueva conversación» + [2026-10-28] lista de conversaciones (abrir, renombrar, borrar), editar/borrar mensaje y uso del idioma meta | [Patrón]: Facade + Observer + State (idle/streaming/error) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals; RxJS solo en el flujo)
// [UX]: el turno del tutor aparece vacío y crece token a token (respuesta en streaming) · avisos con ToastService (evento `aula:toast`, el mismo en los dos shells)

@Injectable()
export class AssistantFacade {
  private readonly repo = inject(AssistantRepository);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private sub?: Subscription;

  readonly turns = signal<ChatTurn[]>([]);
  readonly sessionId = signal<string | undefined>(undefined); // = id de la conversación guardada en NestJS
  readonly language = signal<TutorLanguage>('en');
  readonly level = signal<TutorLevel>('A2'); // [Sprint 7.8]: nivel MCER del alumno → color de la pantalla + dificultad de la respuesta
  readonly streaming = signal(false);
  readonly error = signal<string | null>(null);
  readonly isEmpty = computed(() => this.turns().length === 0);

  // [2026-10-28 · Conversaciones]: barra lateral «Mis conversaciones» + operación en curso (deshabilita botones y anuncia aria-busy)
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly loadingList = signal(false);
  readonly busy = signal(false); // Editar/borrar mensaje, abrir conversación
  readonly usage = signal<LanguageUsage | null>(null);
  readonly unsent = signal<string | null>(null); // Mensaje que no se pudo enviar → la página lo devuelve al editor (no se pierde lo escrito)
  // [goal]: meta del servidor si ya midió; si no, la tabla espejo del nivel elegido | `computed` (Signals)
  readonly goal = computed(() => this.usage()?.target ?? TARGET_SHARE_BY_LEVEL[this.level()]);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe()); // Al salir de la ruta se cancela la respuesta en curso
  }

  // ───── Chat ─────

  send(message: string): void {
    const text = message.trim();
    if (!text || this.streaming() || this.busy()) return;
    this.error.set(null);
    this.streaming.set(true);
    // `update` (signals): inmutable → turno del usuario + turno vacío del tutor que se irá llenando
    this.turns.update((t) => [...t, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    this.sub = this.repo
      .stream({ message: text, sessionId: this.sessionId(), language: this.language(), level: this.level() })
      .subscribe({
        next: (chunk) => {
          switch (chunk.type) {
            case 'session':
              this.sessionId.set(chunk.sessionId);
              break;
            case 'token':
              this.appendToLast(chunk.text);
              break;
            case 'saved':
              this.onSaved(chunk.saved);
              break;
            case 'done':
              this.streaming.set(false);
              break;
          }
        },
        error: (err: unknown) => {
          this.turns.update((t) => (t.at(-1)?.content === '' ? t.slice(0, -2) : t)); // Quita el turno vacío del tutor y el del alumno (no se guardó)
          this.unsent.set(text);
          this.error.set(this.messageOf(err));
          this.streaming.set(false);
        },
        complete: () => this.streaming.set(false),
      });
  }

  reset(): void {
    this.sub?.unsubscribe();
    this.turns.set([]);
    this.sessionId.set(undefined);
    this.usage.set(null);
    this.streaming.set(false);
    this.error.set(null);
  }

  // ───── Conversaciones ─────

  async loadConversations(): Promise<void> {
    this.loadingList.set(true);
    try {
      this.conversations.set(await firstValueFrom(this.repo.list()));
    } catch (err) {
      this.error.set(this.messageOf(err));
    } finally {
      this.loadingList.set(false);
    }
  }

  async open(id: string): Promise<void> {
    if (id === this.sessionId() || this.streaming()) return;
    await this.run(this.repo.get(id), (detail) => this.applyDetail(detail));
  }

  async rename(id: string, title: string): Promise<boolean> {
    const clean = title.trim();
    if (!clean) return false;
    return this.run(this.repo.rename(id, clean), (summary) => {
      this.upsert(summary);
      this.toast.success(this.t().renamed);
    });
  }

  async remove(id: string): Promise<boolean> {
    return this.run(this.repo.remove(id), () => {
      this.conversations.update((list) => list.filter((c) => c.id !== id));
      if (this.sessionId() === id) this.reset();
      this.toast.success(this.t().conversationDeleted);
    });
  }

  // ───── Mensajes ─────

  // [editMessage]: el servidor descarta lo posterior y el tutor responde de nuevo → se pinta la conversación que devuelve
  async editMessage(messageId: string, content: string): Promise<boolean> {
    const id = this.sessionId();
    const clean = content.trim();
    if (!id || !clean) return false;
    return this.run(this.repo.editMessage(id, messageId, clean), (detail) => {
      this.applyDetail(detail);
      this.toast.success(this.t().messageEdited);
    });
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const id = this.sessionId();
    if (!id) return false;
    return this.run(this.repo.deleteMessage(id, messageId), (detail) => {
      this.applyDetail(detail);
      this.toast.success(this.t().messageDeleted);
    });
  }

  // ───── privados ─────

  private t() {
    return this.i18n.t().assistant;
  }

  // [run]: ejecuta una operación CRUD con `busy` + error en alerta y toast | [Principio]: DRY (todas comparten el mismo manejo)
  private async run<T>(op: Observable<T>, onOk: (value: T) => void): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set(null);
    try {
      onOk(await firstValueFrom(op));
      return true;
    } catch (err) {
      const msg = this.messageOf(err);
      this.error.set(msg);
      this.toast.error(msg);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  // [onSaved]: ids reales en los dos últimos turnos (habilita editar/borrar) + resumen arriba de la lista + uso del idioma
  private onSaved({ conversation, userMessage, assistantMessage }: TurnSaved): void {
    this.turns.update((t) => {
      const [u, a] = t.slice(-2);
      return u?.role === 'user' && a?.role === 'assistant' ? [...t.slice(0, -2), { ...u, id: userMessage.id }, { ...a, id: assistantMessage.id }] : t;
    });
    this.usage.set(conversation.languageUsage);
    this.upsert(conversation);
  }

  private applyDetail(detail: ConversationDetail): void {
    this.sub?.unsubscribe();
    this.sessionId.set(detail.id);
    this.language.set(detail.language);
    this.level.set(detail.level);
    this.turns.set(detail.messages.map(toTurn));
    this.usage.set(detail.languageUsage);
    this.upsert(detail);
  }

  // [upsert]: la conversación tocada sube al principio de la lista (orden por última actividad)
  private upsert(c: ConversationSummary): void {
    const { id, title, language, level, languageUsage, createdAt, updatedAt } = c; // Sin `messages` si viene el detalle
    this.conversations.update((list) => [{ id, title, language, level, languageUsage, createdAt, updatedAt }, ...list.filter((x) => x.id !== id)]);
  }

  private appendToLast(text: string): void {
    this.turns.update((t) => {
      const last = t.at(-1);
      return last?.role === 'assistant' ? [...t.slice(0, -1), { ...last, content: last.content + text }] : t;
    });
  }

  private messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
