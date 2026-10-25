import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity ForumThread · Sprint 7.14 · RF-72]: hilo de discusión de una lección del temario | [Patrón]: Entity (DDD) + State (open → closed) + Snapshot (nombre del autor) + Soft Delete (`@DeleteDateColumn`) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL
// [Moderación]: TEACHER/ADMIN fijan, cierran o retiran hilos; retirar = borrado lógico (auditable, no se pierde)

export type ThreadStatus = 'open' | 'closed';

@Entity({ name: 'forum_threads' })
@Index(['lessonId', 'pinned', 'lastPostAt'])
export class ForumThread {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Lección]: nodo `lesson` del temario (Curriculum 4.4) · courseId copiado para comprobar la inscripción sin otra consulta
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId!: string;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @Column({ type: 'varchar', length: 160, name: 'author_name' })
  authorName!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 8, default: 'open' })
  status!: ThreadStatus;

  @Column({ type: 'boolean', default: false })
  pinned!: boolean;

  // [Contador]: se mantiene al crear/borrar respuestas → la lista no cuenta filas en cada lectura
  @Column({ type: 'int', name: 'posts_count', default: 0 })
  postsCount!: number;

  @Column({ type: 'timestamptz', name: 'last_post_at', default: () => 'now()' })
  lastPostAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // `@DeleteDateColumn` (TypeORM): `softDelete` lo rellena y los `find` lo excluyen solos
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;
}
