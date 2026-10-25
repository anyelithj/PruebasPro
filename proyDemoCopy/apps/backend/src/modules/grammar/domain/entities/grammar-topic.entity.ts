import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TopicLike } from '../../../../shared/application/topic-crud.service';
// [Entity GrammarTopic · Sprint 10.9 · RF-133/RF-135]: ficha de gramática de un idioma y nivel («Present Simple», «Present Continuous», «Present Perfect»…) creada a mano o desde un borrador de IA | [Patrón]: Entity (DDD) + State (draft → published) + Soft Delete (archivedAt) | [Principio]: SRP + DRY (TopicCrudService) + verificación humana | [Tecnología]: TypeORM + PostgreSQL

export const GRAMMAR_STATUSES = ['draft', 'published'] as const;
export type GrammarStatus = (typeof GRAMMAR_STATUSES)[number];

@Entity({ name: 'grammar_topics' })
@Index(['language', 'status'])
export class GrammarTopic implements TopicLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string; // Nombre del tema en el idioma que se estudia («Present Simple»)

  @Column({ type: 'text', default: '' })
  summary!: string; // Resumen en español

  @Column({ type: 'varchar', length: 2, nullable: true })
  language!: string | null; // Idioma de la ficha (en la práctica siempre uno)

  @Column({ type: 'jsonb', default: () => "'[]'" })
  levels!: string[]; // Nivel MCER (A1–C2)

  // [Estado]: un borrador de IA no se publica sin revisión docente
  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status!: GrammarStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  model!: string | null; // Modelo que generó el borrador (traza); null = manual

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
