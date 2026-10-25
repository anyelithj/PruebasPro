import { InjectQueue } from '@nestjs/bull';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import {
  EmailOutbox,
  type EmailStatus,
} from '../../domain/entities/email-outbox.entity';
import {
  EMAIL_JOB_OPTIONS,
  EMAIL_QUEUE,
  type EmailJob,
} from './enqueue-email.use-case';
// [UseCases RetryEmail + ListEmailOutbox · Sprint 7.15]: el ADMIN revisa la bandeja de salida y reintenta un correo fallido | [Patrón]: Command + Query (CQRS ligero) + State (failed → pending) | [Principio]: SRP + mínimo privilegio (rol en el controlador) | [Paradigma]: POO + async/await

@Injectable()
export class RetryEmailUseCase {
  constructor(
    @InjectRepository(EmailOutbox)
    private readonly outbox: Repository<EmailOutbox>,
    @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJob>,
  ) {}

  async execute(id: string): Promise<EmailOutbox> {
    const row = await this.outbox.findOneBy({ id });
    if (!row) throw new NotFoundException('Correo no encontrado');
    if (row.status !== 'failed')
      throw new ConflictException('Solo se reintenta un correo fallido');
    row.status = 'pending';
    row.lastError = null;
    await this.outbox.save(row);
    // `jobId` nuevo por intento manual: Bull no reutiliza el id de un trabajo ya fallido
    await this.queue.add(
      { id },
      { ...EMAIL_JOB_OPTIONS, jobId: `${id}:retry:${Date.now()}` },
    );
    return row;
  }
}

@Injectable()
export class ListEmailOutboxQuery {
  constructor(
    @InjectRepository(EmailOutbox)
    private readonly outbox: Repository<EmailOutbox>,
  ) {}

  // [Sin cuerpo]: la lista no devuelve text/html (pueden llevar enlaces de un solo uso) → solo metadatos para diagnosticar
  execute(status?: EmailStatus): Promise<EmailOutbox[]> {
    return this.outbox.find({
      where: status ? { status } : {},
      select: {
        id: true,
        to: true,
        subject: true,
        status: true,
        attempts: true,
        lastError: true,
        sentAt: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}
