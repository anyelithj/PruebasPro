import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
// [Entity SongLine · Sprint 9.2 · RF-117/RF-119]: una línea de la letra con su IPA (UK y US en inglés), traducción al español y tiempos de inicio y fin | [Patrón]: Entity (DDD) + Snapshot (IPA y traducción guardados al enriquecer) | [Principio]: SRP + verificación humana (la corrección manual prevalece) | [Tecnología]: TypeORM + PostgreSQL

export type TimingSource = 'manual' | 'auto';

@Entity({ name: 'song_lines' })
@Index(['songId', 'position'])
export class SongLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'song_id' })
  songId!: string;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text', default: '' })
  ipa!: string; // Variante por defecto del idioma (en: en-GB)

  @Column({ type: 'text', name: 'ipa_us', nullable: true })
  ipaUs!: string | null; // Solo inglés (interruptor UK/US)

  @Column({ type: 'text', nullable: true })
  translation!: string | null; // null en canciones en español

  @Column({ type: 'real', name: 'start_s', nullable: true })
  startS!: number | null;

  @Column({ type: 'real', name: 'end_s', nullable: true })
  endS!: number | null;

  @Column({ type: 'varchar', length: 6, name: 'timing_source', nullable: true })
  timingSource!: TimingSource | null; // manual = tocado al ritmo · auto = propuesta de Alignment aceptada

  @Column({ type: 'boolean', default: false })
  reviewed!: boolean; // El docente corrigió o confirmó el IPA y la traducción

  @Column({ type: 'boolean', name: 'needs_native_review', default: false })
  needsNativeReview!: boolean; // Chino mandarín y ruso: el IPA automático lo revisa un hablante nativo
}
