import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { Language } from '../../../../shared/domain/language.vo';
import { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import { CurriculumItemKind } from '../value-objects/curriculum-item-kind.vo';
// [Entity CurriculumGeneration]: registro inmutable de CADA borrador producido por el LLM + su traza (modelo, cuantización, tokens, latencia, memoria, banderas)
// [Patrón]: Event Log / Audit Record + Cache-Aside persistente (misma petición → se reutiliza sin volver a llamar al LLM) | [Principio]: SRP + Trazabilidad | [Tecnología]: TypeORM + Postgres (jsonb)

// `export interface` (TS): banderas de calidad exigidas por la especificación curricular
export interface GenerationFlags {
  requiresReview: boolean; // REQUIERE_REVISION: todo contenido de IA lo es hasta revisión humana
  reasons: string[]; // Motivos legibles (p. ej. "IPA generada por IA sin fuente verificada")
  contradiction: 'not_checked' | 'none' | 'detected'; // CONTRADICCION_DETECTADA — 'not_checked' si no hubo varias fuentes que comparar (no se inventa)
  reusable: boolean; // REUTILIZABLE
  llmRequired: boolean; // LLM_REQUIRED
}

@Entity({ name: 'curriculum_generations' })
@Index(['requestHash']) // Búsqueda O(log n) de peticiones idénticas (caché)
export class CurriculumGeneration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Huella de la petición]: sha256(tipo|idioma|nivel|habilidad|tema normalizado|versión del prompt) → identifica peticiones equivalentes
  @Column({ type: 'char', length: 64, name: 'request_hash' })
  requestHash!: string;

  @Column({ type: 'enum', enum: CurriculumItemKind })
  kind!: CurriculumItemKind;

  @Column({ type: 'enum', enum: Language })
  language!: Language;

  @Column({ type: 'enum', enum: CefrLevel })
  level!: CefrLevel;

  @Column({ type: 'enum', enum: LanguageSkill })
  skill!: LanguageSkill;

  @Column({ type: 'varchar', length: 160 })
  topic!: string;

  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>; // Contenido YA validado por el esquema del dominio

  // ───── Traza del modelo (lo que Ollama informa; null = no disponible, nunca inventado) ─────
  @Column({ type: 'varchar', length: 120 })
  model!: string;

  @Column({ type: 'varchar', length: 80, name: 'model_digest', nullable: true })
  modelDigest!: string | null; // Versión exacta del modelo (hash del blob)

  @Column({ type: 'varchar', length: 40, nullable: true })
  quantization!: string | null; // p. ej. Q4_K_M

  @Column({
    type: 'varchar',
    length: 40,
    name: 'parameter_size',
    nullable: true,
  })
  parameterSize!: string | null; // p. ej. 3.1B

  @Column({ type: 'int', name: 'prompt_tokens', nullable: true })
  promptTokens!: number | null;

  @Column({ type: 'int', name: 'output_tokens', nullable: true })
  outputTokens!: number | null;

  @Column({ type: 'int', name: 'latency_ms', nullable: true })
  latencyMs!: number | null; // Tiempo total de la petición

  @Column({ type: 'int', name: 'load_ms', nullable: true })
  loadMs!: number | null; // Parte de la latencia usada en cargar el modelo (arranque en frío)

  // `bigint` → string en JS; se transforma a number | [Tipado seguro]
  @Column({
    type: 'bigint',
    name: 'ram_bytes',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  ramBytes!: number | null; // Memoria total del modelo cargado (/api/ps)

  @Column({
    type: 'bigint',
    name: 'vram_bytes',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  vramBytes!: number | null; // Parte en GPU (0 = solo CPU)

  @Column({ type: 'varchar', length: 20, name: 'prompt_version' })
  promptVersion!: string; // Cambia el prompt → cambia la huella → no se reutilizan borradores obsoletos

  @Column({ type: 'jsonb' })
  flags!: GenerationFlags;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
