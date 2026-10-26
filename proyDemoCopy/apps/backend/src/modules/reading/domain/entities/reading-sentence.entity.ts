import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ReadingText } from './reading-text.entity';
// [Entity ReadingSentence · Lectura · 2026-10-25]: una frase del texto con su párrafo, orden, traducción al español e IPA (UK por defecto y US en inglés) | [Patrón]: Entity (DDD) + Snapshot (traducción e IPA guardadas, no se recalculan al leer) | [Principio]: SRP + verificación humana (`reviewed` = el docente la corrigió) | [Tecnología]: TypeORM + PostgreSQL
// [Integridad]: FK con ON DELETE CASCADE declarada aquí y en la migración (mismo nombre → synchronize y migraciones coinciden)

@Entity({ name: 'reading_sentences' })
@Index('IDX_reading_sentences_text_position', ['textId', 'position'])
export class ReadingSentence {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_reading_sentences' })
  id!: string;

  @Column({ type: 'uuid', name: 'text_id' })
  textId!: string;

  // `@ManyToOne` (TypeORM) solo para la FK: no se carga (sin `eager`) → los casos de uso trabajan con `textId`
  @ManyToOne(() => ReadingText, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'text_id', foreignKeyConstraintName: 'FK_reading_sentences_text' })
  readingText?: ReadingText;

  @Column({ type: 'int' })
  paragraph!: number; // Índice del párrafo (0…) → el lector agrupa las frases

  @Column({ type: 'int' })
  position!: number; // Orden global (0…) → marcador de lectura y repetición de frase

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text', nullable: true })
  translation!: string | null; // Español (null si el texto ya está en español o el LLM no respondió)

  @Column({ type: 'text', default: '' })
  ipa!: string; // Variante por defecto del idioma ('' = pendiente: se completa con «Completar IPA y traducción»)

  @Column({ type: 'text', name: 'ipa_us', nullable: true })
  ipaUs!: string | null; // Solo inglés

  @Column({ type: 'boolean', default: false })
  reviewed!: boolean;
}
