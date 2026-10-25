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
// [Entity CourseEnrollment]: matrícula + progreso + reacciones del usuario en un curso | [Patrón]: Aggregate (DDD) | [Principio]: SRP

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

  @Column({ type: 'boolean', default: false, name: 'is_favorite' })
  isFavorite!: boolean;

  // [Reacciones rápidas]: contadores booleanos por usuario | [SSOT]: coincide con frontend ReactionState
  @Column({ type: 'boolean', default: false, name: 'reaction_like' })
  reactionLike!: boolean;

  @Column({ type: 'boolean', default: false, name: 'reaction_love' })
  reactionLove!: boolean;

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

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
