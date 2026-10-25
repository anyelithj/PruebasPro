import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
// [Entity GrammarExample · Sprint 10.9 · RF-134]: ejemplo de una sección con su IPA (UK y US en inglés) y su traducción al español | [Patrón]: Entity (DDD) + Snapshot (IPA y traducción guardados al enriquecer) | [Principio]: SRP + verificación humana (la corrección manual prevalece) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'grammar_examples' })
@Index(['sectionId', 'position'])
export class GrammarExample {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'section_id' })
  sectionId!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text', default: '' })
  ipa!: string; // Variante por defecto (en: en-GB)

  @Column({ type: 'text', name: 'ipa_us', nullable: true })
  ipaUs!: string | null; // Solo inglés

  @Column({ type: 'text', nullable: true })
  translation!: string | null; // null en fichas de español

  @Column({ type: 'boolean', default: false })
  reviewed!: boolean;
}
