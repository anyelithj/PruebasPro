import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ReadingText } from './reading-text.entity';
// [Entity ReadingProgress · Lectura · 2026-10-25]: «marcador de lectura» — dónde se quedó cada estudiante en cada texto (frase y palabra) | [Patrón]: Entity + Upsert (una fila por usuario y texto) | [Principio]: SRP + mínimo dato personal (solo posición y fecha) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'reading_progress' })
@Unique('UQ_reading_progress_user_text', ['userId', 'textId']) // `@Unique` (TypeORM): una sola fila por par → upsert sin duplicados
export class ReadingProgress {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_reading_progress' })
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'text_id' })
  textId!: string;

  @ManyToOne(() => ReadingText, { onDelete: 'CASCADE' }) // Solo la FK (borrar el texto borra los marcadores)
  @JoinColumn({ name: 'text_id', foreignKeyConstraintName: 'FK_reading_progress_text' })
  readingText?: ReadingText;

  @Column({ type: 'int', name: 'sentence_index', default: 0 })
  sentenceIndex!: number; // Posición global de la frase marcada

  @Column({ type: 'int', name: 'word_index', default: 0 })
  wordIndex!: number; // Palabra dentro de la frase

  @Column({ type: 'boolean', default: false })
  finished!: boolean; // Llegó al final al menos una vez

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
