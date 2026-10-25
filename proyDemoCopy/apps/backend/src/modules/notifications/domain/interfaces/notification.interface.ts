import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Notification } from '../entities/notification.entity';
// [Puerto NotificationChannel · Sprint 6.2]: emitir a un usuario y suscribirse a su canal (SSE y WebSocket comparten este puerto) | [Patrón]: Port (Hexagonal) + Observer | [Principio]: DIP (hoy RxJS en memoria; mañana Redis Pub/Sub sin tocar casos de uso) + ISP

export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL'); // `Symbol` (ES2015): token único de inyección

// [Evento de dominio]: lo emite PublishNotificationUseCase tras persistir; lo escucha NotificationCreatedListener
export const NOTIFICATION_CREATED_EVENT = 'notification.created';

// [Evento efímero]: no se guarda en BD (p. ej. progreso de una exportación) | `type` = nombre del evento SSE / Socket.IO
export interface ChannelEvent<T = unknown> {
  type: string;
  data: T;
}

export interface NotificationChannel {
  // [publish]: aviso persistido → entrega inmediata a las conexiones abiertas del usuario (si no hay ninguna, queda en BD para la campana)
  publish(notification: Notification): void;
  // [broadcast]: evento efímero a un usuario (sin persistencia ni reenvío)
  broadcast(userId: string, event: ChannelEvent): void;
  // [stream]: solo avisos (`notification`) + reenvío por Last-Event-ID → campana
  stream(userId: string, lastEventId?: string): Observable<MessageEvent>;
  // [events]: todo lo del usuario (avisos + efímeros) → GET /events y gateway WebSocket
  events(userId: string, lastEventId?: string): Observable<MessageEvent>;
}
