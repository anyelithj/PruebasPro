import type { Provider } from '@angular/core';
import { NotificationsFacade } from './application/notifications.facade';
import { NotificationsRepository } from './domain/notifications.repository.port';
import { NotificationsHttpRepository } from './infrastructure/notifications.http-repository';
// [NOTIFICATIONS_PROVIDERS]: puerto → adaptador + fachada, compartidos por la ruta /notificaciones y la campana <aula-campana> | [Patrón]: Composition Root | [Principio]: DRY (un solo cableado) + DIP

export const NOTIFICATIONS_PROVIDERS: Provider[] = [
  { provide: NotificationsRepository, useClass: NotificationsHttpRepository },
  NotificationsFacade,
];
