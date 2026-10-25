import { computed, DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { NotificationsRepository } from '../domain/notifications.repository.port';
import { markAll, markOne, receive, type Inbox } from '../domain/models/notifications';
// [NotificationsFacade · Aplicación]: casos de uso «listar», «marcar leída(s)» y «recibir en vivo» + contador | [Patrón]: Facade + State Machine + Observer | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals + RxJS solo en el flujo SSE)
// [UX]: marcar leída es optimista (la UI cambia al instante) y se revierte si el servidor falla

@Injectable()
export class NotificationsFacade {
  private readonly repo = inject(NotificationsRepository);
  readonly inbox = new AsyncState<Inbox>((i) => i.items.length === 0);
  readonly unread = computed(() => this.inbox.data()?.unread ?? 0);

  load(): Promise<Inbox | null> {
    return this.inbox.run(this.repo.inbox());
  }

  // [connect]: SSE ligado al ciclo de vida de quien lo pide (página o campana) → se cierra al destruirse | `takeUntilDestroyed` (Angular)
  connect(destroyRef: DestroyRef): void {
    this.repo
      .live()
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe({
        next: (n) => this.inbox.set(receive(this.current(), n)),
        error: () => undefined, // EventSource ya reintenta; un evento inválido no debe romper la UI
      });
  }

  markRead(id: string): Promise<void> {
    return this.optimistic(markOne(this.current(), id), () => this.repo.markRead(id));
  }

  markAllRead(): Promise<void> {
    return this.optimistic(markAll(this.current()), () => this.repo.markAllRead());
  }

  private current(): Inbox {
    return this.inbox.data() ?? { items: [], unread: 0 };
  }

  // [optimistic]: aplica el cambio local y lo confirma; si falla, restaura y muestra el error | [Patrón]: Optimistic Update + Memento
  private async optimistic(next: Inbox, call: () => ReturnType<NotificationsRepository['markRead']>): Promise<void> {
    const before = this.current();
    this.inbox.set(next);
    try {
      await firstValueFrom(call());
    } catch (err) {
      this.inbox.set(before);
      this.inbox.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
