import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { BookAuthor } from '../book';
// [Entity Book · Libros · RF-145 · 2026-11-14]: ficha de un libro ya visto en el catálogo (caché en PostgreSQL de Gutendex) — sin el texto
// El texto descargado y limpio vive aparte (bajo pedido, un libro a la vez) | [Patrón]: Entity + Cache-aside | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'books' })
export class Book {
  @PrimaryColumn({ type: 'int' }) // Id de Project Gutenberg (estable)
  id!: number;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  authors!: BookAuthor[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  languages!: string[];

  @Column({ type: 'varchar', length: 500, name: 'text_url', nullable: true })
  textUrl!: string | null;

  @Column({ type: 'int', name: 'download_count', default: 0 })
  downloadCount!: number;

  // [2026-11-17 · Wikisource]: origen del libro y portada/imagen
  @Column({ type: 'varchar', length: 12, default: 'gutenberg' })
  source!: 'gutenberg' | 'wikisource';

  @Column({ type: 'varchar', length: 600, name: 'image_url', nullable: true })
  imageUrl!: string | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'fetched_at' })
  fetchedAt!: Date;
}
