import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager } from 'typeorm';
import { Language } from '../../../../shared/domain/language.vo';
import type { PlannedNode, StoredNode } from '../../domain/course-outline';
import { CourseNode } from '../../domain/entities/course-node.entity';
import type { CurriculumItem } from '../../domain/entities/curriculum-item.entity';
import { LessonProgress } from '../../domain/entities/lesson-progress.entity';
import type {
  CourseRef,
  ICourseOutlineRepository,
  LessonRef,
} from '../../domain/interfaces/course-outline.repository.interface';
import { CourseNodeType } from '../../domain/value-objects/course-node-type.vo';
// [Adapter TypeORM de ICourseOutlineRepository]: árbol del curso en course_nodes + enlaces en course_lesson_items | [Patrón]: Repository + Unit of Work (transacción) | [Principio]: DIP (implementa el puerto del dominio) | [Tecnología]: TypeORM + PostgreSQL

// [Idiomas válidos]: `Set` (ES2015) de los códigos ISO del enum → el grupo del curso «EN» se traduce a «en»
const LANGUAGES = new Set<string>(Object.values(Language));

@Injectable()
export class CourseOutlineRepository implements ICourseOutlineRepository {
  // `@InjectDataSource` (NestJS/TypeORM): conexión para transacciones y para leer el curso sin importar el módulo Courses
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async findCourse(courseId: string): Promise<CourseRef | null> {
    // [Consulta mínima]: solo id y grupo (idioma) | parámetro `$1` (SQL parametrizado → sin inyección)
    const rows: Array<{ id: string; category_group: string }> =
      await this.ds.query(
        'SELECT id, category_group FROM courses WHERE id = $1',
        [courseId],
      );
    if (!rows.length) return null;
    const lang = rows[0].category_group.toLowerCase();
    return {
      id: rows[0].id,
      language: LANGUAGES.has(lang) ? (lang as Language) : null,
    };
  }

  async saveOutline(
    courseId: string,
    nodes: ReadonlyArray<PlannedNode>,
    links: ReadonlyMap<string, ReadonlyArray<string>>,
  ): Promise<void> {
    // `transaction` (TypeORM): actualizar + crear + borrar + enlazar ocurre completo o no ocurre | [Patrón]: Unit of Work
    await this.ds.transaction(async (em: EntityManager) => {
      const current = new Set(
        (
          await em.find(CourseNode, {
            where: { courseId },
            select: { id: true },
          })
        ).map((n) => n.id),
      );
      const ids = new Map<string, string>(); // ref → id definitivo
      for (const n of nodes) {
        // `for…of` secuencial: el padre ya tiene id cuando llega el hijo (flattenOutline ordena padre → hijos)
        const data = {
          courseId,
          parentId: n.parentRef === null ? null : ids.get(n.parentRef)!, // `!` (TS): el padre ya se procesó
          type: n.type,
          title: n.title,
          position: n.position,
          level: n.level,
          topic: n.topic,
          kind: n.kind,
          skill: n.skill,
        };
        // [Identidad estable]: solo se respeta un id que YA pertenece a este curso (un id ajeno se trata como nodo nuevo)
        const keep = n.id !== null && current.has(n.id);
        const id = keep
          ? n.id!
          : (await em.save(em.create(CourseNode, data))).id;
        if (keep) await em.update(CourseNode, { id }, data);
        ids.set(n.ref, id);
        for (const itemId of links.get(n.ref) ?? []) {
          // `ON CONFLICT DO NOTHING` (PostgreSQL): enlace idempotente → los recursos ya enlazados (p. ej. generados) se conservan
          await em.query(
            'INSERT INTO course_lesson_items (lesson_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, itemId],
          );
        }
      }
      // [Quitados]: nodos que el autor eliminó (ON DELETE CASCADE borra sus hijos, enlaces y progreso)
      const kept = new Set(ids.values());
      const removed = [...current].filter((id) => !kept.has(id));
      if (removed.length) await em.delete(CourseNode, { id: In(removed) });
    });
  }

  async findOutline(courseId: string): Promise<StoredNode[]> {
    const rows = await this.ds.getRepository(CourseNode).find({
      where: { courseId },
      relations: { items: true }, // Recursos de cada lección en una sola consulta (JOIN)
      order: { position: 'ASC' },
    });
    return rows.map(toStored);
  }

  async findLesson(
    courseId: string,
    lessonId: string,
  ): Promise<StoredNode | null> {
    const row = await this.ds.getRepository(CourseNode).findOne({
      where: { id: lessonId, courseId, type: CourseNodeType.LESSON },
      relations: { items: true },
    });
    return row ? toStored(row) : null;
  }

  // [findLessonRef · Sprint 7.14]: solo id, curso y título (sin recursos) → consulta mínima para los foros
  async findLessonRef(lessonId: string): Promise<LessonRef | null> {
    const row = await this.ds.getRepository(CourseNode).findOne({
      where: { id: lessonId, type: CourseNodeType.LESSON },
      select: { id: true, courseId: true, title: true },
    });
    return row
      ? { id: row.id, courseId: row.courseId, title: row.title }
      : null;
  }

  async addLessonItems(
    lessonId: string,
    itemIds: ReadonlyArray<string>,
  ): Promise<void> {
    if (!itemIds.length) return;
    const current = await this.ds
      .getRepository(CourseNode)
      .findOne({ where: { id: lessonId }, relations: { items: true } });
    const known = new Set((current?.items ?? []).map((i) => i.id));
    const fresh = itemIds.filter((id) => !known.has(id)); // Sin duplicados en la tabla de enlace
    if (fresh.length)
      await this.ds
        .createQueryBuilder()
        .relation(CourseNode, 'items')
        .of(lessonId)
        .add(fresh);
  }

  async findLessonItems(lessonId: string): Promise<CurriculumItem[]> {
    const row = await this.ds
      .getRepository(CourseNode)
      .findOne({ where: { id: lessonId }, relations: { items: true } });
    return row?.items ?? [];
  }

  async completedLessonIds(
    userId: string,
    courseId: string,
  ): Promise<string[]> {
    // JOIN con course_nodes: solo el progreso de las lecciones de ESTE curso | parámetros $1/$2
    const rows: Array<{ lesson_id: string }> = await this.ds.query(
      'SELECT p.lesson_id FROM lesson_progress p JOIN course_nodes n ON n.id = p.lesson_id WHERE p.user_id = $1 AND n.course_id = $2',
      [userId, courseId],
    );
    return rows.map((r) => r.lesson_id);
  }

  async completeLesson(userId: string, lessonId: string): Promise<void> {
    // `orIgnore` (TypeORM → ON CONFLICT DO NOTHING): completar dos veces es seguro
    await this.ds
      .createQueryBuilder()
      .insert()
      .into(LessonProgress)
      .values({ userId, lessonId })
      .orIgnore()
      .execute();
  }
}

// [toStored]: entidad → forma del dominio (solo lo que el árbol necesita) | [Patrón]: Mapper
const toStored = (n: CourseNode): StoredNode => ({
  id: n.id,
  parentId: n.parentId,
  type: n.type,
  title: n.title,
  position: n.position,
  level: n.level,
  topic: n.topic,
  kind: n.kind,
  skill: n.skill,
  items: (n.items ?? []).map((i) => ({
    id: i.id,
    key: i.key,
    kind: i.kind,
    reviewStatus: i.reviewStatus,
  })),
});
