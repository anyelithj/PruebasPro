import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { License } from '../../../music/domain/value-objects/license.vo';
// [Entity Dialogue · Sprint 9.3 · RF-125/RF-126/RF-127/RF-128]: diálogo guionado de dos hablantes con licencia, audio opcional y nivel CEFR estimado por FastAPI que el docente confirma | [Patrón]: Entity (DDD) + State (estimated → confirmed) + Soft Delete (withdrawnAt) | [Principio]: SRP + verificación humana (solo los confirmados se publican) | [Tecnología]: TypeORM + PostgreSQL

export type LevelStatus = 'estimated' | 'confirmed';

export interface LevelEstimate {
  level: string;
  confidence: number;
  method: 'measures' | 'rubric';
  indicators: Record<string, number>;
  explanation: string;
  model: string | null;
}

@Entity({ name: 'dialogues' })
@Index(['language', 'level', 'levelStatus'])
export class Dialogue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'uuid', name: 'topic_id', nullable: true })
  topicId!: string | null;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'jsonb', default: () => `'["A","B"]'` })
  speakers!: string[]; // Nombres de los dos hablantes (Ana y Tom…); el turno guarda la letra A o B

  @Column({ type: 'varchar', length: 2, nullable: true })
  level!: string | null; // Estimado por FastAPI o confirmado por el docente

  @Column({
    type: 'varchar',
    length: 10,
    name: 'level_status',
    default: 'estimated',
  })
  levelStatus!: LevelStatus;

  @Column({ type: 'jsonb', name: 'level_estimate', nullable: true })
  levelEstimate!: LevelEstimate | null; // Indicadores y método de la estimación (el docente ve por qué)

  @Column({ type: 'jsonb' })
  license!: License;

  @Column({ type: 'varchar', length: 200, name: 'audio_key', nullable: true })
  audioKey!: string | null;

  @Column({ type: 'varchar', length: 40, name: 'audio_mime', nullable: true })
  audioMime!: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'timestamptz', name: 'withdrawn_at', nullable: true })
  withdrawnAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
