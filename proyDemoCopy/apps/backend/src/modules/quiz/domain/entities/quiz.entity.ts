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

  // [Relación a preguntas]: cargada bajo demanda con eager false
  @OneToMany(() => Question, (q) => q.quiz, { cascade: ['insert', 'update'] })
  questions?: Relation<Question>[]; // `Relation<>`: rompe el ciclo de importación Quiz↔Question al compilar con SWC

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
