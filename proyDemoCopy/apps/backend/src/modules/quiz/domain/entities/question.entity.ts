import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Difficulty } from '../value-objects/difficulty.vo';
import { DEFAULT_LANGUAGE, Language } from '../value-objects/language.vo';
import { Quiz } from './quiz.entity';
// [Entity Question]: parte del agregado Quiz | [Patrón]: Entity (DDD) | [Principio]: SRP | [Paradigma]: POO

// [Tipos de pregunta]: alineados con AI service (grading_request.QuestionType)
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  OPEN_ANSWER = 'open_answer',
}

@Entity({ name: 'questions' })
@Index(['quizId'])
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'quiz_id' })
  quizId!: string;

  // [Relación inversa al agregado]: lookup eficiente | [Patrón]: ORM ManyToOne
  @ManyToOne(() => Quiz, (q) => q.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz?: Relation<Quiz>; // `Relation<>` (TypeORM): sin metadatos de tipo en tiempo de carga → evita el ciclo Quiz↔Question con SWC

  @Column({ type: 'text' })
  text!: string;

  @Column({
    type: 'enum',
    enum: QuestionType,
    default: QuestionType.MULTIPLE_CHOICE,
  })
  type!: QuestionType;

  // [Opciones]: array para multiple choice; null en true/false y open answer
  @Column({ type: 'jsonb', nullable: true })
  options?: string[];

  // [Respuesta correcta]: texto exacto. Para abierta es referencia para similitud
  @Column({ type: 'text', name: 'correct_answer' })
  correctAnswer!: string;

  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.MEDIUM })
  difficulty!: Difficulty;

  // [Idioma del enunciado y opciones]: hereda del Quiz pero se persiste por pregunta para queries directos | [Patrón]: Value Object embebido | [Principio]: SRP
  @Column({ type: 'enum', enum: Language, default: DEFAULT_LANGUAGE })
  language!: Language;

  // [Orden]: posición de la pregunta dentro del quiz
  @Column({ type: 'int', default: 0 })
  position!: number;

  // [Tiempo límite override]: si null, usa Quiz.timePerQuestionSeconds
  @Column({ type: 'int', nullable: true, name: 'time_limit_seconds' })
  timeLimitSeconds?: number;

  // [Explicación]: razón académica por la cual la respuesta es correcta | [Principio]: SRP
  @Column({ type: 'text', nullable: true })
  explanation?: string;

  // [Feedback]: orientación pedagógica sobre el tema | [Principio]: SRP
  @Column({ type: 'text', nullable: true })
  feedback?: string;
}
