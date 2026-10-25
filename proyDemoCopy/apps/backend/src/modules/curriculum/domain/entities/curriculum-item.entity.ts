import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { Language } from '../../../../shared/domain/language.vo';
import { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import { CurriculumItemKind } from '../value-objects/curriculum-item-kind.vo';
import { Provenance } from '../value-objects/provenance.vo';
import { ReviewStatus } from '../value-objects/review-status.vo';
// [Entity CurriculumItem]: raíz del agregado de conocimiento curricular (regla, vocabulario, ejercicio…) | [Patrón]: Aggregate Root (DDD) + Single Table Inheritance con discriminador `kind` | [Principio]: SRP | [Paradigma]: POO
// [Tecnología]: TypeORM (decoradores = mapeo objeto-relacional a PostgreSQL). Se sigue la convención del repo (entidades anotadas);
// el trade-off (dominio ↔ ORM) está documentado en docs/adr/0004-curriculum-single-table.md
// [Decisión]: UNA tabla + JSONB validado por Zod en vez de 8 tablas → menos joins, menos migraciones, mismo rigor de validación.

// `@Entity` (TypeORM): mapea la clase a la tabla `curriculum_items`
@Entity({ name: 'curriculum_items' })
// `@Unique` (TypeORM): clave natural → evita duplicados e idempotencia al importar | [Principio]: evitar duplicación de datos
@Unique('uq_curriculum_natural_key', ['language', 'kind', 'key'])
// `@Index` (TypeORM): índice compuesto para el filtro principal (idioma + nivel + competencia)
@Index('ix_curriculum_lang_level_skill', ['language', 'level', 'skill'])
@Index('ix_curriculum_status', ['reviewStatus'])
export class CurriculumItem {
  // `@PrimaryGeneratedColumn('uuid')`: PK generada por Postgres; `!` (TS): asignación garantizada por el ORM
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Clave natural legible]: slug estable, p. ej. "present-perfect" | `varchar(120)`
  @Column({ type: 'varchar', length: 120 })
  key!: string;

  // `type: 'enum'` (TypeORM + Postgres): valores cerrados validados también por la BD
  @Column({ type: 'enum', enum: CurriculumItemKind })
  kind!: CurriculumItemKind;

  @Column({ type: 'enum', enum: Language })
  language!: Language;

  @Column({ type: 'enum', enum: CefrLevel })
  level!: CefrLevel;

  @Column({ type: 'enum', enum: LanguageSkill })
  skill!: LanguageSkill;

  // [Tema]: agrupa recursos (p. ej. "viajes", "tiempos verbales")
  @Column({ type: 'varchar', length: 160 })
  topic!: string;

  // `jsonb` (Postgres): contenido estructurado según el esquema del `kind`; indexable y consultable
  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>;

  @Column({ type: 'enum', enum: Provenance, default: Provenance.MANUAL })
  provenance!: Provenance;

  @Column({
    type: 'enum',
    enum: ReviewStatus,
    name: 'review_status',
    default: ReviewStatus.DRAFT,
  })
  reviewStatus!: ReviewStatus;

  // [Fuente/atribución]: obligatoria de facto para contenido importado (licencias) | `string | null` (TS): nullable explícito
  @Column({ type: 'varchar', length: 300, nullable: true })
  source!: string | null;

  // [Tema del catálogo]: nullable para recursos anteriores al catálogo
  @Column({ type: 'uuid', name: 'topic_id', nullable: true })
  topicId!: string | null;

  // [Fuente del catálogo]: el recurso se asocia a la fuente registrada; `source` conserva su nombre para visualización
  @Column({ type: 'uuid', name: 'source_id', nullable: true })
  sourceId!: string | null;

  // [Motivo de rechazo o nota editorial]
  @Column({ type: 'text', name: 'review_note', nullable: true })
  reviewNote!: string | null;

  // [Trazabilidad IA]: generación de la que salió el contenido (modelo, tokens, latencia…) | FK suave → null en contenido manual
  @Column({ type: 'uuid', name: 'generation_id', nullable: true })
  generationId!: string | null;

  // [Banderas de calidad de la especificación]: p. ej. CONTRADICCION_DETECTADA | `text[]` (PostgreSQL) + `array: true` (TypeORM) | se cambian sin tocar la versión editorial
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  flags!: string[];

  // `@VersionColumn` (TypeORM): incrementa en cada save → base del control de concurrencia optimista
  @VersionColumn()
  version!: number;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'uuid', name: 'updated_by' })
  updatedBy!: string;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true })
  reviewedAt!: Date | null;

  // `@CreateDateColumn` / `@UpdateDateColumn` (TypeORM): marcas de tiempo gestionadas por el ORM
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
