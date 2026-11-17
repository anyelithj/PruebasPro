import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
// [Entity BookProgress · Libros · RF-147 · 2026-11-14]: dónde se quedó cada usuario en cada libro (capítulo, párrafo y frase) | una fila por par → upsert
// [Principio]: mínimo dato personal (solo la posición y la fecha)

@Entity({ name: 'book_progress' })
export class BookProgress {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'int', name: 'book_id' })
  bookId!: number;

  @Column({ type: 'int', default: 0 })
  chapter!: number;

  @Column({ type: 'int', default: 0 })
  paragraph!: number;

  @Column({ type: 'int', default: 0 })
  sentence!: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
