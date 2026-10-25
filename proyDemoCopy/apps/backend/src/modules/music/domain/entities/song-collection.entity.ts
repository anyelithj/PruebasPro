import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity SongCollection · Sprint 9.2 · RF-115]: colección de canciones por idioma, nivel o tema con su orden | [Patrón]: Entity (DDD) + Soft Delete (archivedAt) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL (orden en jsonb: sin tabla intermedia para una lista corta)

@Entity({ name: 'song_collections' })
@Index(['language', 'level'])
export class SongCollection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  level!: string | null; // null = varios niveles

  @Column({ type: 'varchar', length: 60, nullable: true })
  theme!: string | null; // Tema libre: «canciones infantiles», «clásicos populares»…

  @Column({ type: 'varchar', length: 16, default: '🎵' })
  emoji!: string;

  @Column({ type: 'jsonb', name: 'song_ids', default: () => "'[]'" })
  songIds!: string[]; // Orden de reproducción

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
