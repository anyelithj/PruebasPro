// [STRATEGY][OCP] canal WhatsApp — Business Cloud API. Degrada a log si faltan credenciales.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingChannel } from './messaging.interface';

@Injectable()
export class WhatsappStrategy implements MessagingChannel {
  readonly channel = 'whatsapp';
  private readonly logger = new Logger(WhatsappStrategy.name);

  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<string> {
    const token = this.config.get<string>('WHATSAPP_TOKEN');
    const phoneId = this.config.get<string>('WHATSAPP_PHONE_ID');
    if (!token || !phoneId) {
      this.logger.log(`[stub] whatsapp -> ${to}: ${message.slice(0, 80)}`);
      return '';
    }
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    });
    const json = (await res.json()) as { messages?: Array<{ id?: string }> };
    return String(json.messages?.[0]?.id ?? '');
  }
}
