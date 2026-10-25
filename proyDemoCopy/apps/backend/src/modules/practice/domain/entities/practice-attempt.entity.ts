import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity PracticeAttempt · Sprint 8.12 · RF-112/RF-113]: respuesta del estudiante a un ítem con la retroalimentación de FastAPI (errores, corrección, respuesta correcta y consejo) | [Patrón]: Entity (DDD) + Snapshot (la retroalimentación se guarda tal cual) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'practice_attempts' })
@Index(['userId', 'createdAt'])
export class PracticeAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'activity_id' })
  activityId!: string;

  @Column({ type: 'uuid', name: 'item_id' })
  itemId!: string;

  @Column({ type: 'jsonb' })
  answer!: string[];

  @Column({ type: 'boolean' })
  correct!: boolean;

  @Column({ type: 'real' })
  score!: number; // 0..1 (aciertos parciales)

  // `jsonb`: EvaluateResponse de FastAPI (findings con tipo y posición, correct_answer, explanation, tip, method)
  @Column({ type: 'jsonb' })
  feedback!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
