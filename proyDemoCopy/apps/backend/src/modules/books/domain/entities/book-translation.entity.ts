import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
// [Entity BookTranslation · Libros · RF-146 · 2026-11-14]: traducción de UN párrafo, calculada bajo demanda y guardada por (libro, capítulo, párrafo, idioma)
// Clave = posición estable del párrafo en el texto limpio → el mismo párrafo nunca se traduce dos veces | [Patrón]: Cache (PostgreSQL)

@Entity({ name: 'book_translations' })
export class BookTranslation {
  @PrimaryColumn({ type: 'int', name: 'book_id' })
  bookId!: number;

  @PrimaryColumn({ type: 'int' })
  chapter!: number;

  @PrimaryColumn({ type: 'int' })
  paragraph!: number;

  @PrimaryColumn({ type: 'varchar', length: 2 })
  target!: string;

  @Column({ type: 'text' })
  text!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
