import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { flattenOutline } from '../../domain/course-outline';
import {
  COURSE_OUTLINE_REPOSITORY,
  type ICourseOutlineRepository,
} from '../../domain/interfaces/course-outline.repository.interface';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { CourseNodeType } from '../../domain/value-objects/course-node-type.vo';
import { ReviewStatus } from '../../domain/value-objects/review-status.vo';
import { canManageCurriculum, type CurriculumActor } from '../curriculum-actor';
import type { SaveCourseOutlineDto } from '../dtos/course-outline.dto';
import {
  GetCourseOutlineQuery,
  type CourseOutlineView,
} from '../queries/get-course-outline.query';
// [Command SaveCourseOutline]: «estructura primero, reutilizar»: guarda el árbol del curso y enlaza a cada lección los recursos que YA existen | [Patrón]: Command Handler (CQRS) | [Principio]: SRP + DRY (no se genera lo que ya está) | [Paradigma]: POO + async/await

// [Reutilizables]: todo menos lo archivado (lo retirado no vuelve a un curso) | `Object.values` + `filter` (ES2017)
const REUSABLE = Object.values(ReviewStatus).filter(
  (s) => s !== ReviewStatus.ARCHIVED,
);

@Injectable()
export class SaveCourseOutlineCommand {
  constructor(
    @Inject(COURSE_OUTLINE_REPOSITORY)
    private readonly outlines: ICourseOutlineRepository,
    @Inject(CURRICULUM_REPOSITORY)
    private readonly items: ICurriculumRepository,
    private readonly outline: GetCourseOutlineQuery, // [DRY]: la respuesta es la misma vista que GET
  ) {}

  async execute(
    courseId: string,
    dto: SaveCourseOutlineDto,
    actor: CurriculumActor,
  ): Promise<CourseOutlineView> {
    if (!canManageCurriculum(actor))
      throw new ForbiddenException(
        'Solo docentes y administradores editan la estructura',
      );
    const course = await this.outlines.findCourse(courseId);
    if (!course) throw new NotFoundException(`Curso ${courseId} no encontrado`);
    if (!course.language)
      throw new BadRequestException(
        'El curso no pertenece a un idioma del catálogo (EN, FR, DE, ES, PT, ZH, RU)',
      );
    const language = course.language; // `const`: TS conserva el tipo Language (no null) dentro del callback

    const nodes = flattenOutline(dto.levels);
    // [Reutilizar]: por cada lección, recursos del mismo idioma + nivel + tipo + tema | `Promise.all` (ES2015): consultas en paralelo
    const lessons = nodes.filter((n) => n.type === CourseNodeType.LESSON);
    const found = await Promise.all(
      lessons.map((n) =>
        this.items.search({
          language,
          level: n.level,
          kind: n.kind!,
          topic: n.topic!,
          statuses: REUSABLE,
          page: 1,
          limit: 50,
        }),
      ),
    );
    // `new Map(entries)` (ES2015): ref de la lección → ids de recursos a enlazar
    const links = new Map(
      lessons.map(
        (n, i) => [n.ref, found[i].data.map((item) => item.id)] as const,
      ),
    );

    await this.outlines.saveOutline(courseId, nodes, links);
    return this.outline.execute(courseId, actor);
  }
}
