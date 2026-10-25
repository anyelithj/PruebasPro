import {
  Controller,
  Headers,
  Inject,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import {
  NOTIFICATION_CHANNEL,
  type NotificationChannel,
} from '../domain/interfaces/notification.interface';
// [SseController · Sprint 6.2]: GET /events — flujo SSE con TODOS los eventos del usuario (avisos + efímeros como `report-export`) | [Patrón]: Thin Controller + Observer | [Principio]: SRP + DIP | [Paradigma]: Reactivo
// [Diferencia]: /notifications/stream solo entrega avisos (campana); /events lo usan pantallas que siguen procesos en vivo (exportaciones)
// [Seguridad]: JwtAuthGuard global; el canal sale del JWT (nunca de la URL)

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('events')
export class SseController {
  constructor(
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  // `@Sse` (NestJS): text/event-stream; `last-event-id` reenvía avisos perdidos al reconectar
  @Sse()
  @ApiOperation({ summary: 'Todos mis eventos en tiempo real (SSE)' })
  events(
    @CurrentUser() user: JwtPayload,
    @Headers('last-event-id') lastEventId?: string,
  ): Observable<MessageEvent> {
    return this.channel.events(user.sub, lastEventId);
  }
}
