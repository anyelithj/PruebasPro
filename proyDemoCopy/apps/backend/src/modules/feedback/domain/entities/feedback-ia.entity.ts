import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity FeedbackIA]: feedback pedagógico generado por LLM, persistido para revisión docente histórica + analytics + cache | [Patrón]: Entity (DDD) | [Principio]: SRP

// [Estrategia de calificación]: alineada con FastAPI ai-service modules/grading
export enum GradingStrategy {
  SIMILARITY = 'similarity',
  LLM_RUBRIC = 'llm_rubric',
  EXACT_MATCH = 'exact_match',
}

@Entity({ name: 'feedback_ia' })
@Index(['sessionId'])
@Index(['questionId'])
@Index(['userId'])
@Index(['createdAt'])
export class FeedbackIA {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK suave]: columnas uuid sin @ManyToOne
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Mensaje del feedback]: texto pedagógico generado por LLM
  @Column({ type: 'text' })
  content!: string;

  // [Sugerencia adicional]: opcional, recomendación de estudio
  @Column({ type: 'text', nullable: true })
  suggestion?: string | null;

  // [Score]: 0..1 normalizado
  @Column({ type: 'float' })
  score!: number;

  @Column({ type: 'boolean', name: 'is_correct' })
  isCorrect!: boolean;

  // [Confianza del LLM]: 0..1 (opcional)
  @Column({ type: 'float', nullable: true })
  confidence?: number | null;

  // [Modelo usado]: llama3-8b, gpt-4o-mini, etc.
  @Column({ type: 'varchar', length: 64 })
  model!: string;

  // [Estrategia que produjo el feedback]: persiste el path tomado en FastAPI
  @Column({
    type: 'enum',
    enum: GradingStrategy,
    name: 'strategy_used',
  })
  strategyUsed!: GradingStrategy;

  // [Latencia de la llamada al LLM]: ms (para analytics de performance)
  @Column({ type: 'int', nullable: true, name: 'latency_ms' })
  latencyMs?: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
