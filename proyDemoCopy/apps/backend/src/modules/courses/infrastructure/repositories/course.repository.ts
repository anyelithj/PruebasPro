import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Course } from '../../domain/entities/course.entity';
import { CourseEnrollment } from '../../domain/entities/course-enrollment.entity';
import {
  ACTIVE_COURSE_GROUPS,
  resolveCourseGroup,
} from '../../domain/value-objects/course-category.vo';
import { buildLanguageCourseSeed } from '../seeds/language-courses.seed';
import {
  ICourseRepository,
  PaginatedCourses,
  CourseSearchCriteria,
} from '../../domain/interfaces/course.repository.interface';
// [Adapter TypeORM CourseRepository]: impl persistente del port | [Patrón]: Adapter (Hexagonal) + Repository | [Principio]: DIP + LSP

@Injectable()
export class CourseRepository implements ICourseRepository, OnModuleInit {
  private readonly logger = new Logger(CourseRepository.name);

  constructor(
    @InjectRepository(Course) private readonly courseRepo: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepo: Repository<CourseEnrollment>,
  ) {}

  // [Bootstrap seed idempotente]: inserta solo los cursos de idiomas cuyo slug aún no existe (no toca ni borra filas previas) | [Patrón]: Idempotent Seed | [Tecnología]: NestJS lifecycle hook `OnModuleInit`
  async onModuleInit(): Promise<void> {
    try {
      const seed = buildLanguageCourseSeed(); // 42 cursos: 7 idiomas × 6 niveles MCER
      // `In` (TypeORM): una sola consulta `WHERE slug IN (...)` en vez de 42 → evita consultas redundantes
      const existing = await this.courseRepo.find({
        select: { slug: true },
        where: { slug: In(seed.map((c) => c.slug!)) },
      });
      const known = new Set(existing.map((c) => c.slug)); // `Set` (ES2015): búsqueda O(1)
      const missing = seed.filter((c) => !known.has(c.slug!));
      if (missing.length === 0) return; // Nada que insertar: arranque sin escrituras
      await this.courseRepo.save(missing);
      this.logger.log(
        `Catálogo de idiomas: ${missing.length} curso(s) insertado(s).`,
      );
    } catch (err) {
      this.logger.warn(
        `Seed de cursos no ejecutado: ${(err as Error).message}`,
      );
    }
  }

  async findAll(criteria: CourseSearchCriteria): Promise<PaginatedCourses> {
    const page = Math.max(1, criteria.page ?? 1);
    const limit = Math.min(100, Math.max(1, criteria.limit ?? 24));
    const qb = this.courseRepo.createQueryBuilder('c');

    if (criteria.group)
      qb.andWhere('c.group = :group', { group: criteria.group });
    // [Catálogo vigente]: excluye grupos legacy sin borrarlos (reversible) | [Patrón]: Specification simple
    if (criteria.onlyActiveGroups) {
      qb.andWhere('c.group IN (:...activeGroups)', {
        activeGroups: ACTIVE_COURSE_GROUPS,
      });
    }
    if (criteria.category)
      qb.andWhere('c.category = :category', { category: criteria.category });
    if (criteria.eje !== undefined)
      qb.andWhere('c.eje = :eje', { eje: criteria.eje });
    if (criteria.isProBono !== undefined)
      qb.andWhere('c.isProBono = :pb', { pb: criteria.isProBono });
    if (criteria.isPublished !== undefined)
      qb.andWhere('c.isPublished = :pub', { pub: criteria.isPublished });
    if (criteria.search) {
      qb.andWhere('(c.title ILIKE :q OR c.instructor ILIKE :q)', {
        q: `%${criteria.search}%`,
      });
    }

    // [Orden del catálogo]: por idioma y nivel (A1→C2) en vez de fecha, más útil para aprender
    qb.orderBy('c.group', 'ASC')
      .addOrderBy('c.category', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Course | null> {
    return this.courseRepo.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Course | null> {
    return this.courseRepo.findOne({ where: { slug: ILike(slug) } });
  }

  async getEnrollment(
    userId: string,
    courseId: string,
  ): Promise<CourseEnrollment | null> {
    return this.enrollmentRepo.findOne({ where: { userId, courseId } });
  }

  async upsertEnrollment(
    userId: string,
    courseId: string,
    patch: Partial<CourseEnrollment>,
  ): Promise<CourseEnrollment> {
    const existing = await this.enrollmentRepo.findOne({
      where: { userId, courseId },
    });
    if (existing) {
      Object.assign(existing, patch);
      return this.enrollmentRepo.save(existing);
    }
    const created = this.enrollmentRepo.create({
      userId,
      courseId,
      ...patch,
    });
    return this.enrollmentRepo.save(created);
  }

  async listEnrollmentsByUser(userId: string): Promise<CourseEnrollment[]> {
    return this.enrollmentRepo.find({ where: { userId } });
  }

  // [create]: alta administrativa | [Principio]: SRP
  async create(course: Partial<Course>): Promise<Course> {
    const entity = this.courseRepo.create({
      ...course,
      group: course.category
        ? resolveCourseGroup(course.category, course.group)
        : course.group,
    });
    return this.courseRepo.save(entity);
  }

  // [update]: edición parcial — recalcula group si cambia category | [Principio]: SRP
  async update(id: string, patch: Partial<Course>): Promise<Course> {
    const existing = await this.courseRepo.findOne({ where: { id } });
    if (!existing) {
      throw new Error(`Course ${id} no encontrado`);
    }
    Object.assign(existing, patch);
    if (patch.category) {
      // [Regla de dominio]: recalcula/valida el idioma al cambiar el nivel
      existing.group = resolveCourseGroup(
        patch.category,
        patch.group ?? existing.group,
      );
    }
    return this.courseRepo.save(existing);
  }

  // [remove]: baja dura — borra el curso (las inscripciones en cascade si la FK lo define) | [Principio]: SRP
  async remove(id: string): Promise<void> {
    await this.courseRepo.delete({ id });
  }

  // [setPublished]: baja blanda — desactiva sin perder enrollments | [Principio]: SRP
  async setPublished(id: string, isPublished: boolean): Promise<Course> {
    const existing = await this.courseRepo.findOne({ where: { id } });
    if (!existing) {
      throw new Error(`Course ${id} no encontrado`);
    }
    existing.isPublished = isPublished;
    return this.courseRepo.save(existing);
  }
}
