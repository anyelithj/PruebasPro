// [STRATEGY][SRP] envío de emails — STUB (vertical slice): loguea en vez de enviar.
import { Injectable, Logger } from '@nestjs/common';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  // TODO(vertical-slice): integrar proveedor real (SES/Resend/SMTP).
  async send(payload: EmailPayload): Promise<void> {
    this.logger.log(`[stub] email -> ${payload.to}: ${payload.subject}`);
  }
}
