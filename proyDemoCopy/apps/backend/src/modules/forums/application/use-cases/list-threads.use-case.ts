import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../../courses/domain/interfaces/course.repository.interface';
import {
  COURSE_OUTLINE_REPOSITORY,
  type ICourseOutlineRepository,
  type LessonRef,
} from '../../../curriculum/domain/interfaces/course-outline.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { Role } from '../../../users/domain/value-objects/role.vo';
import { ForumThread } from '../../domain/entities/forum-thread.entity';
// [UseCases ListThreads + GetThread + ForumAccess · Sprint 7.14 · RF-72]: hilos de una lección (fijados primero, luego los más activos) y la política de acceso que comparten todos los casos de uso del foro | [Patrón]: Query (CQRS ligero) + Policy (ForumAccess) | [Principio]: SRP + DRY (una sola regla de acceso) + mínimo privilegio | [Paradigma]: POO + async/await
// [Regla]: el foro es parte del curso → lo leen y escriben los inscritos (compra o inscripción gratuita) y los TEACHER/ADMIN; moderan TEACHER/ADMIN

export interface ForumActor {
  id: string;
  role: Role;
}

export const isModerator = (a: ForumActor): boolean =>
  a.role === Role.TEACHER || a.role === Role.ADMIN;

@Injectable()
export class ForumAccess {
  constructor(
    @Inject(COURSE_OUTLINE_REPOSITORY)
    private readonly outlines: ICourseOutlineRepository,
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  // [lesson]: la lección debe existir en el temario y el actor debe poder entrar al curso
  async lesson(lessonId: string, actor: ForumActor): Promise<LessonRef> {
    const lesson = await this.outlines.findLessonRef(lessonId);
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    await this.course(lesson.courseId, actor);
    return lesson;
  }

  async course(courseId: string, actor: ForumActor): Promise<void> {
    if (isModerator(actor)) return;
    const enrollment = await this.courses.getEnrollment(actor.id, courseId);
    // [Misma regla que el material del curso]: `purchasedAt` = compra o inscripción gratuita confirmada
    if (!enrollment?.purchasedAt)
      throw new ForbiddenException(
        'Inscríbete en el curso para participar en su foro',
      );
  }

  // [authorName]: nombre visible guardado como snapshot (cambiar el perfil no reescribe el historial del foro)
  async authorName(userId: string): Promise<string> {
    const u = await this.users.findById(userId);
    return (
      (`${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() ||
        u?.email.split('@')[0]) ??
      'Usuario'
    );
  }
}

@Injectable()
export class ListThreadsUseCase {
  constructor(
    @InjectRepository(ForumThread)
    private readonly threads: Repository<ForumThread>,
    private readonly access: ForumAccess,
  ) {}

  async execute(
    lessonId: string,
    actor: ForumActor,
  ): Promise<{ lesson: LessonRef; items: ForumThread[] }> {
    const lesson = await this.access.lesson(lessonId, actor);
    const items = await this.threads.find({
      where: { lessonId },
      order: { pinned: 'DESC', lastPostAt: 'DESC' },
      take: 100,
    });
    return { lesson, items };
  }
}

@Injectable()
export class GetThreadUseCase {
  constructor(
    @InjectRepository(ForumThread)
    private readonly threads: Repository<ForumThread>,
    private readonly access: ForumAccess,
  ) {}

  // [execute]: hilo visible (no retirado) + acceso al curso · lo reutilizan respuestas y moderación
  async execute(id: string, actor: ForumActor): Promise<ForumThread> {
    const thread = await this.threads.findOneBy({ id });
    if (!thread) throw new NotFoundException('Hilo no encontrado');
    await this.access.course(thread.courseId, actor);
    return thread;
  }
}
