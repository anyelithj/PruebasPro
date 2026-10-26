import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ReadingGenre,
  ReadingSource,
  ReadingStatus,
} from '../reading-genre';
// [Entity ReadingText · Lectura · 2026-10-25]: texto de lectura de un género por idioma y nivel MCER, creado con IA, a mano o importado; sus frases (con traducción e IPA) viven en ReadingSentence | [Patrón]: Entity (DDD) + State (draft → published) + Soft Delete (withdrawnAt) | [Principio]: SRP + verificación humana (solo los publicados los ven los estudiantes) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'reading_texts' })
@Index('IDX_reading_texts_filters', ['language', 'level', 'genre', 'status']) // [Rendimiento]: filtros de la lista del estudiante
@Index('IDX_reading_texts_created_by', ['createdBy'])
export class ReadingText {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_reading_texts' })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string; // ISO 639-1 (Language VO)

  @Column({ type: 'varchar', length: 2 })
  level!: string; // CEFR (CefrLevel VO)

  @Column({ type: 'varchar', length: 20 })
  genre!: ReadingGenre;

  @Column({ type: 'varchar', length: 160, nullable: true })
  topic!: string | null; // De qué trata (lo usa el prompt de la IA y la ficha)

  @Column({ type: 'varchar', length: 600, nullable: true })
  summary!: string | null; // Resumen corto en español (tarjeta del estudiante)

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status!: ReadingStatus;

  @Column({ type: 'varchar', length: 10, default: 'manual' })
  source!: ReadingSource; // ai | manual | import (trazabilidad)

  @Column({ type: 'varchar', length: 300, name: 'source_ref', nullable: true })
  sourceRef!: string | null; // Archivo o enlace del que se importó / autor del texto

  @Column({ type: 'int', name: 'sentence_count', default: 0 })
  sentenceCount!: number; // Desnormalizado → la lista no cuenta filas

  @Column({ type: 'int', name: 'word_count', default: 0 })
  wordCount!: number; // Minutos de lectura estimados en la tarjeta

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'timestamptz', name: 'withdrawn_at', nullable: true })
  withdrawnAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
