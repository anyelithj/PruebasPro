import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  languageMismatch,
  validateCurriculumContent,
} from '../../domain/content/curriculum-content.schema';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import { RevisionChangeType } from '../../domain/entities/curriculum-item-revision.entity';
import {
  CURRICULUM_REPOSITORY,
  CurriculumVersionConflictError,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { Provenance } from '../../domain/value-objects/provenance.vo';
import { ReviewStatus } from '../../domain/value-objects/review-status.vo';
import {
  canApproveCurriculum,
  type CurriculumActor,
} from '../curriculum-actor';
import { resolveCatalogRefs } from '../resolve-catalog-refs';
import type { UpdateCurriculumItemDto } from '../dtos/curriculum-item.dto';
// [Command UpdateCurriculumItem]: edición versionada con concurrencia optimista y revisión de auditoría | [Patrón]: Command Handler (CQRS) + Optimistic Locking | [Principio]: SRP + DIP | [Paradigma]: POO + async/await

@Injectable()
export class UpdateCurriculumItemCommand {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  async execute(
    id: string,
    dto: UpdateCurriculumItemDto,
    actor: CurriculumActor,
  ): Promise<CurriculumItem> {
    const item = await this.repo.findById(id); // Estado actual
    if (!item) throw new NotFoundException(`Recurso ${id} no encontrado`);

    // [Chequeo temprano de versión]: el adapter lo repite dentro de la transacción (condición de carrera)
    if (item.version !== dto.expectedVersion) {
      throw new ConflictException(
        new CurriculumVersionConflictError(id, dto.expectedVersion).message,
      );
    }

    // [Reglas de procedencia]: mismas que en el alta
    if (
      dto.provenance === Provenance.EXPERT_VALIDATED &&
      !canApproveCurriculum(actor)
    ) {
      throw new ForbiddenException(
        'Solo un administrador puede marcar contenido como validado por especialista',
      );
    }

    // `const { a, ...rest } = obj` (ES2018): separa expectedVersion del resto de cambios
    const { expectedVersion, ...changes } = dto;

    // [Catálogo]: si cambia el tema, la fuente o la procedencia, se derivan topic/key/source de forma determinista
    if (changes.topicId || changes.sourceId || changes.provenance) {
      const refs = await resolveCatalogRefs(
        this.repo,
        {
          topicId: changes.topicId,
          sourceId: changes.sourceId,
          provenance: changes.provenance ?? item.provenance,
          language: changes.language ?? item.language,
          level: changes.level ?? item.level,
          skill: changes.skill ?? item.skill,
          kind: changes.kind ?? item.kind,
        },
        {
          sourceTextProvided:
            Boolean(changes.source?.trim()) ||
            (!changes.provenance && !changes.sourceId),
        },
      );
      Object.assign(changes, refs);
    }

    // [Clave natural]: si cambia idioma/tipo/key, debe seguir siendo única
    const nextLanguage = changes.language ?? item.language;
    const nextKind = changes.kind ?? item.kind;
    const nextKey = changes.key ?? item.key;
    if (
      nextLanguage !== item.language ||
      nextKind !== item.kind ||
      nextKey !== item.key
    ) {
      const clash = await this.repo.findByNaturalKey(
        nextLanguage,
        nextKind,
        nextKey,
      );
      if (clash && clash.id !== id) {
        throw new ConflictException(
          `La clave "${nextKey}" ya está en uso por otro recurso del mismo tipo e idioma (tema "${clash.topic}").`,
        );
      }
    }

    // [Revalidación del contenido]: si cambia el contenido O el tipo, el JSONB debe cumplir el esquema del tipo final
    // `changes.language`: cambiar el idioma también exige revalidar la coherencia del contenido
    if (
      changes.content !== undefined ||
      changes.kind !== undefined ||
      changes.language !== undefined
    ) {
      const validation = validateCurriculumContent(
        nextKind,
        changes.content ?? item.content,
      );
      if (!validation.ok) {
        // [message como array]: el HttpExceptionFilter global conserva `message`; así la UI muestra cada error de campo
        throw new BadRequestException(
          validation.errors.map((e) => `content.${e}`),
        );
      }
      const mismatch = languageMismatch(nextLanguage, validation.content); // [Coherencia de idioma]: regla de dominio
      if (mismatch)
        throw new BadRequestException([`content.ipa.variant: ${mismatch}`]);
      changes.content = validation.content; // Guarda la versión normalizada
    }

    const wasApproved = item.reviewStatus === ReviewStatus.APPROVED; // Estado previo
    // `Object.assign` (ES2015): aplica los cambios sobre la entidad cargada (mutación local controlada)
    Object.assign(item, changes, { updatedBy: actor.id });
    if (changes.topic) item.topic = changes.topic.trim();

    // [Regla editorial]: editar contenido aprobado lo devuelve a borrador → los estudiantes nunca ven cambios sin revisar
    if (wasApproved) {
      item.reviewStatus = ReviewStatus.DRAFT;
      item.reviewNote = 'Editado tras su aprobación: requiere nueva revisión.';
    }

    try {
      // [Transacción]: guarda (version++) + inserta revisión UPDATED; verifica expectedVersion con bloqueo de fila
      return await this.repo.saveWithRevision(item, expectedVersion, {
        changeType: RevisionChangeType.UPDATED,
        changedBy: actor.id,
        note: wasApproved ? 'Vuelve a borrador por edición' : null,
      });
    } catch (err) {
      // `instanceof` (JS): traduce el error de dominio a HTTP 409 sin filtrar detalles internos
      if (err instanceof CurriculumVersionConflictError)
        throw new ConflictException(err.message);
      throw err; // Otros errores: los gestiona el filtro global
    }
  }
}
