import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm'; // [TypeORM]: decoradores de mapeo objeto-relacional
import { Course } from './course.entity';
// [Entity CourseFavorite · 2026-11-13 · Caso F]: ⭐ Favorito = el usuario GUARDA el curso para volver a él (privado, sin conteo público)
// Antes vivía como columna `is_favorite` dentro de CourseEnrollment (mezclado con la compra) → ahora es su propio agregado | [Patrón]: Entity (DDD) | [Principio]: SRP
// Clave primaria compuesta (user_id, course_id) = «único por usuario y curso» sin id artificial → PUT idempotente por naturaleza

@Entity({ name: 'course_favorites' }) // `@Entity` (TypeORM): tabla course_favorites
@Index(['userId', 'createdAt']) // [Rendimiento]: «Mis favoritos» paginado por usuario, del más reciente al más antiguo
export class CourseFavorite {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' }) // `@PrimaryColumn` (TypeORM): parte de la PK compuesta
  userId!: string; // `!` (TS): asignación definitiva → la rellena TypeORM

  @PrimaryColumn({ type: 'uuid', name: 'course_id' }) // Segunda parte de la PK → (user_id, course_id) único
  courseId!: string;

  // `@ManyToOne` (TypeORM): FK a courses con ON DELETE CASCADE → al borrar el curso desaparecen sus ⭐/👍/❤️ (igual que la inscripción)
  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Relation<Course>; // `Relation<>` (TypeORM): evita la dependencia circular de tipos con SWC

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' }) // `@CreateDateColumn` (TypeORM): fecha de alta automática
  createdAt!: Date;
}
