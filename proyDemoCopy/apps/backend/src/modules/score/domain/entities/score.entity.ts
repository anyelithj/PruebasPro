import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity Score]: registro inmutable de resultado de una sesion | [Patron]: Entity (DDD) + Active Record | [Principio]: SRP | [Paradigma]: POO

@Entity({ name: 'scores' })
@Index(['userId'])
@Index(['quizId'])
@Index(['createdAt'])
export class Score {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'quiz_id' })
  quizId!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'float' })
  points!: number;

  @Column({ type: 'int', name: 'correct_count' })
  correctCount!: number;

  @Column({ type: 'int', name: 'total_questions' })
  totalQuestions!: number;

  // [Accuracy 0..1]: redundante pero util para queries de ranking sin recalcular
  @Column({ type: 'float', name: 'accuracy' })
  accuracy!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
