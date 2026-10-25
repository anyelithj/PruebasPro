// [FACADE] notification bounded context — envío multicanal + webhooks (HMAC).
import { Module } from '@nestjs/common';
import { EmailModule } from 'src/infrastructure/email/email.module';
import { NotificationController } from './controller/notification.controller';
import { WebhookController } from './controller/webhook.controller';
import { NotificationRepository } from './repository/notification.repository';
import { NotificationService } from './service/notification.service';
import { TelegramStrategy } from './strategy/telegram.strategy';
import { WhatsappStrategy } from './strategy/whatsapp.strategy';

@Module({
  imports: [EmailModule],
  controllers: [NotificationController, WebhookController],
  providers: [NotificationService, NotificationRepository, WhatsappStrategy, TelegramStrategy],
  exports: [NotificationService],
})
export class NotificationModule {}
