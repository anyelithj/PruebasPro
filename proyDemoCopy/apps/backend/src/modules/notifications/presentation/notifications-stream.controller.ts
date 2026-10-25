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
// [Controller NotificationsStream · Sprint 6.2]: GET /notifications/stream — Server-Sent Events autenticado | [Patrón]: Thin Controller + Observer | [Principio]: SRP + DIP | [Paradigma]: Reactivo
// [Seguridad]: JwtAuthGuard global; el canal sale del JWT (nunca de la URL) · los interceptores globales lo dejan pasar sin envoltorio ni timeout (isSse)

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsStreamController {
  constructor(
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {}

  // `@Sse` (NestJS): responde text/event-stream y serializa cada MessageEvent | `last-event-id`: cabecera estándar que el navegador envía al reconectar
  @Sse('stream')
  @ApiOperation({ summary: 'Mis notificaciones en tiempo real (SSE)' })
  stream(
    @CurrentUser() user: JwtPayload,
    @Headers('last-event-id') lastEventId?: string,
  ): Observable<MessageEvent> {
    return this.channel.stream(user.sub, lastEventId);
  }
}
