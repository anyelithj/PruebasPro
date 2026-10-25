import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
// [Entity PolyglotTerm · Sprint 10.5 · RF-130/RF-132]: el término de un concepto en un idioma con su IPA (UK y US en inglés) y su estado de revisión | [Patrón]: Entity (DDD) + Snapshot (IPA guardado al enriquecer) | [Principio]: SRP + verificación humana (la corrección manual prevalece) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'polyglot_terms' })
@Index(['conceptId', 'language'], { unique: true }) // Un término por concepto e idioma
export class PolyglotTerm {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'concept_id' })
  conceptId!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 200 })
  text!: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  ipa!: string; // Variante por defecto del idioma (en: en-GB)

  @Column({ type: 'varchar', length: 300, name: 'ipa_us', nullable: true })
  ipaUs!: string | null; // Solo inglés (interruptor UK/US)

  @Column({ type: 'boolean', default: false })
  reviewed!: boolean; // Corregido o confirmado por un docente

  @Column({ type: 'boolean', name: 'needs_native_review', default: false })
  needsNativeReview!: boolean; // Chino mandarín y ruso
}
