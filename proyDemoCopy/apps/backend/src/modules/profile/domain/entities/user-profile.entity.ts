import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../../users/domain/entities/user.entity';
// [Entity UserProfile]: agregado raíz del Bounded Context Profile | [Patrón]: Aggregate Root (DDD) + Active Record (TypeORM) | [Principio]: SRP

// [Niveles de estudio]: enum cerrado SSOT — alinear con frontend
export enum EducationLevel {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  TECHNICAL = 'TECHNICAL',
  UNDERGRADUATE = 'UNDERGRADUATE',
  POSTGRADUATE = 'POSTGRADUATE',
  PHD = 'PHD',
  OTHER = 'OTHER',
}

@Entity({ name: 'user_profiles' })
// [Índice único user_id]: garantiza 1↔1 con User a nivel DB
@Index(['userId'], { unique: true })
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK a User]: relación 1↔1 propietaria | [Patrón]: Owner side
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId!: string;

  // [Relación OneToOne]: lazy para no cargar User en cada query | [Patrón]: Lazy Loading
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>; // `Relation<>` (TypeORM): seguro con SWC

  // [Nombre completo]: independiente de firstName/lastName legacy (UX libre)
  @Column({ type: 'varchar', length: 160, name: 'full_name' })
  fullName!: string;

  // [Fecha de nacimiento]: date (sin tiempo). Nullable hasta que el usuario complete su perfil.
  @Column({ type: 'date', name: 'date_of_birth', nullable: true })
  dateOfBirth!: Date | null;

  // [Nivel de estudios]: enum tipado | [SSOT]: lista cerrada en EducationLevel
  @Column({
    type: 'enum',
    enum: EducationLevel,
    nullable: true,
    name: 'education_level',
  })
  educationLevel!: EducationLevel | null;

  // [Actividad productiva]: texto libre (ej. "Estudiante", "Docente", "Independiente"…)
  // Tope 120 chars para evitar dumping de texto largo.
  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
    name: 'productive_activity',
  })
  productiveActivity!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
