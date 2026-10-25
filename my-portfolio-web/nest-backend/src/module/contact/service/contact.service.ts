// [SRP][OOP] lógica de contacto — persiste el envío y dispara los emails; no toca HTTP.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from 'src/common/exceptions/not-found.exception';
import { Paginated } from 'src/common/interfaces/paginated.interface';
import { offsetOf, paginate } from 'src/common/utils/pagination.util';
import { EmailService } from 'src/infrastructure/email/email.service';
import { CreateContactDto } from '../dto/create-contact.dto';
import { ListContactDto } from '../dto/list-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { ContactResponseDto, toContactResponse } from '../dto/contact-response.dto';
import { ContactSubmissionModel } from '../model/contact-submission.model';
import { ContactRepository } from '../repository/contact.repository';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly repository: ContactRepository,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async submit(dto: CreateContactDto, ipAddress?: string): Promise<ContactResponseDto> {
    // [ML] clasifica el mensaje en FastAPI (job|freelance|spam) para priorizar la bandeja.
    const classification = await this.classify(dto.message);

    const submission = await this.repository.create({
      name: dto.name,
      email: dto.email,
      message: dto.message,
      ipAddress: ipAddress ?? null,
      category: classification?.category ?? null,
      priority: classification?.priority ?? null,
    });

    // Los emails no deben tumbar el POST: si fallan, se registra y el envío sigue guardado.
    void this.notify(submission).catch((e: Error) =>
      this.logger.error(`Contact notification failed: ${e.message}`),
    );

    // [n8n] dispara el evento saliente hacia n8n (automatización externa), best-effort.
    void this.triggerN8n(submission).catch((e: Error) =>
      this.logger.warn(`n8n trigger failed: ${e.message}`),
    );

    return toContactResponse(submission);
  }

  // [n8n][WEBHOOK-OUT] notifica a n8n para disparar flujos (BD → WhatsApp → CRM…).
  // Solo si N8N_WEBHOOK_URL está configurado; nunca bloquea el envío del contacto.
  private async triggerN8n(submission: ContactSubmissionModel): Promise<void> {
    const url = this.config.get<string>('N8N_WEBHOOK_URL');
    if (!url) return;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'contact.created',
        data: {
          id: submission.id,
          name: submission.name,
          email: submission.email,
          message: submission.message,
          category: submission.category,
          priority: submission.priority,
          createdAt: submission.createdAt,
        },
      }),
      signal: AbortSignal.timeout(4000),
    });
  }

  // [ML] llama al microservicio FastAPI; best-effort: si falla, el contacto se guarda sin categoría.
  private async classify(
    message: string,
  ): Promise<{ category: string; priority: string } | null> {
    const base = this.config.get<string>('ML_SERVICE_URL') ?? 'http://localhost:8000/api/v1';
    try {
      const res = await fetch(`${base}/ml/contact/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { category: string; priority: string } };
      return json.data ?? null;
    } catch (e) {
      this.logger.warn(`Contact classification unavailable: ${(e as Error).message}`);
      return null;
    }
  }

  async list(query: ListContactDto): Promise<Paginated<ContactResponseDto>> {
    const { page, pageSize, status } = query;
    const [items, total] = await this.repository.findPage(
      offsetOf(page, pageSize),
      pageSize,
      status ? { status } : {},
    );
    return paginate(items.map(toContactResponse), page, pageSize, total);
  }

  async getById(id: string): Promise<ContactResponseDto> {
    return toContactResponse(await this.require(id));
  }

  async update(id: string, dto: UpdateContactDto): Promise<ContactResponseDto> {
    await this.require(id);
    return toContactResponse(await this.repository.update(id, { status: dto.status }));
  }

  async delete(id: string): Promise<void> {
    await this.require(id);
    await this.repository.delete(id);
  }

  private async require(id: string): Promise<ContactSubmissionModel> {
    const submission = await this.repository.findById(id);
    if (!submission) {
      throw new NotFoundException('Contact submission not found');
    }
    return submission;
  }

  // Acuse al visitante + aviso al dueño del portfolio priorizado por el clasificador ML.
  private async notify(submission: ContactSubmissionModel): Promise<void> {
    await this.email.send({
      to: submission.email,
      subject: 'Gracias por tu mensaje',
      body: `Hola ${submission.name}, recibí tu mensaje y te respondo pronto.`,
    });

    // Spam (prioridad baja) no genera aviso al dueño; lo demás sí, con prioridad en el asunto.
    if (submission.category === 'spam') {
      this.logger.log(`Contacto marcado como spam, sin aviso al dueño: ${submission.email}`);
      return;
    }
    const tag = submission.priority ? `[${submission.priority.toUpperCase()}]` : '';
    const cat = submission.category ? ` (${submission.category})` : '';
    await this.email.send({
      to: this.config.get<string>('CONTACT_NOTIFY_EMAIL') ?? 'owner@portfolio.dev',
      subject: `${tag} Nuevo contacto de ${submission.name}${cat}`.trim(),
      body: `${submission.email}\n\n${submission.message}`,
    });
  }
}
