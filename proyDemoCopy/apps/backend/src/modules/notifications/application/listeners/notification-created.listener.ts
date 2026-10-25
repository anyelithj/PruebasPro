import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Notification } from '../../domain/entities/notification.entity';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CREATED_EVENT,
  type NotificationChannel,
} from '../../domain/interfaces/notification.interface';
// [Listener NotificationCreated · Sprint 6.2]: aviso persistido → empujarlo al canal en tiempo real del usuario | [Patrón]: Observer | [Principio]: SRP (persistir y entregar son responsabilidades separadas) + DIP | [Paradigma]: Event-Driven

@Injectable()
export class NotificationCreatedListener {
  constructor(
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  // Síncrono a propósito: `publish` solo hace `next()` en memoria (no bloquea)
  @OnEvent(NOTIFICATION_CREATED_EVENT)
  handle(notification: Notification): void {
    this.channel.publish(notification);
  }
}
