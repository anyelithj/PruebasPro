import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity ForumPost · Sprint 7.14 · RF-72]: respuesta a un hilo del foro | [Patrón]: Entity + Snapshot (nombre del autor) + Soft Delete | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'forum_posts' })
@Index(['threadId', 'createdAt'])
export class ForumPost {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string;

  @Column({ type: 'varchar', length: 160, name: 'author_name' })
  authorName!: string;

  @Column({ type: 'text' })
  body!: string;

  // [Editado]: null = nunca editada → la UI muestra «(editada)» solo cuando hace falta
  @Column({ type: 'timestamptz', name: 'edited_at', nullable: true })
  editedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;
}
