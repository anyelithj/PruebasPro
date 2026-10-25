import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bull';
import { Repository } from 'typeorm';
import { SmtpMailService } from '../../../auth/infrastructure/services/smtp-mail.service';
import {
  EMAIL_QUEUE,
  type EmailJob,
} from '../../application/use-cases/enqueue-email.use-case';
import { EmailOutbox } from '../../domain/entities/email-outbox.entity';
// [Worker Email · Sprint 7.15 · RF-63]: envía por SMTP (nodemailer) los correos de la bandeja de salida | [Patrón]: Consumer (cola Bull) + Idempotent Receiver (un correo «sent» no se reenvía) + Retry con backoff | [Principio]: SRP + DRY (el mismo SmtpMailService de siempre hace el envío real) | [Paradigma]: Asíncrono + Event-Driven

@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @InjectRepository(EmailOutbox)
    private readonly outbox: Repository<EmailOutbox>,
    private readonly smtp: SmtpMailService,
  ) {}

  @Process()
  async send(job: Job<EmailJob>): Promise<void> {
    const row = await this.outbox.findOneBy({ id: job.data.id });
    if (!row || row.status === 'sent') return; // Ya enviado (trabajo repetido) o borrado → nada que hacer
    const attempts = row.attempts + 1;
    try {
      await this.smtp.send({
        to: row.to,
        subject: row.subject,
        text: row.text,
        html: row.html,
      });
      await this.outbox.update(row.id, {
        status: 'sent',
        attempts,
        sentAt: new Date(),
        lastError: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // [Último intento]: queda «failed» (visible al ADMIN, reintentable); antes sigue «pending» y Bull reintenta
      const final = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.outbox.update(row.id, {
        status: final ? 'failed' : 'pending',
        attempts,
        lastError: message.slice(0, 500),
      });
      this.logger.warn(
        `Correo ${row.id} (intento ${attempts}) sin enviar: ${message}`,
      );
      throw err; // Bull programa el siguiente intento
    }
  }
}
