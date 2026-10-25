import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, type Relation } from 'typeorm';
import { CourseNode } from './course-node.entity';
// [Entidad LessonProgress]: qué lecciones completó cada estudiante → línea de tiempo y «siguiente lección» | [Patrón]: Event Record (un registro por lección completada) | [Principio]: SRP + idempotencia (clave única usuario + lección) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'lesson_progress' })
@Unique('uq_lesson_progress_user_lesson', ['userId', 'lessonId']) // Completar dos veces no duplica
@Index('ix_lesson_progress_user', ['userId'])
export class LessonProgress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Lección]: al borrar la lección de la estructura se borra su progreso (ON DELETE CASCADE)
  @Column({ type: 'uuid', name: 'lesson_id' })
  lessonId!: string;

  @ManyToOne(() => CourseNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: Relation<CourseNode>; // `Relation<>` (TypeORM): seguro con SWC

  @CreateDateColumn({ type: 'timestamptz', name: 'completed_at' })
  completedAt!: Date;
}
