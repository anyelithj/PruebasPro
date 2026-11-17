import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Category } from '../value-objects/category.vo';
import { Difficulty } from '../value-objects/difficulty.vo';
import { DEFAULT_LANGUAGE, Language } from '../value-objects/language.vo';
import { Question } from './question.entity';
// [Entity Quiz]: agregado raíz del módulo Quiz | [Patrón]: Aggregate Root (DDD) + Active Record | [Principio]: SRP | [Paradigma]: POO

@Entity({ name: 'quizzes' })
@Index(['authorId'])
@Index(['category'])
@Index(['isPublished'])
@Index(['language'])
export class Quiz {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: Category, default: Category.GENERAL })
  category!: Category;

  @Column({ type: 'enum', enum: Difficulty, default: Difficulty.MEDIUM })
  difficulty!: Difficulty;

  // [Idioma del contenido]: aplica a title/description/questions | [Patrón]: Value Object embebido | [Principio]: SRP
  @Column({ type: 'enum', enum: Language, default: DEFAULT_LANGUAGE })
  language!: Language;

  // [FK suave a User]: Quiz pertenece a un USER/TEACHER (author)
  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  // [Origen]: 'custom' (creado por docente) o generado con IA — afecta política de score y caché
  @Column({ type: 'varchar', length: 32, default: 'custom' })
  source!: string;

  // [Tiempo límite por pregunta]: segundos. 0 = sin límite
  @Column({ type: 'int', default: 30, name: 'time_per_question_seconds' })
  timePerQuestionSeconds!: number;

  // [Publicado]: solo quizzes publicados aparecen en /quiz listing público
  @Column({ type: 'boolean', default: false, name: 'is_published' })
  isPublished!: boolean;

  // [2026-11-06 · Exámenes]: practice = quiz libre · final = examen final de un curso (da su certificado) · level = examen de nivel MCER sin curso
  @Index('IDX_quizzes_kind')
  @Column({ type: 'varchar', length: 16, default: 'practice' })
  kind!: 'practice' | 'final' | 'level';

  @Index('IDX_quizzes_course_id')
  @Column({ type: 'uuid', name: 'course_id', nullable: true })
  courseId!: string | null; // Solo kind = final

  @Column({ type: 'varchar', length: 2, name: 'cefr_level', nullable: true })
  cefrLevel!: string | null; // A1–C2 (final de curso de idiomas y nivel)

  @Column({ type: 'smallint', name: 'pass_score', default: 70 })
  passScore!: number; // % mínimo para aprobar

  @Column({ type: 'smallint', name: 'time_limit_minutes', default: 0 })
  timeLimitMinutes!: number; // Tiempo TOTAL del examen · 0 = sin límite

  @Column({ type: 'smallint', name: 'questions_per_attempt', default: 0 })
  questionsPerAttempt!: number; // Preguntas al azar del banco por intento · 0 = todas

  // [Relación a preguntas]: cargada bajo demanda con eager false
  @OneToMany(() => Question, (q) => q.quiz, { cascade: ['insert', 'update'] })
  questions?: Relation<Question>[]; // `Relation<>`: rompe el ciclo de importación Quiz↔Question al compilar con SWC

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
