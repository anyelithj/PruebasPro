import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity PolyglotView · Sprint 10.5 · RF-131]: comparación guardada por el usuario — tema, idiomas elegidos y su orden (p. ej., la familia en español, inglés, ruso, alemán y francés) | [Patrón]: Entity (DDD) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL (orden en jsonb: lista corta)

@Entity({ name: 'polyglot_views' })
@Index(['userId', 'createdAt'])
export class PolyglotView {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'topic_id' })
  topicId!: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  name!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  languages!: string[]; // Orden de las columnas

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
