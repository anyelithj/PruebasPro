import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import type {
  IMailService,
  MailMessage,
} from '../../../auth/domain/interfaces/mail.service.interface';
import { EmailOutbox } from '../../domain/entities/email-outbox.entity';
// [UseCase EnqueueEmail · Sprint 7.15 · RF-63]: guarda el correo en la bandeja de salida y encola su envío (Bull) | [Patrón]: Transactional Outbox + Producer + Adapter (implementa el MISMO puerto IMailService) | [Principio]: OCP + DIP (Auth sigue llamando `mail.send()`; solo cambió el proveedor del token) + LSP | [Paradigma]: POO + async/await
// [Por qué un puerto compartido]: los casos de uso de Auth no saben si el correo sale ya (SMTP) o con cola y reintentos (outbox)

export const EMAIL_QUEUE = 'email';
export interface EmailJob {
  id: string; // Fila de email_outbox
}
// [Reintentos]: 5 intentos con espera exponencial (10 s, 20 s, 40 s…) → cubre un SMTP caído unos minutos
export const EMAIL_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: true,
} as const;

@Injectable()
export class EnqueueEmailUseCase implements IMailService {
  constructor(
    @InjectRepository(EmailOutbox)
    private readonly outbox: Repository<EmailOutbox>,
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJob>,
  ) {}

  async execute(message: MailMessage): Promise<EmailOutbox> {
    const row = await this.outbox.save(
      this.outbox.create({
        ...message,
        status: 'pending',
        attempts: 0,
        lastError: null,
        sentAt: null,
      }),
    );
    // `jobId` = id de la fila → encolar dos veces el mismo correo no lo envía dos veces
    await this.queue.add(
      { id: row.id },
      { ...EMAIL_JOB_OPTIONS, jobId: row.id },
    );
    return row;
  }

  // [send · IMailService]: lo que llaman los casos de uso de Auth (restablecer contraseña, verificar correo)
  async send(message: MailMessage): Promise<void> {
    await this.execute(message);
  }
}
