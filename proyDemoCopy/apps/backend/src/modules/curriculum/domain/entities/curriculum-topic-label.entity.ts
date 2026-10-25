import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Language } from '../../../../shared/domain/language.vo';
// [Entity CurriculumTopicLabel]: nombre del tema en el idioma del recurso ("La ropa" → "Clothes") con su pronunciación y tipo de palabra | [Patrón]: Entity (DDD) | [Principio]: SRP
// [Clave]: idioma + slug del tema → el mismo nombre sirve para todos los niveles y tipos (se escribe una sola vez) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'curriculum_topic_labels' })
@Unique('uq_curriculum_topic_label', ['language', 'topicSlug'])
export class CurriculumTopicLabel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: Language })
  language!: Language;

  @Column({ type: 'varchar', length: 160, name: 'topic_slug' })
  topicSlug!: string; // slugify("La ropa") → "la-ropa"

  @Column({ type: 'varchar', length: 160 })
  label!: string; // Nombre en el idioma del recurso (p. ej. "Clothes")

  @Column({ type: 'varchar', length: 200, nullable: true })
  ipa!: string | null; // Pronunciación escrita, p. ej. /kləʊðz/

  @Column({ type: 'varchar', length: 20, name: 'ipa_variant', nullable: true })
  ipaVariant!: string | null; // Variante BCP-47 (en-GB, fr-FR…)

  @Column({
    type: 'varchar',
    length: 40,
    name: 'part_of_speech',
    nullable: true,
  })
  partOfSpeech!: string | null; // Tipo de palabra (sustantivo, verbo, expresión…)

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
