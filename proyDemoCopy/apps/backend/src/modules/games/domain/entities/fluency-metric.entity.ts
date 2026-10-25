import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity FluencyMetric · Sprint 8.5 · RF-102/RF-105]: métricas de una ronda oral (las calcula FastAPI Speech a partir de las marcas de tiempo) | [Patrón]: Entity (DDD) + serie temporal | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'fluency_metrics' })
@Index(['userId', 'createdAt'])
export class FluencyMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'uuid', name: 'round_id', nullable: true })
  roundId!: string | null;

  @Column({ type: 'real', name: 'time_to_respond_s' })
  timeToRespondS!: number;

  @Column({ type: 'real', name: 'speaking_time_s' })
  speakingTimeS!: number;

  @Column({ type: 'int' })
  pauses!: number;

  @Column({ type: 'real', name: 'longest_run_s' })
  longestRunS!: number;

  @Column({ type: 'int', name: 'words_produced' })
  wordsProduced!: number;

  @Column({ type: 'real', name: 'words_per_minute' })
  wordsPerMinute!: number;

  @Column({ type: 'real', name: 'reuse_ratio' })
  reuseRatio!: number; // Vocabulario de la sesión que el usuario reutilizó (0..1)

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
