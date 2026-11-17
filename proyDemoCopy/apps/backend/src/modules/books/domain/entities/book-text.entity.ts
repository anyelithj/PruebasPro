import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { BookChapter } from '../gutenberg-text';
// [Entity BookText · Libros · RF-146 · 2026-11-14]: texto LIMPIO de un libro ya descargado (sin licencia), dividido en capítulos y párrafos
// Una fila por libro → el libro se descarga una sola vez para toda la plataforma | [Patrón]: Cache (PostgreSQL) | [Tecnología]: TypeORM + jsonb

@Entity({ name: 'book_texts' })
export class BookText {
  @PrimaryColumn({ type: 'int', name: 'book_id' })
  bookId!: number;

  @Column({ type: 'varchar', length: 2 })
  language!: string; // Idioma con el que se dividió en frases

  @Column({ type: 'jsonb' })
  chapters!: BookChapter[];

  @CreateDateColumn({ type: 'timestamptz', name: 'fetched_at' })
  fetchedAt!: Date;
}
