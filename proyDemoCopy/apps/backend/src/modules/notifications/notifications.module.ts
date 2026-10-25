import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import jwtConfig from '../../shared/config/jwt.config';
import { Notification } from './domain/entities/notification.entity';
import { EmailOutbox } from './domain/entities/email-outbox.entity';
import { SmtpMailService } from '../auth/infrastructure/services/smtp-mail.service';
import { UsersModule } from '../users/users.module';
import {
  EMAIL_QUEUE,
  EnqueueEmailUseCase,
} from './application/use-cases/enqueue-email.use-case';
import {
  ListEmailOutboxQuery,
  RetryEmailUseCase,
} from './application/use-cases/retry-email.use-case';
import { EmailProcessor } from './infrastructure/queue/email.processor';
import { EmailOutboxController } from './presentation/email-outbox.controller';
import { NOTIFICATION_CHANNEL } from './domain/interfaces/notification.interface';
import { NotificationsController } from './presentation/notifications.controller';
import { NotificationsStreamController } from './presentation/notifications-stream.controller';
import { SseController } from './presentation/sse.controller';
import { BroadcastEventUseCase } from './application/use-cases/broadcast-event.use-case';
import { NotificationsGateway } from './infrastructure/gateways/notifications.gateway';
import { CurriculumReviewedListener } from './application/listeners/curriculum-reviewed.listener';
import { NotificationCreatedListener } from './application/listeners/notification-created.listener';
import {
  ListMyNotificationsUseCase,
  MarkNotificationsReadUseCase,
} from './application/use-cases/my-notifications.use-case';
import { PublishNotificationUseCase } from './application/use-cases/publish-notification.use-case';
import { NotificationStreamService } from './infrastructure/stream/notification-stream.service';
// [Módulo Notifications]: avisos persistentes + entrega en tiempo real por SSE y WebSocket (Sprint 6.2) + correo con bandeja de salida y cola Bull (Sprint 7.15) | [Patrón]: Module + DI Container + Transactional Outbox | [Principio]: DIP (puerto NotificationChannel → adaptador RxJS; SSE y Socket.IO lo comparten · IMailService → EnqueueEmailUseCase)

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, EmailOutbox]),
    BullModule.registerQueue({ name: EMAIL_QUEUE }), // [Sprint 7.15]: envío de correos en segundo plano con reintentos
    UsersModule, // USER_REPOSITORY: correo del destinatario cuando un aviso pide `email: true`
    JwtModule.register({}), // [Gateway]: verifica el JWT del handshake (secreto por llamada, igual que AuthModule)
    ConfigModule.forFeature(jwtConfig),
  ],
  controllers: [
    NotificationsController,
    NotificationsStreamController,
    SseController,
    EmailOutboxController, // [Sprint 7.15]: bandeja de salida (ADMIN)
  ], // Campana (REST) + SSE de avisos + SSE de todos los eventos
  providers: [
    ListMyNotificationsUseCase,
    MarkNotificationsReadUseCase,
    PublishNotificationUseCase,
    BroadcastEventUseCase,
    NotificationsGateway, // [WebSocket]: namespace /notifications (Socket.IO)
    { provide: NOTIFICATION_CHANNEL, useClass: NotificationStreamService }, // [Wire-up Port → Adapter]
    NotificationCreatedListener,
    CurriculumReviewedListener,
    SmtpMailService, // Envío real (nodemailer) — solo lo usa el worker
    EnqueueEmailUseCase,
    RetryEmailUseCase,
    ListEmailOutboxQuery,
    EmailProcessor,
  ],
  exports: [
    PublishNotificationUseCase,
    BroadcastEventUseCase,
    EnqueueEmailUseCase,
  ], // [DRY]: otros contextos (Reports…) avisan y emiten progreso por los mismos casos de uso · Auth envía correos por la bandeja de salida
})
export class NotificationsModule {}
