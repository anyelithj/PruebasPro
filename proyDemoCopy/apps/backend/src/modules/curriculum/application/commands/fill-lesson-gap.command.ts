import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  COURSE_OUTLINE_REPOSITORY,
  type ICourseOutlineRepository,
} from '../../domain/interfaces/course-outline.repository.interface';
import { slugify } from '../../domain/slug';
import { Provenance } from '../../domain/value-objects/provenance.vo';
import { canManageCurriculum, type CurriculumActor } from '../curriculum-actor';
import type { FillLessonGapDto } from '../dtos/course-outline.dto';
import { headline } from '../../domain/headline';
import {
  GenerateContentDraftQuery,
  type DraftStrategy,
} from '../queries/ai-draft.queries';
import { CreateCurriculumItemCommand } from './create-curriculum-item.command';
// [Command FillLessonGap]: «generar solo huecos»: si la lección ya tiene recursos no se genera nada; si está vacía usa el pipeline existente → caché → LLM | [Patrón]: Command Handler (CQRS) + reutiliza GenerateContentDraftQuery y CreateCurriculumItemCommand | [Principio]: DRY + SRP + deterministic-first

// [Resultado]: qué pasó con la lección (para la UI y para la trazabilidad)
export interface FillLessonGapResult {
  lessonId: string;
  reused: number; // Recursos que ya tenía (no se generó nada)
  created: number; // Recursos nuevos creados en estado GENERATED
  strategy?: DraftStrategy; // existing | cache | llm
  llmRequired?: boolean; // LLM_REQUIRED de la especificación
}

// [itemKey]: clave natural del recurso = tema + titular del contenido en slug (máx. 120, sin guion final) | función pura
const itemKey = (topic: string, content: Record<string, unknown>): string =>
  slugify(`${topic}-${headline(content)}`)
    .slice(0, 120)
    .replace(/-+$/, '');

@Injectable()
export class FillLessonGapCommand {
  constructor(
    @Inject(COURSE_OUTLINE_REPOSITORY)
    private readonly outlines: ICourseOutlineRepository,
    private readonly drafts: GenerateContentDraftQuery,
    private readonly createItem: CreateCurriculumItemCommand,
  ) {}

  async execute(
    courseId: string,
    lessonId: string,
    dto: FillLessonGapDto,
    actor: CurriculumActor,
  ): Promise<FillLessonGapResult> {
    if (!canManageCurriculum(actor))
      throw new ForbiddenException(
        'Solo docentes y administradores generan contenido',
      );
    const course = await this.outlines.findCourse(courseId);
    if (!course) throw new NotFoundException(`Curso ${courseId} no encontrado`);
    if (!course.language)
      throw new BadRequestException(
        'El curso no pertenece a un idioma del catálogo',
      );
    const lesson = await this.outlines.findLesson(courseId, lessonId);
    if (!lesson?.topic || !lesson.kind || !lesson.skill)
      throw new NotFoundException(
        `Lección ${lessonId} no encontrada en el curso`,
      );

    // [Solo huecos]: una lección con recursos no se toca → cero cómputo de LLM
    const current = lesson.items?.length ?? 0;
    if (current > 0) return { lessonId, reused: current, created: 0 };

    const target = {
      language: course.language,
      level: lesson.level,
      skill: lesson.skill,
      kind: lesson.kind,
      topic: lesson.topic,
    };
    const draft = await this.drafts.execute(
      { ...target, count: dto.count ?? 5 },
      actor.id,
    );

    // [Reutilizar]: el pipeline encontró un recurso que ya cubre el tema → se enlaza, no se crea nada
    if (draft.strategy === 'existing' && draft.existingItemId) {
      await this.outlines.addLessonItems(lessonId, [draft.existingItemId]);
      return {
        lessonId,
        reused: 1,
        created: 0,
        strategy: draft.strategy,
        llmRequired: draft.llmRequired,
      };
    }
    const ids: string[] = [];
    for (const d of draft.drafts) {
      try {
        // [Alta trazable]: provenance GENERATED + generationId → nace en estado GENERATED (nunca como verificado)
        const item = await this.createItem.execute(
          {
            ...target,
            key: itemKey(lesson.topic, d.content),
            content: d.content,
            provenance: Provenance.GENERATED,
            generationId: d.generationId ?? draft.generationId,
          },
          actor,
        );
        ids.push(item.id);
      } catch (err) {
        if (!(err instanceof ConflictException)) throw err; // Clave repetida = ya existe → se omite (idempotencia)
      }
    }
    await this.outlines.addLessonItems(lessonId, ids);
    return {
      lessonId,
      reused: 0,
      created: ids.length,
      strategy: draft.strategy,
      llmRequired: draft.llmRequired,
    };
  }
}
