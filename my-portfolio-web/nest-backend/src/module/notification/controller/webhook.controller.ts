// [MVC-C][SRP] POST /webhook/:provider — valida HMAC y responde 200 inmediato.
import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { ForbiddenException } from 'src/common/exceptions/forbidden.exception';
import { Public } from 'src/common/decorators/public.decorator';
import { NOTIFICATION_ROUTES } from '../route/notification.routes';

@Controller(NOTIFICATION_ROUTES.ROOT)
export class WebhookController {
  constructor(private readonly config: ConfigService) {}

  // Endpoint público con validación HMAC — n8n / WhatsApp / Telegram.
  @Post(NOTIFICATION_ROUTES.WEBHOOK)
  @Public()
  @HttpCode(HttpStatus.OK)
  handle(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-hub-signature-256') hubSignature?: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    this.verify(raw, xSignature ?? hubSignature);
    // 200 OK inmediato; el trabajo pesado se difiere a la cola (BullMQ).
    return { success: true, data: { provider, accepted: true } };
  }

  private verify(raw: Buffer, signature?: string): void {
    if (!signature) throw new ForbiddenException('Missing webhook signature');
    const secret = this.config.get<string>('WEBHOOK_HMAC_SECRET') ?? 'change-me';
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const provided = signature.split('=').pop() ?? '';
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
  }
}
