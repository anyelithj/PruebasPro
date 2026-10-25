import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity VocabularyEntry · Sprint 8.2 · RF-106/RF-109]: término o frase del banco de vocabulario del usuario con traducción e IPA UK/US | [Patrón]: Entity (DDD) + Snapshot (traducción e IPA copiados al guardar) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL
// [Regla]: el IPA nace «automático» (espeak-ng); una corrección manual prevalece y marca la entrada como revisada

@Entity({ name: 'vocabulary_entries' })
@Index(['userId', 'language', 'termKey'], { unique: true }) // Un término por usuario e idioma (crear dos veces devuelve el mismo)
export class VocabularyEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 160 })
  term!: string;

  // [Clave normalizada]: minúsculas y espacios simples → «Water» y «water » son la misma entrada
  @Column({ type: 'varchar', length: 160, name: 'term_key' })
  termKey!: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  translation!: string;

  // `jsonb` (Postgres): alternativas cortas de la traducción
  @Column({ type: 'jsonb', default: () => "'[]'" })
  alternatives!: string[];

  @Column({ type: 'varchar', length: 300, name: 'ipa_uk', nullable: true })
  ipaUk!: string | null;

  @Column({ type: 'varchar', length: 300, name: 'ipa_us', nullable: true })
  ipaUs!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  ipa!: string | null; // Idiomas distintos del inglés (una sola variante)

  @Column({ type: 'text', nullable: true })
  example!: string | null;

  // [Origen]: recurso curricular del que salió la palabra (null = alta manual)
  @Column({ type: 'uuid', name: 'source_item_id', nullable: true })
  sourceItemId!: string | null;

  // [Revisión]: false = traducción e IPA automáticos · true = corregidos a mano (prevalecen)
  @Column({ type: 'boolean', default: false })
  reviewed!: boolean;

  // [Sprint 10.2 · RF-137]: marca del diccionario — null = solo en el banco · learning = «Aprender» (resaltada en los textos) · learned = «Aprendido»
  @Column({ type: 'varchar', length: 8, nullable: true })
  status!: WordStatus | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// [WordStatus · Sprint 10.2]: estados de las palabras marcadas desde el diccionario
export const WORD_STATUSES = ['learning', 'learned'] as const;
export type WordStatus = (typeof WORD_STATUSES)[number];

// [termKeyOf]: normalización única de la clave (función pura, la usan el caso de uso y la consulta) | [Principio]: DRY
export const termKeyOf = (term: string): string =>
  term.trim().toLowerCase().replace(/\s+/g, ' ');
