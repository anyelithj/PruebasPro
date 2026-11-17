import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Course } from './course.entity';
// [Entity CourseEnrollment]: matrícula (compra/inscripción) + progreso + cierre académico del usuario en un curso | [Patrón]: Aggregate (DDD) | [Principio]: SRP

@Entity({ name: 'course_enrollments' })
@Index(['userId', 'courseId'], { unique: true })
@Index(['userId'])
@Index(['courseId'])
export class CourseEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Relation<Course>; // `Relation<>` (TypeORM): seguro con SWC

  // [Progreso 0..100]: porcentaje completado por el usuario
  @Column({ type: 'smallint', default: 0 })
  progress!: number;

  // [Caso F · 2026-11-13]: favorito y reacciones SALEN de la inscripción → tablas course_favorites y course_reactions (migración CourseFavoritesReactions)

  // [Acceso]: fecha de compra (pago) o inscripción (gratis) → desbloquea el material | null = sin acceso | [Principio]: SSOT del acceso
  @Column({ type: 'timestamptz', nullable: true, name: 'purchased_at' })
  purchasedAt!: Date | null;

  // [Materiales completados]: ids marcados como vistos en la línea de tiempo → de aquí sale `progress` | `array: true` (Postgres uuid[])
  @Column({
    type: 'uuid',
    array: true,
    default: () => "'{}'",
    name: 'completed_material_ids',
  })
  completedMaterialIds!: string[];

  // [Temas estudiados · 2026-10-25]: títulos de los subtemas del temario («## …» del contenido) marcados por el alumno → cuentan en `progress`
  @Column({
    type: 'text',
    array: true,
    default: () => "'{}'",
    name: 'completed_topics',
  })
  completedTopics!: string[];

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt!: Date | null;

  // [2026-11-09 · RF-32]: cierre académico aprobado por el docente (requisito del certificado) y nota final corregida (null = la del examen)
  @Column({ type: 'timestamptz', nullable: true, name: 'closure_approved_at' })
  closureApprovedAt!: Date | null;

  @Column({ type: 'smallint', nullable: true, name: 'final_grade' })
  finalGrade!: number | null;

  @Column({ type: 'uuid', nullable: true, name: 'closure_approved_by' })
  closureApprovedBy!: string | null;

  @Column({ type: 'text', nullable: true, name: 'grade_note' })
  gradeNote!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'grade_by' })
  gradeBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
