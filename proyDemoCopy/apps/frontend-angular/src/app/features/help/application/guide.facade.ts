import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Subscription } from 'rxjs';
import { I18nService } from '@core/i18n/i18n.service';
import { HelpRepository } from '../domain/help.repository.port';
import type { BotMode, GuideTurn } from '../domain/models/help';
// [GuideFacade · Aplicación]: casos de uso «preguntar al Agente Guía (SSE)», «valorar respuesta» y «borrar conversación» + estado con signals | [Patrón]: Facade + Observer + State (idle/streaming/error) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals; RxJS solo en el flujo)
// [Contexto]: envía la ruta actual (`location.pathname`) y el idioma de la interfaz → «en esta pantalla…» · el rol lo pone el JWT en el servidor

@Injectable()
export class GuideFacade {
  private readonly repo = inject(HelpRepository);
  private readonly i18n = inject(I18nService);
  private sub?: Subscription;

  readonly turns = signal<GuideTurn[]>([]);
  readonly sessionId = signal<string | undefined>(undefined);
  readonly streaming = signal(false);
  readonly error = signal<string | null>(null);
  readonly isEmpty = computed(() => this.turns().length === 0);
  readonly mode = signal<BotMode>('guide'); // [2026-10-19]: Tutor · Soporte · Guía (cada modo es una conversación aparte)
  readonly language = signal('en'); // Idioma que estudia (modo tutor)

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe()); // Cerrar el widget/página cancela la respuesta en curso
  }

  ask(message: string, route: string = location.pathname): void {
    const text = message.trim();
    if (text.length < 2 || this.streaming()) return;
    this.error.set(null);
    this.streaming.set(true);
    this.turns.update((t) => [...t, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    this.sub = this.repo.ask({ message: text, sessionId: this.sessionId(), route: /^\/[\w\-/]*$/.test(route) ? route : undefined, locale: this.i18n.locale(), mode: this.mode(), language: this.mode() === 'tutor' ? this.language() : undefined }).subscribe({
      next: (chunk) => {
        switch (chunk.type) {
          case 'session':
            this.sessionId.set(chunk.sessionId);
            break;
          case 'token':
            this.patchLast((last) => ({ content: last.content + chunk.text }));
            break;
          case 'sources':
            this.patchLast(() => ({ sources: chunk.sources, answeredBy: chunk.answeredBy }));
            break;
          case 'done':
            this.streaming.set(false);
            break;
        }
      },
      error: (err: unknown) => {
        this.turns.update((t) => (t.at(-1)?.content === '' ? t.slice(0, -1) : t)); // Quita el turno vacío del agente
        this.error.set(err instanceof Error ? err.message : String(err));
        this.streaming.set(false);
      },
      complete: () => this.streaming.set(false),
    });
  }

  // [rate]: `index` = posición del turno del agente (la misma que guarda FastAPI) → NestJS lee la pregunta real de la conversación
  async rate(index: number, helpful: boolean): Promise<void> {
    const turn = this.turns()[index];
    const session = this.sessionId();
    if (!turn || turn.role !== 'assistant' || !session) return;
    try {
      await firstValueFrom(this.repo.rate(session, index, helpful, turn.answeredBy ?? 'llm', location.pathname));
      this.turns.update((t) => t.map((x, i) => (i === index ? { ...x, rating: helpful } : x)));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  // [setMode]: cambiar de modo empieza otra conversación (el contexto de soporte no se mezcla con el del tutor)
  setMode(mode: BotMode): void {
    if (mode === this.mode()) return;
    void this.clear();
    this.mode.set(mode);
  }

  // [clear]: borra la conversación en el servidor (si existe) y empieza de cero
  async clear(): Promise<void> {
    this.sub?.unsubscribe();
    const session = this.sessionId();
    this.turns.set([]);
    this.sessionId.set(undefined);
    this.streaming.set(false);
    this.error.set(null);
    if (session) await firstValueFrom(this.repo.deleteConversation(session)).catch(() => undefined); // Caducada en el servidor = ya borrada
  }

  private patchLast(patch: (last: GuideTurn) => Partial<GuideTurn>): void {
    this.turns.update((t) => {
      const last = t.at(-1);
      return last?.role === 'assistant' ? [...t.slice(0, -1), { ...last, ...patch(last) }] : t;
    });
  }
}
