import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  buildTree,
  lessonsInOrder,
  nextLessonId,
  summarize,
  withProgress,
  type OutlineNodeView,
  type StoredNode,
} from '../../domain/course-outline';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import {
  COURSE_OUTLINE_REPOSITORY,
  type ICourseOutlineRepository,
} from '../../domain/interfaces/course-outline.repository.interface';
import { CourseNodeType } from '../../domain/value-objects/course-node-type.vo';
import { STUDENT_VISIBLE_STATUSES } from '../../domain/value-objects/review-status.vo';
import { canManageCurriculum, type CurriculumActor } from '../curriculum-actor';
// [Queries de la estructura del curso]: árbol con progreso (línea de tiempo) y detalle de una lección | [Patrón]: Query Handler (CQRS) + Read Model | [Principio]: SRP + DRY (la visibilidad y el árbol se calculan una sola vez) | [Paradigma]: POO + async/await

// [Respuesta del árbol]: niveles + resumen con la «siguiente lección» del usuario
export interface CourseOutlineView {
  courseId: string;
  levels: OutlineNodeView[];
  summary: { lessons: number; gaps: number; completed: number; nextLessonId: string | null };
}

// [Respuesta de una lección]: contenido completo + navegación (anterior / siguiente) + ruta (nivel › módulo › unidad)
export interface LessonView {
  lesson: OutlineNodeView;
  items: CurriculumItem[];
  path: string[]; // Títulos de los ancestros, de la raíz a la unidad
  position: { index: number; total: number }; // «Lección 3 de 12»
  prevLessonId: string | null;
  nextLessonId: string | null;
}

@Injectable()
export class GetCourseOutlineQuery {
  constructor(
    @Inject(COURSE_OUTLINE_REPOSITORY)
    private readonly outlines: ICourseOutlineRepository,
  ) {}

  async execute(courseId: string, actor: CurriculumActor): Promise<CourseOutlineView> {
    const { levels } = await this.tree(courseId, actor);
    return { courseId, levels, summary: { ...summarize(levels), nextLessonId: nextLessonId(levels) } };
  }

  async lesson(courseId: string, lessonId: string, actor: CurriculumActor): Promise<LessonView> {
    const { levels, nodes } = await this.tree(courseId, actor);
    const order = lessonsInOrder(levels);
    const index = order.findIndex((l) => l.id === lessonId);
    if (index === -1) throw new NotFoundException(`Lección ${lessonId} no encontrada en el curso`);
    // [Ruta]: sube por parentId hasta la raíz | `Map` (ES2015) para buscar padres en O(1)
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const path: string[] = [];
    for (let p = byId.get(lessonId)?.parentId ?? null; p; p = byId.get(p)?.parentId ?? null) path.unshift(byId.get(p)!.title);
    const visibleIds = new Set((order[index].items ?? []).map((i) => i.id)); // Ya filtrado por rol en tree()
    const items = (await this.outlines.findLessonItems(lessonId)).filter((i) => visibleIds.has(i.id));
    return {
      lesson: order[index],
      items,
      path,
      position: { index: index + 1, total: order.length },
      prevLessonId: order[index - 1]?.id ?? null, // `?.` (ES2020): sin anterior en la primera lección
      nextLessonId: order[index + 1]?.id ?? null,
    };
  }

  // [tree]: árbol visible para el actor + su progreso | [Principio]: DRY (lo usan el árbol y la lección)
  private async tree(courseId: string, actor: CurriculumActor): Promise<{ levels: OutlineNodeView[]; nodes: StoredNode[] }> {
    if (!(await this.outlines.findCourse(courseId))) throw new NotFoundException(`Curso ${courseId} no encontrado`);
    const [nodes, done] = await Promise.all([this.outlines.findOutline(courseId), this.outlines.completedLessonIds(actor.id, courseId)]);
    // [Visibilidad]: el estudiante solo ve recursos aprobados (nunca contenido de IA sin revisar)
    const visible = canManageCurriculum(actor)
      ? nodes
      : nodes.map((n) => ({
          ...n,
          items: n.type === CourseNodeType.LESSON ? (n.items ?? []).filter((i) => STUDENT_VISIBLE_STATUSES.includes(i.reviewStatus)) : n.items,
        }));
    return { levels: withProgress(buildTree(visible), new Set(done)), nodes: visible };
  }
}
