import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { HelpLocale, HelpRole } from './faq.entity';
// [Entity ManualArticle · Sprint 7.10 · RF-95]: copia publicada de un artículo de docs/manual-usuario (Markdown) | [Patrón]: Entity + Read Model (la fuente es el repositorio; la tabla es lo que se sirve) | [Principio]: SSOT (los archivos mandan; reindexar sobrescribe) | [Tecnología]: TypeORM

@Entity({ name: 'manual_articles' })
@Index(['slug', 'locale'], { unique: true }) // Un artículo por slug e idioma
export class ManualArticle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @Column({ type: 'varchar', length: 2 })
  locale!: HelpLocale;

  @Column({ type: 'varchar', length: 8 })
  role!: HelpRole;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  body!: string; // Markdown sin el encabezado YAML (Angular lo sanea con DOMPurify antes de pintarlo)

  // [Huella]: SHA-256 del archivo → reindexar sin cambios no reescribe la fila
  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
