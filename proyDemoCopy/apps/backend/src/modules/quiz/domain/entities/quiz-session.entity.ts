import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity QuizSession]: sesión de juego (instancia única de un user jugando un quiz) | [Patrón]: Entity (DDD) | [Principio]: SRP | [Paradigma]: POO

// [Estado]: máquina de estados de la sesión | [Patrón]: State
export enum SessionStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

// [Respuesta individual]: subdocumento JSON guardado en la sesión
export interface SessionAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  score: number;
  timeTakenMs: number;
  answeredAt: string;
}

@Entity({ name: 'quiz_sessions' })
@Index(['userId'])
@Index(['quizId'])
@Index(['status'])
export class QuizSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'quiz_id' })
  quizId!: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.IN_PROGRESS,
  })
  status!: SessionStatus;

  // [Respuestas]: array JSON, una entrada por pregunta contestada
  @Column({ type: 'jsonb', default: () => "'[]'" })
  answers!: SessionAnswer[];

  // [Total score]: suma de scores individuales (rellena al completar)
  @Column({ type: 'float', default: 0, name: 'total_score' })
  totalScore!: number;

  // [Aciertos]: para calcular accuracy en stats
  @Column({ type: 'int', default: 0, name: 'correct_count' })
  correctCount!: number;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt?: Date;
}
