import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ActivityContent, Skill } from '../item-type';
// [Entity PracticeActivity · Sprint 8.12 · RF-110/RF-114]: actividad de práctica (conjunto de ítems) por idioma, nivel y habilidad | [Patrón]: Entity (DDD) + State (draft → published) + Soft Delete (archivedAt) | [Principio]: SRP + revisión humana (un borrador de IA no se publica solo) | [Tecnología]: TypeORM + PostgreSQL

export type ActivityStatus = 'draft' | 'published';

@Entity({ name: 'practice_activities' })
@Index(['language', 'level', 'skill'])
export class PracticeActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 2 })
  level!: string; // A1–C2

  @Column({ type: 'varchar', length: 12 })
  skill!: Skill;

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status!: ActivityStatus;

  // [2026-10-23]: contenidos de otras secciones que forman la actividad (vocabulario, juego, canción, diálogo…) | `jsonb` (PostgreSQL)
  @Column({ type: 'jsonb', default: () => "'[]'" })
  contents!: ActivityContent[];

  @Column({ type: 'boolean', name: 'ai_draft', default: false })
  aiDraft!: boolean; // true = nació de un borrador de IA (exige revisión antes de publicar)

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
