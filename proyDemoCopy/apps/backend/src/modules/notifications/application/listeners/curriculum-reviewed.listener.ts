import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CURRICULUM_REVIEWED_EVENT,
  CurriculumReviewedEvent,
} from '../../../curriculum/domain/events/curriculum-reviewed.event';
import { PublishNotificationUseCase } from '../use-cases/publish-notification.use-case';
// [Listener CurriculumReviewed]: avisa al autor cuando su recurso se publica o se devuelve | [Patrón]: Observer (Async Subscriber) | [Principio]: SRP + OCP + DRY (Sprint 6.2: crea el aviso con PublishNotificationUseCase → también llega en tiempo real) | [Paradigma]: Event-Driven

@Injectable()
export class CurriculumReviewedListener {
  private readonly logger = new Logger(CurriculumReviewedListener.name);

  constructor(private readonly publish: PublishNotificationUseCase) {}

  // `@OnEvent(..., { async: true })` (NestJS): no bloquea al productor; los errores se registran y no rompen la revisión
  @OnEvent(CURRICULUM_REVIEWED_EVENT, { async: true })
  async handle(e: CurriculumReviewedEvent): Promise<void> {
    try {
      await this.publish.execute({
        userId: e.authorId,
        title: e.approved
          ? `Recurso publicado: ${e.topic}`
          : `Recurso devuelto: ${e.topic}`,
        body: e.approved
          ? `Tu recurso ya es visible para los estudiantes.${e.note ? ` Comentario: ${e.note}` : ''}`
          : `Un administrador pidió cambios: ${e.note ?? 'revisa el recurso'}.`,
        href: `/admin/curriculum/${e.itemId}`, // La campana enlaza al recurso
      });
    } catch (err) {
      this.logger.error(
        `No se pudo notificar la revisión de ${e.itemId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
