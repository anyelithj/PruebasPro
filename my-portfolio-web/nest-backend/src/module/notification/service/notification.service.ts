// [STRATEGY][SRP] orquesta el envío por canal y persiste el registro. No toca HTTP.
import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException } from 'src/common/exceptions/not-found.exception';
import { Paginated } from 'src/common/interfaces/paginated.interface';
import { offsetOf, paginate } from 'src/common/utils/pagination.util';
import { EmailService } from 'src/infrastructure/email/email.service';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { NotificationModel } from '../model/notification.model';
import { NotificationRepository } from '../repository/notification.repository';
import { MessagingChannel } from '../strategy/messaging.interface';
import { TelegramStrategy } from '../strategy/telegram.strategy';
import { WhatsappStrategy } from '../strategy/whatsapp.strategy';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly channels: Map<string, MessagingChannel>;

  constructor(
    private readonly repository: NotificationRepository,
    private readonly email: EmailService,
    whatsapp: WhatsappStrategy,
    telegram: TelegramStrategy,
  ) {
    this.channels = new Map<string, MessagingChannel>([
      [whatsapp.channel, whatsapp],
      [telegram.channel, telegram],
    ]);
  }

  async send(dto: SendNotificationDto): Promise<NotificationModel> {
    const created = await this.repository.create({
      channel: dto.channel,
      recipient: dto.recipient,
      message: dto.message,
      status: 'pending',
      eventType: dto.eventType ?? null,
    });
    try {
      await this.dispatch(dto);
      return this.repository.updateStatus(created.id, 'sent');
    } catch (e) {
      this.logger.error(`Notification dispatch failed: ${(e as Error).message}`);
      return this.repository.updateStatus(created.id, 'failed');
    }
  }

  private async dispatch(dto: SendNotificationDto): Promise<void> {
    if (dto.channel === 'email') {
      await this.email.send({ to: dto.recipient, subject: 'Notificación', body: dto.message });
      return;
    }
    const channel = this.channels.get(dto.channel);
    if (!channel) throw new Error(`Canal no soportado: ${dto.channel}`);
    await channel.send(dto.recipient, dto.message);
  }

  async list(page: number, pageSize: number): Promise<Paginated<NotificationModel>> {
    const [items, total] = await this.repository.findPage(offsetOf(page, pageSize), pageSize);
    return paginate(items, page, pageSize, total);
  }

  async getById(id: string): Promise<NotificationModel> {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException('Notification not found');
    return item;
  }
}
