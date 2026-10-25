import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { License } from '../value-objects/license.vo';
// [Entity Song · Sprint 9.2 · RF-115/RF-116/RF-128]: canción de uno de los siete idiomas con su nivel, licencia declarada y audio en el almacén de objetos | [Patrón]: Entity (DDD) + State (draft → review → published | rejected) + Soft Delete (withdrawnAt) | [Principio]: SRP + mínimo privilegio (solo se publica con licencia y revisión del ADMIN) | [Tecnología]: TypeORM + PostgreSQL

export const SONG_STATUSES = [
  'draft',
  'review',
  'published',
  'rejected',
] as const;
export type SongStatus = (typeof SONG_STATUSES)[number];
export type SongPracticeKind = 'gap_fill' | 'order_lines' | 'mark_words';

@Entity({ name: 'songs' })
@Index(['language', 'level', 'status'])
export class Song {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 160, default: '' })
  artist!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 2 })
  level!: string; // A1–C2

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status!: SongStatus;

  @Column({ type: 'jsonb' })
  license!: License;

  @Column({ type: 'text', name: 'review_note', default: '' })
  reviewNote!: string; // Motivo del rechazo (lo ve el docente)

  @Column({ type: 'varchar', length: 200, name: 'audio_key', nullable: true })
  audioKey!: string | null; // Clave en el almacén de objetos (prefijo «music»)

  @Column({ type: 'varchar', length: 40, name: 'audio_mime', nullable: true })
  audioMime!: string | null;

  @Column({ type: 'int', name: 'audio_size', nullable: true })
  audioSize!: number | null;

  // [Prácticas generadas]: tipo → id de PracticeActivity (una por tipo; se reutiliza en vez de duplicar)
  @Column({ type: 'jsonb', name: 'practice_ids', default: () => "'{}'" })
  practiceIds!: Partial<Record<SongPracticeKind, string>>;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'timestamptz', name: 'withdrawn_at', nullable: true })
  withdrawnAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
