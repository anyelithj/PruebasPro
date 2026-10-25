import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_CHANNEL,
  type ChannelEvent,
  type NotificationChannel,
} from '../../domain/interfaces/notification.interface';
// [Caso de uso BroadcastEvent · Sprint 6.2]: emitir un evento efímero (sin guardarlo) al canal de un usuario — p. ej. el progreso de una exportación | [Patrón]: Command + Observer | [Principio]: SRP (persistir avisos es de PublishNotification) + DIP (depende del puerto, no de RxJS) | [Paradigma]: Event-Driven

// `export interface` (TS): entrada mínima; `type` = nombre del evento que escucha el cliente
export interface BroadcastEventInput<T = unknown> extends ChannelEvent<T> {
  userId: string;
}

@Injectable()
export class BroadcastEventUseCase {
  constructor(
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  // Síncrono: solo `next()` en memoria; si el usuario no está conectado, el evento se pierde (por diseño: es efímero)
  execute<T>({ userId, type, data }: BroadcastEventInput<T>): void {
    this.channel.broadcast(userId, { type, data });
  }
}
