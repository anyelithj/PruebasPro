import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { AssistantRepository } from '../domain/assistant.repository.port';
import type { ChatTurn, TutorLanguage, TutorLevel } from '../domain/models/assistant';
// [AssistantFacade · Aplicación]: casos de uso «enviar mensaje», «recibir tokens por SSE» y «nueva conversación» + estado con signals | [Patrón]: Facade + Observer + State (idle/streaming/error) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals; RxJS solo en el flujo)
// [UX]: el turno del tutor aparece vacío y crece token a token (respuesta en streaming)

@Injectable()
export class AssistantFacade {
  private readonly repo = inject(AssistantRepository);
  private sub?: Subscription;

  readonly turns = signal<ChatTurn[]>([]);
  readonly sessionId = signal<string | undefined>(undefined); // Memoria de la conversación en FastAPI
  readonly language = signal<TutorLanguage>('en');
  readonly level = signal<TutorLevel>('A2'); // [Sprint 7.8]: nivel MCER del alumno → color de la pantalla + dificultad de la respuesta
  readonly streaming = signal(false);
  readonly error = signal<string | null>(null);
  readonly isEmpty = computed(() => this.turns().length === 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.sub?.unsubscribe()); // Al salir de la ruta se cancela la respuesta en curso
  }

  send(message: string): void {
    const text = message.trim();
    if (!text || this.streaming()) return;
    this.error.set(null);
    this.streaming.set(true);
    // `update` (signals): inmutable → turno del usuario + turno vacío del tutor que se irá llenando
    this.turns.update((t) => [
      ...t,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);

    this.sub = this.repo
      .stream({
        message: text,
        sessionId: this.sessionId(),
        language: this.language(),
        level: this.level(),
      })
      .subscribe({
        next: (chunk) => {
          switch (chunk.type) {
            case 'session':
              this.sessionId.set(chunk.sessionId);
              break;
            case 'token':
              this.appendToLast(chunk.text);
              break;
            case 'done':
              this.streaming.set(false);
              break;
          }
        },
        error: (err: unknown) => {
          this.turns.update((t) => (t.at(-1)?.content === '' ? t.slice(0, -1) : t)); // Quita el turno vacío del tutor
          this.error.set(err instanceof Error ? err.message : String(err));
          this.streaming.set(false);
        },
        complete: () => this.streaming.set(false),
      });
  }

  reset(): void {
    this.sub?.unsubscribe();
    this.turns.set([]);
    this.sessionId.set(undefined);
    this.streaming.set(false);
    this.error.set(null);
  }

  private appendToLast(text: string): void {
    this.turns.update((t) => {
      const last = t.at(-1);
      return last?.role === 'assistant'
        ? [...t.slice(0, -1), { ...last, content: last.content + text }]
        : t;
    });
  }
}
