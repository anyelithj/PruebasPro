import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter'; // [Bus de eventos en memoria]: desacopla curriculum de notifications
import {
  CURRICULUM_REVIEWED_EVENT,
  CurriculumReviewedEvent,
} from '../../domain/events/curriculum-reviewed.event';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import { RevisionChangeType } from '../../domain/entities/curriculum-item-revision.entity';
import {
  CURRICULUM_REPOSITORY,
  CurriculumVersionConflictError,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import {
  canTransition,
  isReturn,
  ReviewStatus,
} from '../../domain/value-objects/review-status.vo';
import {
  canApproveCurriculum,
  canManageCurriculum,
  type CurriculumActor,
} from '../curriculum-actor';
import type { ChangeReviewStatusDto } from '../dtos/curriculum-item.dto';
// [Command ChangeReviewStatus]: transición editorial validada por la máquina de estados del dominio | [Patrón]: Command Handler (CQRS) + State Machine | [Principio]: SRP + OCP | [Paradigma]: POO + async/await

// [Destinos que cuentan como decisión de revisión]: firman reviewedBy/reviewedAt | `ReadonlyArray` (TS)
const REVIEW_TARGETS: ReadonlyArray<ReviewStatus> = [
  ReviewStatus.REVIEWED,
  ReviewStatus.APPROVED,
];

@Injectable()
export class ChangeReviewStatusCommand {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
    // `@Optional()` (NestJS): los tests unitarios pueden construir el comando sin bus de eventos
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  async execute(
    id: string,
    dto: ChangeReviewStatusDto,
    actor: CurriculumActor,
  ): Promise<CurriculumItem> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundException(`Recurso ${id} no encontrado`);
    if (item.version !== dto.expectedVersion) {
      throw new ConflictException(
        new CurriculumVersionConflictError(id, dto.expectedVersion).message,
      );
    }

    // [Máquina de estados]: rechaza saltos inválidos (p. ej. draft → approved sin revisión)
    if (!canTransition(item.reviewStatus, dto.status)) {
      throw new BadRequestException(
        `Transición no permitida: ${item.reviewStatus} → ${dto.status}`,
      );
    }
    const returned = isReturn(item.reviewStatus, dto.status); // ¿Devolución al autor? (REVIEW_REQUIRED/REVIEWED → DRAFT)
    // [Autorización]: aprobar o devolver es decisión del ADMIN; marcar «revisado» lo puede hacer un docente
    if (
      (dto.status === ReviewStatus.APPROVED || returned) &&
      !canApproveCurriculum(actor)
    ) {
      throw new ForbiddenException(
        'Solo un administrador puede aprobar o devolver contenido',
      );
    }
    if (dto.status === ReviewStatus.REVIEWED && !canManageCurriculum(actor)) {
      throw new ForbiddenException(
        'Solo docentes y administradores revisan contenido',
      );
    }
    // [Regla]: una devolución debe explicar el motivo (feedback editorial trazable en el historial)
    if (returned && !dto.note?.trim()) {
      throw new BadRequestException('Indica el motivo de la devolución (note)');
    }

    const previous = item.reviewStatus; // Para la nota de auditoría
    item.reviewStatus = dto.status;
    item.reviewNote = dto.note?.trim() || null;
    item.updatedBy = actor.id;
    // [Firma de revisión]: quién y cuándo revisó, aprobó o devolvió
    if (REVIEW_TARGETS.includes(dto.status) || returned) {
      item.reviewedBy = actor.id;
      item.reviewedAt = new Date(); // `new Date()` (JS): instante actual (UTC internamente)
    }

    try {
      const saved = await this.repo.saveWithRevision(
        item,
        dto.expectedVersion,
        {
          changeType: RevisionChangeType.STATUS_CHANGED,
          changedBy: actor.id,
          note: `${previous} → ${dto.status}${item.reviewNote ? `: ${item.reviewNote}` : ''}`,
        },
      );
      // [Evento de dominio]: tras guardar (nunca antes) se avisa de publicación/devolución al autor, si no es el propio revisor | `?.` (ES2020): bus opcional
      if (
        (dto.status === ReviewStatus.APPROVED || returned) &&
        saved.createdBy !== actor.id
      ) {
        this.events?.emit(
          CURRICULUM_REVIEWED_EVENT,
          new CurriculumReviewedEvent(
            saved.id,
            saved.createdBy,
            saved.topic,
            dto.status === ReviewStatus.APPROVED,
            saved.reviewNote,
          ),
        );
      }
      return saved;
    } catch (err) {
      if (err instanceof CurriculumVersionConflictError)
        throw new ConflictException(err.message);
      throw err;
    }
  }
}
