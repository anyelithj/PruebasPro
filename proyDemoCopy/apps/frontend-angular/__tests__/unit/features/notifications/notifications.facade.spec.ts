import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { NotificationsRepository } from '@features/notifications/domain/notifications.repository.port';
import type { AppNotification, Inbox } from '@features/notifications/domain/models/notifications';
import { NotificationsFacade } from '@features/notifications/application/notifications.facade';
// [Spec NotificationsFacade]: casos de uso y transiciones de estado con signals (carga, vacío, en vivo sin duplicados, marcar leída optimista con reversión) | [Patrón]: Test Double (repositorio falso, sin HTTP)

const n = (id: string, isRead = false): AppNotification => ({ id, title: id, body: '', isRead, createdAt: '2026-10-15T00:00:00Z', payload: null });

function setup(inbox: Inbox, markRead = () => of({})) {
  const live = new Subject<AppNotification>();
  const repo: NotificationsRepository = { inbox: () => of(inbox), markRead, markAllRead: () => of({}), live: () => live };
  TestBed.configureTestingModule({ providers: [NotificationsFacade, { provide: NotificationsRepository, useValue: repo }] });
  return { facade: TestBed.inject(NotificationsFacade), live };
}

describe('NotificationsFacade', () => {
  it('carga la bandeja; sin elementos el estado es «empty»', async () => {
    const { facade } = setup({ items: [], unread: 0 });
    await facade.load();
    expect(facade.inbox.status()).toBe('empty');
  });

  it('un aviso en vivo entra arriba y suma al contador; el duplicado se ignora', async () => {
    const { facade, live } = setup({ items: [n('a')], unread: 1 });
    await facade.load();
    facade.connect(TestBed.inject(DestroyRef));
    live.next(n('b'));
    live.next(n('b'));
    expect(facade.inbox.data()?.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(facade.unread()).toBe(2);
  });

  it('marcar leída es optimista y se revierte si el servidor falla', async () => {
    const { facade } = setup({ items: [n('a')], unread: 1 }, () => throwError(() => new Error('boom')));
    await facade.load();
    await facade.markRead('a');
    expect(facade.unread()).toBe(1);
    expect(facade.inbox.error()).toBe('boom');
  });
});
