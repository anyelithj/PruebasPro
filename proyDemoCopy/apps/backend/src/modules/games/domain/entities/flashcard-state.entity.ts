import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity FlashcardState · Sprint 8.5 · RF-99]: estado SM-2 de una palabra del banco en el mazo del usuario | [Patrón]: Entity (DDD) | [Principio]: SRP + DRY (la palabra vive en VocabularyEntry; aquí solo la programación del repaso) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'flashcard_states' })
@Index(['userId', 'entryId'], { unique: true }) // Una tarjeta por palabra y usuario
@Index(['userId', 'dueAt'])
export class FlashcardState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'entry_id' })
  entryId!: string; // VocabularyEntry (módulo Vocabulary)

  @Column({ type: 'int', default: 0 })
  repetitions!: number;

  @Column({ type: 'int', name: 'interval_days', default: 0 })
  intervalDays!: number;

  @Column({ type: 'real', default: 2.5 })
  ease!: number;

  @Column({ type: 'timestamptz', name: 'due_at' })
  dueAt!: Date;

  @Column({ type: 'smallint', name: 'last_quality', nullable: true })
  lastQuality!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
