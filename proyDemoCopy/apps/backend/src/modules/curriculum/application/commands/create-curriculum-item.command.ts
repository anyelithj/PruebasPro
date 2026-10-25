import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  languageMismatch,
  validateCurriculumContent,
} from '../../domain/content/curriculum-content.schema';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import { RevisionChangeType } from '../../domain/entities/curriculum-item-revision.entity';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { Provenance } from '../../domain/value-objects/provenance.vo';
import { initialStatus } from '../../domain/value-objects/review-status.vo';
import {
  canApproveCurriculum,
  type CurriculumActor,
} from '../curriculum-actor';
import { resolveCatalogRefs } from '../resolve-catalog-refs';
import type { CreateCurriculumItemDto } from '../dtos/curriculum-item.dto';
// [Command CreateCurriculumItem]: alta de un recurso pedagógico introducido manualmente | [Patrón]: Command Handler (CQRS, sin bus) + Use Case | [Principio]: SRP + DIP | [Paradigma]: POO + async/await
// [Tecnología]: NestJS (@Injectable = proveedor del contenedor DI)

// `@Injectable()` (NestJS): registra la clase para inyección de dependencias
@Injectable()
export class CreateCurriculumItemCommand {
  // `constructor(... private readonly ...)` (TS): declara e inicializa la propiedad en una línea
  // `@Inject(TOKEN)` (NestJS): inyecta la implementación registrada para el puerto → DIP (depende de la abstracción)
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  // `async` (ES2017): devuelve Promise; `await` suspende sin bloquear el event loop de Node.js
  async execute(
    dto: CreateCurriculumItemDto,
    actor: CurriculumActor,
  ): Promise<CurriculumItem> {
    const provenance = dto.provenance ?? Provenance.MANUAL; // `??`: MANUAL por defecto

    // [Regla]: solo ADMIN puede declarar contenido "validado por especialista"
    if (
      provenance === Provenance.EXPERT_VALIDATED &&
      !canApproveCurriculum(actor)
    ) {
      throw new ForbiddenException(
        'Solo un administrador puede marcar contenido como validado por especialista',
      );
    }
    // [Regla]: contenido importado exige fuente (del catálogo o, por compatibilidad, en texto)
    if (
      provenance === Provenance.IMPORTED &&
      !dto.sourceId &&
      !dto.source?.trim()
    ) {
      throw new BadRequestException(
        'El contenido importado requiere seleccionar una fuente',
      );
    }

    // [Catálogo]: tema → topic/key (slug) y fuente → source; determinista, sin LLM
    const refs = await resolveCatalogRefs(
      this.repo,
      { ...dto, provenance },
      { sourceTextProvided: Boolean(dto.source?.trim()) },
    );
    const key = refs.key ?? dto.key;
    const topic = refs.topic ?? dto.topic.trim();

    // [Validación del dominio]: estructura del JSONB según el tipo (Zod) → resultado discriminado, sin excepciones
    const validation = validateCurriculumContent(dto.kind, dto.content);
    if (!validation.ok) {
      // [message como array]: el HttpExceptionFilter global conserva `message`; así la UI muestra cada error de campo
      throw new BadRequestException(
        validation.errors.map((e) => `content.${e}`),
      );
    }
    // [Coherencia de idioma]: el contenido debe ser del idioma declarado (regla de dominio) | [Fix]: se colaban recursos "Francés" con IPA inglesa
    const mismatch = languageMismatch(dto.language, validation.content);
    if (mismatch)
      throw new BadRequestException([`content.ipa.variant: ${mismatch}`]);

    // [Idempotencia / no duplicados]: la clave natural (idioma + tipo + key) debe ser única
    const existing = await this.repo.findByNaturalKey(
      dto.language,
      dto.kind,
      key,
    );
    if (existing) {
      throw new ConflictException(
        `La clave "${key}" ya está en uso por otro recurso del mismo tipo e idioma (tema "${existing.topic}"). Elige otro tema o edita el recurso existente.`,
      );
    }

    // [Persistencia + auditoría en una transacción]: el adapter crea el ítem y su revisión CREATED
    return this.repo.createWithRevision(
      {
        key,
        kind: dto.kind,
        language: dto.language,
        level: dto.level,
        skill: dto.skill,
        topic,
        topicId: refs.topicId ?? null,
        content: validation.content, // Versión normalizada por Zod (trim, defaults)
        provenance,
        // [Estado inicial]: desde un borrador de IA → GENERATED; manual/importado → DRAFT | nunca visible sin revisión
        reviewStatus: initialStatus(
          Boolean(dto.generationId) || provenance === Provenance.GENERATED,
        ),
        source: refs.source ?? (dto.source?.trim() || null), // Nombre de la fuente del catálogo o texto previo
        sourceId: refs.sourceId ?? null,
        generationId: dto.generationId ?? null, // [Trazabilidad IA]: enlace a la generación (null = manual)
        reviewNote: null,
        createdBy: actor.id,
        updatedBy: actor.id,
        reviewedBy: null,
        reviewedAt: null,
      },
      { changeType: RevisionChangeType.CREATED, changedBy: actor.id },
    );
  }
}
