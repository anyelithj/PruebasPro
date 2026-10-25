import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../../domain/entities/notification.entity';
import { NOTIFICATION_CREATED_EVENT } from '../../domain/interfaces/notification.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { linkEmail } from '../../../auth/application/mail/link-email';
import { EnqueueEmailUseCase } from './enqueue-email.use-case';
// [Caso de uso PublishNotification · Sprint 6.2]: ÚNICA entrada para crear avisos → persiste (campana, historial) y emite el evento de dominio (tiempo real) | [Patrón]: Command + Domain Event | [Principio]: SRP + DRY (lo usan Curriculum, Reports…) | [Paradigma]: POO + Event-Driven

// `export interface` (TS): datos mínimos de un aviso; `href` = a dónde lleva el clic en la campana
export interface PublishNotificationInput {
  userId: string;
  type?: NotificationType;
  title: string;
  body: string;
  href?: string;
  payload?: Record<string, unknown>;
  email?: boolean; // [Sprint 7.15 · RF-63]: además de la campana, por correo (bandeja de salida con reintentos)
}

@Injectable()
export class PublishNotificationUseCase {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly events: EventEmitter2,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly mail: EnqueueEmailUseCase,
  ) {}

  private readonly logger = new Logger(PublishNotificationUseCase.name);

  async execute(input: PublishNotificationInput): Promise<Notification> {
    const saved = await this.repo.save(
      this.repo.create({
        userId: input.userId,
        type: input.type ?? NotificationType.SYSTEM,
        title: input.title.slice(0, 255), // Columna varchar(255)
        body: input.body,
        payload: {
          ...input.payload,
          ...(input.href ? { href: input.href } : {}),
        },
      }),
    );
    this.events.emit(NOTIFICATION_CREATED_EVENT, saved); // [Observer]: el canal SSE se entera sin acoplar este caso de uso al transporte
    if (input.email) await this.sendEmail(input);
    return saved;
  }

  // [sendEmail]: mismo diseño que los correos de Auth (linkEmail) · fail-soft: el aviso en la campana ya quedó guardado
  private async sendEmail(input: PublishNotificationInput): Promise<void> {
    const user = await this.users.findById(input.userId);
    if (!user) return;
    const base = (process.env.FRONTEND_URL ?? 'http://localhost:9000').replace(
      /\/$/,
      '',
    );
    await this.mail
      .execute(
        linkEmail({
          to: user.email,
          firstName: user.firstName ?? '',
          subject: input.title,
          intro: input.body,
          button: 'Abrir en Aula de Idiomas',
          link: `${base}${input.href ?? '/notificaciones'}`,
          footer:
            'Recibes este correo por la actividad de tu cuenta en Aula de Idiomas.',
        }),
      )
      .catch((err: unknown) =>
        this.logger.warn(
          `Aviso por correo no encolado: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }
}
