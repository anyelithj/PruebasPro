import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { Language } from '../../../../shared/domain/language.vo';
import { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import { CurriculumItemKind } from '../value-objects/curriculum-item-kind.vo';
// [Entity CurriculumTopic]: catálogo de temas por idioma + nivel + competencia (y tipo opcional) | [Patrón]: Entity (DDD) | [Principio]: SRP
// [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'curriculum_topics' })
// [Tema equivalente]: mismo slug en la misma combinación idioma/nivel/competencia → duplicado
@Unique('uq_curriculum_topic', ['language', 'level', 'skill', 'slug'])
@Index('ix_curriculum_topic_combo', ['language', 'level', 'skill'])
export class CurriculumTopic {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string; // Nombre visible (p. ej. "Present Simple")

  @Column({ type: 'varchar', length: 120 })
  slug!: string; // Generado con slugify(name), nunca escrito a mano

  @Column({ type: 'enum', enum: Language })
  language!: Language;

  @Column({ type: 'enum', enum: CefrLevel })
  level!: CefrLevel;

  @Column({ type: 'enum', enum: LanguageSkill })
  skill!: LanguageSkill;

  // [Tipo opcional]: null = el tema aplica a cualquier tipo de recurso
  @Column({ type: 'enum', enum: CurriculumItemKind, nullable: true })
  kind!: CurriculumItemKind | null;

  // [Tema padre]: jerarquía opcional (p. ej. "Tiempos verbales" → "Present Simple")
  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null; // null = sembrado por el sistema

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
