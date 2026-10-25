import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TopicLike } from '../../../../shared/application/topic-crud.service';
// [Entity PolyglotTopic · Sprint 10.5 · RF-129/RF-132]: tema para comparar vocabulario o frases entre los siete idiomas (familia, animales, comida, viajes, cultura…) | [Patrón]: Entity (DDD) + State (draft → published) + Soft Delete (archivedAt) | [Principio]: SRP + DRY (TopicCrudService compartido con Dialogues y Grammar) | [Tecnología]: TypeORM + PostgreSQL

export const POLYGLOT_TOPIC_STATUSES = ['draft', 'published'] as const;
export type PolyglotTopicStatus = (typeof POLYGLOT_TOPIC_STATUSES)[number];
// [Categoría · 2026-10-19]: agrupa los temas en la UI (un select por categoría: vocabulario, frases, números, gramática…) — solo se compara lo comparable entre idiomas
export const POLYGLOT_CATEGORIES = ['vocabulary', 'phrases', 'numbers', 'grammar', 'other'] as const;
export type PolyglotCategory = (typeof POLYGLOT_CATEGORIES)[number];

@Entity({ name: 'polyglot_topics' })
export class PolyglotTopic implements TopicLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string; // En español (idioma de instrucción)

  @Column({ type: 'varchar', length: 16, default: '🌍' })
  emoji!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  language!: string | null; // Siempre null: un tema poliglota es de los siete idiomas (TopicLike lo exige)

  @Column({ type: 'jsonb', default: () => "'[]'" })
  levels!: string[];

  @Column({ type: 'varchar', length: 16, default: 'vocabulary' })
  category!: PolyglotCategory;

  // [Estado]: un borrador (manual o de IA) solo lo ve el personal; los estudiantes ven los publicados
  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status!: PolyglotTopicStatus;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
