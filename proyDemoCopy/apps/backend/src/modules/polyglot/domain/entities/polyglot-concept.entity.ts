import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity PolyglotConcept · Sprint 10.5 · RF-129/RF-130]: una fila de la tabla — palabra o frase con su emoji o imagen (con licencia) y su glosa en español | [Patrón]: Entity (DDD) | [Principio]: SRP (los términos por idioma viven en PolyglotTerm) | [Tecnología]: TypeORM + PostgreSQL

export const CONCEPT_KINDS = ['word', 'phrase'] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

@Entity({ name: 'polyglot_concepts' })
@Index(['topicId', 'position'])
export class PolyglotConcept {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'topic_id' })
  topicId!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'varchar', length: 6, default: 'word' })
  kind!: ConceptKind;

  @Column({ type: 'varchar', length: 16, default: '' })
  emoji!: string; // Columna «imagen» de la tabla (emoji Unicode: sin licencia)

  @Column({ type: 'varchar', length: 400, name: 'image_url', nullable: true })
  imageUrl!: string | null; // Imagen alternativa al emoji

  @Column({ type: 'varchar', length: 300, name: 'image_license', nullable: true })
  imageLicense!: string | null; // Obligatoria si hay imagen (autor, fuente y licencia)

  @Column({ type: 'varchar', length: 160, default: '' })
  gloss!: string; // Significado en español (ayuda al docente; el término en español va en PolyglotTerm)

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
