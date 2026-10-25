// [STRATEGY][OCP] canal Telegram — Bot API. Degrada a log si falta el token.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingChannel } from './messaging.interface';

@Injectable()
export class TelegramStrategy implements MessagingChannel {
  readonly channel = 'telegram';
  private readonly logger = new Logger(TelegramStrategy.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<string> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = to || this.config.get<string>('TELEGRAM_CHAT_ID');
    if (!token || !chatId) {
      this.logger.log(`[stub] telegram -> ${chatId}: ${message.slice(0, 80)}`);
      return '';
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const json = (await res.json()) as { result?: { message_id?: number } };
    return String(json.result?.message_id ?? '');
  }
}
