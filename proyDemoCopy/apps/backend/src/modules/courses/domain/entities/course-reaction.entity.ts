import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm'; // [TypeORM]: decoradores de mapeo objeto-relacional
import { Course } from './course.entity';
// [Entity CourseReaction · 2026-11-13 · Caso F]: 👍 Me gusta (valoración positiva) o ❤️ Me encanta (alta satisfacción) — EXCLUYENTES
// PK compuesta (user_id, course_id) → como máximo UNA reacción por usuario y curso; elegir otra REEMPLAZA el tipo | [Patrón]: Entity (DDD) | [Principio]: SRP + invariante en la BD

// `as const` (TS): tupla de literales de solo lectura → de ella se deriva el tipo unión (SSOT para DTO, enum de la BD y validación)
export const COURSE_REACTION_TYPES = ['like', 'love'] as const;
export type CourseReactionType = (typeof COURSE_REACTION_TYPES)[number]; // [Indexed access type] (TS): 'like' | 'love'

@Entity({ name: 'course_reactions' }) // `@Entity` (TypeORM): tabla course_reactions
@Index(['courseId', 'type']) // [Rendimiento]: conteos públicos (COUNT … GROUP BY course_id, type) del catálogo
export class CourseReaction {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' }) // `@PrimaryColumn` (TypeORM): parte de la PK compuesta
  userId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  // `@ManyToOne` (TypeORM): FK a courses con ON DELETE CASCADE → al borrar el curso desaparecen sus ⭐/👍/❤️ (igual que la inscripción)
  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Relation<Course>; // `Relation<>` (TypeORM): evita la dependencia circular de tipos con SWC

  // `enum` (PostgreSQL vía TypeORM): la BD rechaza cualquier valor que no sea like | love (defensa en profundidad)
  @Column({
    type: 'enum',
    enum: COURSE_REACTION_TYPES,
    enumName: 'course_reaction_type',
  })
  type!: CourseReactionType;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }) // `@UpdateDateColumn` (TypeORM): se actualiza al cambiar like ↔ love
  updatedAt!: Date;
}
